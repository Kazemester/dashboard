import { spawn } from 'node:child_process';
import { Router } from 'express';
import { q } from '../db.js';
import { aiConfig, complete } from '../llm.js';
import { startJob } from '../jobs.js';
import { getWidget, HttpError } from '../util.js';
import { expandQuery, rank } from '../services/market/common.js';
import { assetKey, providerOf } from './stocks.js';

/*
 * Portfólió import from screenshots of a broker's trade list (Revolut, a bank app, a confirmation e-mail...).
 * Fast path: Tesseract OCR (a second per image) + a parser for the usual "Buy XAU / 0,0171 units · 1 733 803 Ft"
 * layout. Otherwise the AI reads the OCR text, and without OCR a vision model reads the image (slow on a CPU).
 * The server tidies numbers / dates and matches each line to an instrument. Nothing is saved here — the tile
 * shows the lines for review and the user saves them.
 */
const r = Router();
const MAX_IMAGES = 10;

const PROMPT = `You read screenshots of brokerage / trading apps and extract executed trades.
Return JSON only: {"trades":[{"symbol":"AAPL","name":"Apple Inc","side":"buy","quantity":2,"price":213.9,"total":427.8,"currency":"USD","date":"2026-01-02","fee":0}]}
Rules:
- One object per executed (filled) buy or sell. Skip cancelled / pending orders, dividends, deposits, withdrawals, interest, fees on their own.
- symbol: the ticker if visible (AAPL, OTP, VWCE, BTC), else null. name: the company / fund / coin name as shown.
- side: "buy" or "sell" (Vétel, Vásárlás, Bought, Market buy, Limit buy = buy; Eladás, Sold, Market sell = sell).
- quantity: number of shares / units. price: price per unit. total: the amount paid or received, if shown.
- The app may use Hungarian number format: comma = decimal separator, space = thousands ("0,017015 units" = 0.017015, "1 733 803,38 Ft" = 1733803.38). Output plain JSON numbers with a dot as decimal separator.
- A line like "0,0171 units · 1 733 803,38 Ft" + "-30 000 Ft" means quantity 0.0171, price 1733803.38, total 30000.
- currency: ISO code of the price (USD, EUR, HUF, GBP...); $ = USD, € = EUR, Ft = HUF.
- date: YYYY-MM-DD; if the year is not visible use MM-DD. fee: commission if shown, else 0.
- Copy what is on the image; never invent trades. If there are no trades, return {"trades":[]}.`;

const TEXT_PROMPT = `Below is text that OCR read from a screenshot of a brokerage / trading app. ${PROMPT.split('\n').slice(1).join('\n').replace(/on the image/g, 'in the text')}

OCR text:
`;

// ---------- OCR ----------
let ocrLangs; // undefined = not checked yet, null = no tesseract
async function tesseractLangs() {
  if (ocrLangs !== undefined) return ocrLangs;
  const out = await run('tesseract', ['--list-langs']).catch(() => null);
  const have = out ? out.split('\n').map((l) => l.trim()) : [];
  ocrLangs = out == null ? null : ['hun', 'eng'].filter((l) => have.includes(l)).join('+') || 'eng';
  return ocrLangs;
}

function run(cmd, args, input) {
  return new Promise((ok, fail) => {
    // one thread: Tesseract's OpenMP threads crawl when another process (Ollama) keeps the CPU busy
    const p = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'ignore'], env: { ...process.env, OMP_THREAD_LIMIT: '1' } });
    let out = '';
    const timer = setTimeout(() => p.kill('SIGKILL'), 60_000);
    p.stdout.on('data', (d) => (out += d));
    p.on('error', fail);
    p.on('close', (code) => (clearTimeout(timer), code === 0 ? ok(out) : fail(new Error(`${cmd} exited with ${code}`))));
    p.stdin.on('error', () => {});
    p.stdin.end(input);
  });
}

async function ocr(dataUrl) {
  const langs = await tesseractLangs();
  if (!langs) return null;
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  return run('tesseract', ['stdin', 'stdout', '-l', langs], buf).catch(() => null);
}

// "Buy XAU" / "Market sell Apple" / "Vétel OTP" … then "0,0171 units · 1 733 803,38 Ft" / "2 shares at $213.90"
const SIDE_LINE = /^(?:market\s+|limit\s+|stop\s+)?(buy|sell|bought|sold|vétel|vásárlás|eladás)\s+(.{1,60})$/i;
const QTY_PRICE = /(\d[\d\s.,]*?)\s*(?:units?|shares?|db|darab|egység|részvény)\b\s*[^\d€$£]{0,4}\s*([€$£])?\s*(\d[\d\s.,]*\d|\d)\s*(€|\$|£|Ft|HUF|EUR|USD|GBP)?/i;
const MONEY_TAIL = /\s*[+\-−]?\s*[€$£]?\s*\d[\d\s.,]*\s*(€|\$|£|Ft|HUF|EUR|USD|GBP)?\s*$/;

export function parseOcrTrades(text, today) {
  const lines = String(text ?? '').split('\n').map((l) => l.trim()).filter(Boolean);
  const out = [];
  let day = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^(today|ma)$/i.test(line)) day = (today ?? new Date()).toISOString().slice(0, 10);
    else if (/^(yesterday|tegnap)$/i.test(line)) day = new Date((today ?? new Date()).getTime() - 86_400_000).toISOString().slice(0, 10);
    else if (line.length <= 30 && !QTY_PRICE.test(line) && !/^\d{1,2}:\d{2}$/.test(line) && parseDay(line, today).day) day = line;
    const m = line.match(SIDE_LINE);
    if (!m) continue;
    const what = m[2].replace(MONEY_TAIL, '').trim();
    let qp = null;
    for (let k = i; k <= i + 3 && k < lines.length && !qp; k++) qp = lines[k].match(QTY_PRICE);
    if (!qp || !what) continue;
    const sym = /^[A-Z][A-Z0-9.]{0,9}$/.test(what) ? what : null;
    out.push({ symbol: sym, name: sym ? null : what, side: m[1], quantity: qp[1], price: qp[3], currency: qp[2] || qp[4] || null, date: day });
  }
  return out;
}

// "1 234,56" / "1,234.56" / "1.234,56" / "0,5" → number
export function parseNum(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v ?? '').replace(/[^\d.,\-]/g, '');
  if (!s) return null;
  const lastC = s.lastIndexOf(','), lastD = s.lastIndexOf('.');
  if (lastC >= 0 && lastD >= 0) s = lastC > lastD ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (lastC >= 0) s = /^-?[1-9]\d{0,2}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(/,/g, '.');
  else if (/^-?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, '');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const MONTHS = [
  ['jan'], ['feb'], ['mar', 'már'], ['apr', 'ápr'], ['may', 'máj'], ['jun', 'jún'],
  ['jul', 'júl'], ['aug'], ['sep', 'sze'], ['oct', 'okt'], ['nov'], ['dec'],
];
const monthOf = (w) => {
  const x = w.toLowerCase();
  const i = MONTHS.findIndex((alts) => alts.some((a) => x.startsWith(a)));
  return i < 0 ? null : i + 1;
};
const iso = (y, m, d) => (m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}` : null);

// → { day: 'YYYY-MM-DD', guessedYear } ; a date without year falls in the last 12 months
export function parseDay(v, today = new Date()) {
  const s = String(v ?? '').trim();
  let m, y, mo, d;
  if ((m = s.match(/(\d{4})[-./ ]\s*(\d{1,2})[-./ ]\s*(\d{1,2})/))) [y, mo, d] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/))) [d, mo, y] = [+m[1], +m[2], +m[3]];
  else if ((m = s.match(/(\d{4})\.?\s*([a-zá-ű]{3,})\.?\s*(\d{1,2})/i)) && monthOf(m[2])) [y, mo, d] = [+m[1], monthOf(m[2]), +m[3]];
  else if ((m = s.match(/(\d{1,2})\.?\s+([a-zá-ű]{3,})\.?,?\s*(\d{4})?/i)) && monthOf(m[2])) [d, mo, y] = [+m[1], monthOf(m[2]), m[3] ? +m[3] : null];
  else if ((m = s.match(/([a-zá-ű]{3,})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\.?,?\s*(\d{4})?/i)) && monthOf(m[1])) [mo, d, y] = [monthOf(m[1]), +m[2], m[3] ? +m[3] : null];
  else if ((m = s.match(/^(\d{1,2})[-./](\d{1,2})\.?$/))) [mo, d, y] = [+m[1], +m[2], null];
  else return { day: null, guessedYear: false };
  if (y) return { day: iso(y, mo, d), guessedYear: false };
  y = today.getFullYear();
  let day = iso(y, mo, d);
  if (day && day > today.toISOString().slice(0, 10)) day = iso(y - 1, mo, d);
  return { day, guessedYear: true };
}

export function normSide(v) {
  const s = String(v ?? '').toLowerCase();
  if (/sell|sold|elad|short/.test(s)) return 'sell';
  if (/buy|bought|vét|vet|vás|vas|purchase/.test(s)) return 'buy';
  return null;
}

const CURRENCY = { $: 'USD', '€': 'EUR', FT: 'HUF', HUF: 'HUF', '£': 'GBP' };
const normCurrency = (v) => {
  const s = String(v ?? '').trim().toUpperCase();
  return CURRENCY[s] ?? (/^[A-Z]{3}$/.test(s) ? s : null);
};

// Small models wrap JSON in prose or code fences.
function parseJson(text) {
  const s = String(text ?? '');
  for (const cand of [s, s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1), s.slice(s.indexOf('['), s.lastIndexOf(']') + 1)]) {
    try {
      const v = JSON.parse(cand);
      return Array.isArray(v) ? { trades: v } : v;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

export function normalise(raw, today) {
  const qty = Math.abs(parseNum(raw.quantity ?? raw.qty ?? raw.shares) ?? NaN);
  let price = parseNum(raw.price ?? raw.unitPrice);
  const total = parseNum(raw.total ?? raw.amount);
  if (!(price > 0) && total && qty > 0) price = Math.abs(total) / qty;
  // quantity × price should give the amount on the screenshot — if not, one of them was misread
  const mismatch = Boolean(total && qty > 0 && price > 0 && Math.abs(qty * price - Math.abs(total)) / Math.abs(total) > 0.03);
  const { day, guessedYear } = parseDay(raw.date ?? raw.day, today);
  const symbol = String(raw.symbol ?? raw.ticker ?? '').trim().toUpperCase().replace(/[^A-Z0-9.:-]/g, '') || null;
  const name = String(raw.name ?? raw.asset ?? '').trim().slice(0, 80) || null;
  return {
    symbol,
    name,
    side: normSide(raw.side ?? raw.type ?? raw.action),
    qty: Number.isFinite(qty) && qty > 0 ? qty : null,
    price: price > 0 ? +price.toFixed(6) : null,
    currency: normCurrency(raw.currency),
    day,
    guessedYear,
    fee: Math.abs(parseNum(raw.fee ?? raw.commission) ?? 0),
    total: total ? Math.abs(total) : null,
    mismatch,
  };
}

// Ticker / name → instrument of the tile's data source. Prefers listings in the trade's currency.
async function findAsset(t, providerName, provider, memo, held) {
  const text = t.symbol || t.name;
  if (!text) return null;
  const k = `${text}|${t.currency}`;
  if (memo.has(k)) return memo.get(k);
  const search = async (term, market) => {
    const { queries, prefer } = expandQuery(term, { twelvedata: 'td', yahoo: 'yahoo', tradingview: 'tv' }[providerName]);
    const hits = (await Promise.all(queries.map((x) => provider.search(x, market).catch(() => [])))).flat();
    return rank(hits, term, prefer);
  };
  // a forint price usually means a Budapest share — but gold bought in forints is still gold
  const run = async (term) => {
    if (t.currency === 'HUF') {
      const hu = (await search(term, 'hu')).filter((h) => h.region === 'hu');
      if (hu.length) return hu;
    }
    return search(term);
  };
  let hits = t.symbol ? await run(t.symbol) : [];
  if (!hits.length && t.name) hits = await run(t.name);
  // trust the ranking (it knows XAU = gold, not the PHLX XAU index); only swap to the same instrument
  // listed in the trade's currency (e.g. VWCE on Xetra for a EUR trade)
  const top = hits[0];
  // an instrument already in the portfolio wins, so the import adds to that position (XAU → the gold you hold)
  const mine = hits.slice(0, 10).find((x) => held.has(`${x.provider}:${x.id}`));
  const h = mine || top && (hits.find((x) => t.currency && x.currency === t.currency && x.type === top.type && x.symbol.toUpperCase() === top.symbol.toUpperCase()) || top);
  const asset = h ? { provider: h.provider, id: h.id, symbol: h.symbol, name: h.name, type: h.type, exchange: h.exchange, currency: h.currency, region: h.region } : null;
  memo.set(k, asset);
  return asset;
}

r.post('/widgets/:id/portfolio/import', async (req, res) => {
  const w = await getWidget(req.params.id, 'portfolio');
  const images = (Array.isArray(req.body?.images) ? req.body.images : []).filter((x) => typeof x === 'string' && /^data:image\/(png|jpe?g|webp|gif);base64,/.test(x));
  if (!images.length) throw new HttpError(400, 'Tölts fel legalább egy képet (PNG vagy JPG).');
  if (images.length > MAX_IMAGES) throw new HttpError(400, `Egyszerre legfeljebb ${MAX_IMAGES} képet elemzek.`);
  const c = await aiConfig();
  const model = c.visionModel || c.model;

  const job = startJob(async (progress) => {
    const found = [];
    const warnings = [];
    const methods = new Set();
    for (const [i, url] of images.entries()) {
      progress({ done: i, total: images.length });
      const text = await ocr(url);
      if (text != null) {
        const quick = parseOcrTrades(text);
        if (quick.length) {
          methods.add('ocr');
          for (const raw of quick) found.push({ ...normalise(raw), image: i + 1 });
          continue;
        }
        if (text.replace(/\s/g, '').length < 20) {
          warnings.push(`${i + 1}. kép: nem találtam rajta szöveget.`);
          continue;
        }
        // unusual layout: the text model sorts out the OCR text (much faster than reading the image)
        methods.add('ai');
        const msg = await complete([{ role: 'user', content: TEXT_PROMPT + text.slice(0, 6000) }], { temperature: 0, json: true, config: c, timeoutMs: 20 * 60_000 });
        const parsed = parseJson(msg.content);
        if (!parsed) warnings.push(`${i + 1}. kép: nem sikerült értelmezni a választ.`);
        for (const raw of parsed?.trades ?? []) if (raw && typeof raw === 'object') found.push({ ...normalise(raw), image: i + 1 });
        continue;
      }
      methods.add('vision');
      let msg;
      try {
        msg = await complete(
          [{ role: 'user', content: [{ type: 'text', text: PROMPT }, { type: 'image_url', image_url: { url } }] }],
          // a CPU-only server can need several minutes per image
          { model, temperature: 0, json: true, config: c, timeoutMs: 20 * 60_000 },
        );
      } catch (err) {
        // text-only models reject image parts with a 400 / 500
        if (/nem elérhető/.test(err.message) && c.isLocal) {
          throw new HttpError(400, `${err.message} — Töltsd le a szerveren: docker compose exec ollama ollama pull ${model}`);
        }
        if (/image|vision|multimodal|content.*(type|array)|unsupported/i.test(err.message)) {
          throw new HttpError(400, `A(z) „${model}” modell nem tud képet olvasni. Az AI beállításokban adj meg képelemző modellt (pl. qwen2.5vl:3b az Ollamában, vagy gpt-4o-mini). Részletek: ${err.message.slice(0, 160)}`);
        }
        throw err;
      }
      const parsed = parseJson(msg.content);
      if (!parsed) {
        warnings.push(`${i + 1}. kép: nem sikerült értelmezni a választ.`);
        continue;
      }
      for (const raw of parsed.trades ?? []) if (raw && typeof raw === 'object') found.push({ ...normalise(raw), image: i + 1 });
    }

    // the same trade on two overlapping screenshots
    const sig = (t) => [t.symbol || t.name, t.side, t.qty, t.price, t.day].join('|');
    const unique = [...new Map(found.map((t) => [sig(t), t])).values()].filter((t) => t.qty || t.price || t.symbol || t.name);

    const { rows } = await q("SELECT day, value, data FROM widget_items WHERE widget_id = $1 AND kind = 'trade'", [w.id]);
    const [providerName, provider] = providerOf(w.config.provider);
    const memo = new Map();
    const held = new Set(rows.map((x) => assetKey(x.data?.asset)));
    for (const t of unique) t.asset = await findAsset(t, providerName, provider, memo, held).catch(() => null);

    // already in the portfolio?
    const have = new Set(rows.map((x) => [assetKey(x.data?.asset), String(x.day).slice(0, 10), x.data?.side === 'sell' ? 'sell' : 'buy', +Number(x.value).toFixed(6)].join('|')));
    for (const t of unique) t.duplicate = Boolean(t.asset && have.has([assetKey(t.asset), t.day, t.side || 'buy', +Number(t.qty).toFixed(6)].join('|')));

    unique.sort((a, b) => String(a.day ?? '').localeCompare(String(b.day ?? '')));
    return { trades: unique, warnings, methods: [...methods] };
  });
  res.status(202).json({ job });
});

export default r;
