import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { q } from './db.js';
import { complete, llmConfigured } from './llm.js';
import { startJob } from './jobs.js';
import { HttpError } from './util.js';
import { weather } from './services/openmeteo.js';
import { providerOf } from './routes/stocks.js';
import { findAsset } from './routes/tradeImport.js';

/*
 * Rules in plain Hungarian ("Szólj, ha az arany 3%-ot esik"). The AI turns the sentence into a small JSON rule
 * once, when it is made; from then on the push scheduler checks the rules every 5 minutes without any AI and
 * sends a notification — each event once (per day / week / mail).
 *
 * Kinds: price (drop / rise / move % today, above / below a price), spend (over a limit in a day / week / month,
 * optionally one category), mail (a summarised mail from / about something), weather (rain / snow / colder / warmer
 * today or tomorrow), habit (not ticked by an hour of the day).
 */
const r = Router();
const TZ = process.env.PUSH_TZ || 'Europe/Budapest';
const dayIn = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const hourIn = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d));
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmt = (n, d = 2) => Number(n).toLocaleString('hu-HU', { maximumFractionDigits: d });

async function load() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'rules'");
  return Array.isArray(rows[0]?.value) ? rows[0].value : [];
}
const save = (list) => q("INSERT INTO settings (key, value) VALUES ('rules', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(list)]);

// ---------- sentence → rule ----------
const PROMPT = `Turn the user's notification request into ONE JSON rule. Reply with the JSON object only.
Kinds and fields:
- price of a share, ETF, crypto, gold, currency: {"kind":"price","asset":"<ticker or name, e.g. gold, AAPL, bitcoin, OTP, EURHUF>","cond":"drop|rise|move|above|below","value":<number>,"currency":"<ISO for above/below, optional>"}
  drop/rise/move = percent change today; above/below = a price level.
- spending: {"kind":"spend","category":"<expense category or null>","period":"day|week|month","limit":<amount>}
- an email: {"kind":"mail","from":"<sender or null>","subject":"<words in the subject or null>"}
- weather: {"kind":"weather","cond":"rain|snow|below|above","value":<°C for below/above>,"when":"today|tomorrow","city":"<city or null>"}
- a habit not done: {"kind":"habit","habit":"<habit name>","hour":<0-23>}
If none fits: {"kind":null,"reason":"<short reason in Hungarian>"}
Examples:
"Szólj, ha az arany 3%-ot esik" → {"kind":"price","asset":"gold","cond":"drop","value":3}
"Ha az Apple 200 dollár alá megy" → {"kind":"price","asset":"AAPL","cond":"below","value":200,"currency":"USD"}
"Figyelmeztess, ha egy héten 40 ezernél többet költök étteremre" → {"kind":"spend","category":"étterem","period":"week","limit":40000}
"Ha levelet kapok a NAV-tól" → {"kind":"mail","from":"NAV","subject":null}
"Szólj, ha holnap esni fog" → {"kind":"weather","cond":"rain","when":"tomorrow","city":null}
"Ha este 8-ig nem edzettem" → {"kind":"habit","habit":"edzés","hour":20}`;

const num = (v) => {
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : null;
};

// No AI (or it failed): the commonest shape, a price move in percent.
function guess(text) {
  const t = fold(text);
  const pct = t.match(/(\d+(?:[.,]\d+)?)\s*(%|szazal)/);
  const asset = t.match(/\b(arany|ezust|bitcoin|btc|ethereum|eth|olaj|euro|dollar|forint|[a-z]{2,5}\b(?=\s*(arfolyam|reszveny)))/)?.[1] ?? text.match(/\b([A-Z]{2,6})\b/)?.[1];
  if (pct && asset) return { kind: 'price', asset, cond: /es(ik|ne|ett)|zuhan|csokken/.test(t) ? 'drop' : /emelk|no\b|nott|nove|felmegy|ugrik/.test(t) ? 'rise' : 'move', value: num(pct[1]) };
  return null;
}

const ALIAS = { arany: 'gold', ezust: 'silver', olaj: 'oil', euro: 'EURHUF', dollar: 'USDHUF', btc: 'bitcoin', eth: 'ethereum' };

async function normalise(raw, text) {
  if (!raw || typeof raw !== 'object' || !raw.kind) throw new HttpError(400, raw?.reason || 'Ezt nem tudom szabállyá alakítani.');
  const kind = String(raw.kind);
  if (kind === 'price') {
    const cond = ['drop', 'rise', 'move', 'above', 'below'].includes(raw.cond) ? raw.cond : 'move';
    const value = Math.abs(num(raw.value) ?? NaN);
    if (!(value > 0)) throw new HttpError(400, 'Hiányzik a szám (pl. 3% vagy 200 dollár).');
    const term = String(raw.asset ?? '').trim();
    if (!term) throw new HttpError(400, 'Melyik papírra vagy árfolyamra figyeljek?');
    const [providerName, provider] = providerOf('auto');
    const look = ALIAS[fold(term)] ?? term;
    const asset = await findAsset({ symbol: /^[A-Z0-9.:]{1,12}$/.test(look) ? look : null, name: look, currency: raw.currency ? String(raw.currency).toUpperCase() : null }, providerName, provider, new Map());
    if (!asset) throw new HttpError(400, `Nem találom ezt a papírt: ${term}`);
    return { kind, cond, value, asset: { provider: asset.provider, id: asset.id, symbol: asset.symbol, name: asset.name, currency: asset.currency } };
  }
  if (kind === 'spend') {
    const limit = num(raw.limit);
    if (!(limit > 0)) throw new HttpError(400, 'Hiányzik az összeghatár.');
    return { kind, limit, period: ['day', 'week', 'month'].includes(raw.period) ? raw.period : 'month', category: raw.category ? String(raw.category).slice(0, 40) : null };
  }
  if (kind === 'mail') {
    const from = raw.from ? String(raw.from).slice(0, 80) : null;
    const subject = raw.subject ? String(raw.subject).slice(0, 80) : null;
    if (!from && !subject) throw new HttpError(400, 'Kitől vagy miről szóló levélre figyeljek?');
    return { kind, from, subject };
  }
  if (kind === 'weather') {
    const cond = ['rain', 'snow', 'below', 'above'].includes(raw.cond) ? raw.cond : 'rain';
    const value = num(raw.value);
    if ((cond === 'below' || cond === 'above') && value == null) throw new HttpError(400, 'Hány fok alatt / fölött szóljak?');
    return { kind, cond, value, when: raw.when === 'today' ? 'today' : 'tomorrow', city: raw.city ? String(raw.city).slice(0, 60) : null };
  }
  if (kind === 'habit') {
    const habit = String(raw.habit ?? '').trim();
    if (!habit) throw new HttpError(400, 'Melyik szokásra figyeljek?');
    const hour = Math.min(23, Math.max(0, Math.round(num(raw.hour) ?? 20)));
    return { kind, habit, hour };
  }
  throw new HttpError(400, `Ismeretlen szabálytípus (${kind}). ${text ? '' : ''}`.trim());
}

export async function parseRule(text) {
  let raw = null;
  if (await llmConfigured()) {
    try {
      const msg = await complete([{ role: 'system', content: PROMPT }, { role: 'user', content: text }], { json: true, temperature: 0, purpose: 'background', timeoutMs: 5 * 60_000 });
      const s = String(msg.content ?? '');
      raw = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
    } catch {
      raw = null;
    }
  }
  if (!raw?.kind) raw = guess(text) ?? raw;
  return normalise(raw, text);
}

const CONDTEXT = { drop: 'esése', rise: 'emelkedése', move: 'mozgása', above: 'fölé megy', below: 'alá megy' };
const PERIOD = { day: 'egy nap', week: 'egy hét', month: 'egy hónap' };
export function describe(rule) {
  switch (rule.kind) {
    case 'price':
      return rule.cond === 'above' || rule.cond === 'below'
        ? `${rule.asset.symbol} ára ${fmt(rule.value)} ${rule.asset.currency ?? ''} ${CONDTEXT[rule.cond]}`.replace(/\s+/g, ' ')
        : `${rule.asset.symbol} napi ${CONDTEXT[rule.cond]} ≥ ${fmt(rule.value)}%`;
    case 'spend':
      return `${rule.category ? `„${rule.category}” kiadás` : 'Kiadás'} ${PERIOD[rule.period]} alatt > ${fmt(rule.limit, 0)}`;
    case 'mail':
      return `Levél${rule.from ? ` tőle: ${rule.from}` : ''}${rule.subject ? ` erről: ${rule.subject}` : ''}`;
    case 'weather':
      return `${rule.when === 'today' ? 'Ma' : 'Holnap'}${rule.city ? ` (${rule.city})` : ''}: ${{ rain: 'eső', snow: 'havazás', below: `${rule.value} °C alatt`, above: `${rule.value} °C fölött` }[rule.cond]}`;
    case 'habit':
      return `„${rule.habit}” ${rule.hour}:00-ig nincs kipipálva`;
    default:
      return '?';
  }
}

// ---------- checking ----------
async function periodStart(period) {
  const today = dayIn();
  if (period === 'day') return today;
  if (period === 'month') return `${today.slice(0, 8)}01`;
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); // Monday
  return d.toISOString().slice(0, 10);
}

// → [{ key, title, body, url }] for the events of one rule that are true now
export async function check(rule, created) {
  const today = dayIn();
  const out = [];
  if (rule.kind === 'price') {
    const [, provider] = providerOf(rule.asset.provider);
    const qd = (await provider.quotes([rule.asset.id]))[rule.asset.id];
    if (!qd || qd.error || !Number.isFinite(qd.price)) return out;
    const ch = qd.changePct ?? 0;
    const hit = { drop: ch <= -rule.value, rise: ch >= rule.value, move: Math.abs(ch) >= rule.value, above: qd.price >= rule.value, below: qd.price <= rule.value }[rule.cond];
    if (hit) {
      const sign = ch > 0 ? '+' : ch < 0 ? '−' : '';
      out.push({ key: `${today}:${rule.cond}${rule.cond === 'move' ? (ch > 0 ? 'u' : 'd') : ''}`, title: `${rule.asset.symbol} ${sign}${fmt(Math.abs(ch), 1)}% ma`, body: `Ár: ${fmt(qd.price)} ${qd.currency ?? rule.asset.currency ?? ''}`.trim() });
    }
  } else if (rule.kind === 'spend') {
    const from = await periodStart(rule.period);
    const { rows } = await q("SELECT value, data FROM widget_items WHERE kind = 'expense' AND day >= $1", [from]);
    const cat = rule.category ? fold(rule.category) : null;
    const total = rows.filter((x) => !cat || fold(x.data?.cat).includes(cat) || cat.includes(fold(x.data?.cat)) || fold(x.data?.note).includes(cat)).reduce((s, x) => s + Number(x.value || 0), 0);
    if (total > rule.limit) out.push({ key: from, title: `Túllépted: ${fmt(total, 0)} > ${fmt(rule.limit, 0)}`, body: describe(rule) });
  } else if (rule.kind === 'mail') {
    const { rows } = await q('SELECT result, widget_id FROM mail_digests WHERE created_at > $1 ORDER BY id DESC LIMIT 3', [created]);
    const f = rule.from ? fold(rule.from) : null;
    const s = rule.subject ? fold(rule.subject) : null;
    for (const d of rows)
      for (const m of d.result?.mails ?? []) {
        if ((f && !fold(m.from).includes(f)) || (s && !fold(m.subject).includes(s))) continue;
        out.push({ key: fold(`${m.from}|${m.subject}|${m.date}`).slice(0, 180), title: `Levél: ${String(m.from ?? '').replace(/<[^>]*>/g, '').trim()}`, body: m.subject ?? '', url: `/?w=${encodeURIComponent(d.widget_id)}` });
      }
  } else if (rule.kind === 'weather') {
    const h = hourIn();
    if (rule.when === 'today' ? h < 6 : h < 17) return out;
    const { rows } = await q("SELECT config FROM widgets WHERE type = 'weather' LIMIT 1");
    const wx = await weather(rule.city || rows[0]?.config?.city || 'Budapest');
    const i = rule.when === 'today' ? 0 : 1;
    const code = wx.daily.weather_code[i];
    const prob = wx.daily.precipitation_probability_max?.[i] ?? 0;
    const min = wx.daily.temperature_2m_min[i];
    const max = wx.daily.temperature_2m_max[i];
    const hit = {
      rain: prob >= 60 || [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code),
      snow: [71, 73, 75, 77, 85, 86].includes(code),
      below: min <= rule.value,
      above: max >= rule.value,
    }[rule.cond];
    if (hit) out.push({ key: wx.daily.time[i], title: `${rule.when === 'today' ? 'Ma' : 'Holnap'}: ${{ rain: `eső (${prob}%)`, snow: 'havazás', below: `${Math.round(min)} °C`, above: `${Math.round(max)} °C` }[rule.cond]}`, body: `${wx.place}: ${Math.round(min)}–${Math.round(max)} °C, csapadék ${prob}%` });
  } else if (rule.kind === 'habit') {
    if (hourIn() < rule.hour) return out;
    const { rows } = await q('SELECT id, name FROM habits WHERE end_month IS NULL OR end_month > $1', [today]);
    const h = rows.find((x) => fold(x.name) === fold(rule.habit)) ?? rows.find((x) => fold(x.name).includes(fold(rule.habit)));
    if (!h) return out;
    const { rows: done } = await q('SELECT 1 FROM habit_checks WHERE habit_id = $1 AND day = $2', [h.id, today]);
    if (!done.length) out.push({ key: today, title: `Még nincs kész: ${h.name}`, body: `${rule.hour}:00 elmúlt, és ma még nem pipáltad ki.` });
  }
  return out;
}

// Called by the push scheduler (push.js) every 5 minutes.
export async function runRules({ send, once }) {
  const list = (await load()).filter((x) => x.enabled !== false);
  for (const item of list) {
    let events = [];
    try {
      events = await check(item.rule, item.created);
    } catch (err) {
      console.error('[rules]', item.text, err.message);
      continue;
    }
    for (const e of events.slice(0, 3)) {
      if (!(await once(`rule:${item.id}:${e.key}`))) continue;
      await send({ title: `⚡ ${e.title}`, body: e.body ? `${e.body}\n${item.text}` : item.text, url: e.url || '/', tag: `rule:${item.id}` });
    }
  }
}

// ---------- routes ----------
const view = (x) => ({ ...x, summary: describe(x.rule) });
r.get('/rules', async (_req, res) => res.json((await load()).map(view)));

export async function addRule(text) {
  const clean = String(text ?? '').trim().slice(0, 300);
  if (!clean) throw new HttpError(400, 'Írd le, mire figyeljek.');
  const rule = await parseRule(clean);
  const item = { id: randomUUID(), text: clean, rule, enabled: true, created: new Date().toISOString() };
  await save([...(await load()), item]);
  return view(item);
}

r.post('/rules', async (req, res) => {
  const text = req.body?.text;
  // the AI can take a while on a CPU: background job (jobs.js)
  res.status(202).json({ job: startJob(() => addRule(text)) });
});
r.patch('/rules/:id', async (req, res) => {
  const list = await load();
  const it = list.find((x) => x.id === req.params.id);
  if (!it) throw new HttpError(404, 'Nincs ilyen szabály');
  if (req.body?.enabled !== undefined) it.enabled = Boolean(req.body.enabled);
  await save(list);
  res.json(view(it));
});
r.delete('/rules/:id', async (req, res) => {
  await save((await load()).filter((x) => x.id !== req.params.id));
  res.json({ ok: true });
});
// "would it fire now?" — for the list in the app
r.post('/rules/:id/check', async (req, res) => {
  const it = (await load()).find((x) => x.id === req.params.id);
  if (!it) throw new HttpError(404, 'Nincs ilyen szabály');
  res.json({ events: await check(it.rule, it.created) });
});

export default r;
