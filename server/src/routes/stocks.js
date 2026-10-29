import { Router } from 'express';
import { getWidget, cached, HttpError } from '../util.js';
import { MARKETS, RANGES, matchesMarket, expandQuery, rank } from '../services/market/common.js';
import * as twelvedata from '../services/market/twelvedata.js';
import * as yahoo from '../services/market/yahoo.js';
import * as tradingview from '../services/market/tradingview.js';
import { q } from '../db.js';
import { fxRates } from './finance.js';

const PROVIDERS = { twelvedata, tradingview, yahoo };
const r = Router();

// 'auto' → Twelve Data when a key is configured, otherwise TradingView (no key).
const resolve = (p) => (p && p !== 'auto' ? p : twelvedata.tdKey() ? 'twelvedata' : 'tradingview');
export const providerOf = (p) => {
  const name = resolve(p);
  if (!PROVIDERS[name]) throw new HttpError(400, `Unknown provider: ${p}`);
  return [name, PROVIDERS[name]];
};

r.get('/stocks/meta', (_req, res) => {
  res.json({
    markets: MARKETS,
    ranges: Object.fromEntries(Object.entries(RANGES).map(([k, v]) => [k, v.label])),
    defaultProvider: resolve('auto'),
    twelvedataKey: Boolean(twelvedata.tdKey()),
  });
});

r.get('/stocks/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 1) return res.json([]);
  const [name, p] = providerOf(req.query.provider);
  const { queries, prefer } = expandQuery(q, { twelvedata: 'td', yahoo: 'yahoo', tradingview: 'tv' }[name]);
  const market = req.query.market;
  const results = (await Promise.all(queries.map((x) => p.search(x, market).catch((err) => (x === q ? Promise.reject(err) : []))))).flat();
  res.json(rank(results, q, prefer).filter((x) => matchesMarket(x, req.query.market)).slice(0, 25));
});

// Instrument id for the provider in use. Presets carry ids per provider; an item found by search
// belongs to the provider it was found on and is re-resolved by exact symbol on another provider.
// Tiles created from older presets only carry Twelve Data / Yahoo ids.
const LEGACY_TV = {
  'GC=F': 'TVC:GOLD', 'XAU/USD': 'TVC:GOLD', 'SI=F': 'TVC:SILVER', 'XAG/USD': 'TVC:SILVER', 'CL=F': 'NYMEX:CL1!', 'WTI/USD': 'NYMEX:CL1!',
  'AAPL:NASDAQ': 'NASDAQ:AAPL', 'MSFT:NASDAQ': 'NASDAQ:MSFT', 'NVDA:NASDAQ': 'NASDAQ:NVDA', 'SPCX:NASDAQ': 'NASDAQ:SPCX',
  'OTP:BSE': 'BET:OTP', 'MOL:BSE': 'BET:MOL', 'RICHT:BSE': 'BET:RICHTER', 'MTEL:BSE': 'BET:MTELEKOM',
};
// 'OTP.BD' (Yahoo) / 'OTP:BSE' (Twelve Data) → 'OTP'
const baseSymbol = (s) => String(s).toUpperCase().split(/[.:=]/)[0];

async function idFor(item, name) {
  if (item.ids) {
    if (item.ids[name]) return item.ids[name];
    const legacy = name === 'tradingview' && Object.values(item.ids).map((id) => LEGACY_TV[id]).find(Boolean);
    if (legacy) return legacy;
    throw new HttpError(404, 'Ennél a szolgáltatónál nem elérhető');
  }
  if (item.provider === name) return item.id;
  const hits = rank(await PROVIDERS[name].search(baseSymbol(item.symbol), item.region), baseSymbol(item.symbol));
  const best = hits.find((h) => baseSymbol(h.symbol) === baseSymbol(item.symbol) && (!item.region || item.region === 'other' || h.region === item.region));
  if (!best) throw new HttpError(404, `Ennél a szolgáltatónál nem található: ${item.symbol}`);
  return best.id;
}

r.get('/widgets/:id/stocks', async (req, res) => {
  const w = await getWidget(req.params.id, 'stocks');
  const items = w.config.symbols ?? [];
  const [name, p] = providerOf(w.config.provider);
  const ttl = Math.max(1, Number(w.config.refreshMin) || (name === 'twelvedata' ? 10 : 2)) * 60_000 - 5000;
  const key = `${w.id}:stocks:${name}:${items.map((i) => i.ids?.[name] ?? i.id ?? i.name).join(',')}`;
  const result = await cached(key, ttl, async () => {
    const resolved = await Promise.all(items.map((i) => idFor(i, name).then((id) => ({ id }), (err) => ({ error: err.message }))));
    const ids = resolved.map((x) => x.id ?? null);
    const quotes = ids.some(Boolean) ? await p.quotes([...new Set(ids.filter(Boolean))]) : {};
    return items.map((item, k) => ({
      key: item.ids ? Object.values(item.ids).join('|') : `${item.provider}:${item.id}`,
      providerId: ids[k],
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      ...(ids[k] ? quotes[ids[k]] : { error: resolved[k].error }),
      name: item.name || quotes[ids[k]]?.name, // keep the user's / preset's (Hungarian) name
      fetchedAt: new Date().toISOString(),
    }));
  });
  res.json({ provider: name, items: result });
});

r.get('/stocks/detail', async (req, res) => {
  const { id, range = '1d' } = req.query;
  if (!id) throw new HttpError(400, 'id is required');
  if (!RANGES[range]) throw new HttpError(400, 'invalid range');
  const [name, p] = providerOf(req.query.provider);
  const ttl = range === '1d' ? 60_000 : range === '5d' ? 5 * 60_000 : 30 * 60_000;
  res.json({ provider: name, ...(await cached(`stocks:detail:${name}:${id}:${range}`, ttl, () => p.detail(id, range))) });
});

// ---------- Portfólió: buy / sell trades → positions valued at live prices ----------
// Trades are widget items (kind 'trade'): day = trade date, value = quantity,
// data = { side: 'buy'|'sell', price, fee, asset: { provider, id, symbol, name, type, exchange, currency, region } }.
// Average-cost method: a sale realises (price − average cost) × quantity and leaves the average cost unchanged.
export const assetKey = (a) => `${a?.provider ?? ''}:${a?.id ?? a?.symbol ?? ''}`;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export function buildPositions(trades) {
  const by = new Map();
  const sorted = [...trades].sort((a, b) => String(a.day).localeCompare(String(b.day)) || a.id - b.id);
  for (const t of sorted) {
    const a = t.data?.asset;
    if (!a) continue;
    const k = assetKey(a);
    const p = by.get(k) ?? { key: k, asset: a, qty: 0, cost: 0, realized: 0, bought: 0, sold: 0, trades: [] };
    const qty = Math.abs(num(t.value));
    // a price entered in another currency (e.g. HUF for a USD share) was converted at that day's rate
    const price = num(t.data.priceInstr ?? t.data.price);
    const fee = num(t.data.feeInstr ?? t.data.fee);
    if (t.data.side === 'sell') {
      const sell = Math.min(qty, p.qty);
      const avg = p.qty ? p.cost / p.qty : 0;
      p.realized += sell * price - fee - sell * avg;
      p.cost -= sell * avg;
      p.qty -= sell;
      p.sold += sell;
    } else {
      p.cost += qty * price + fee;
      p.qty += qty;
      p.bought += qty;
    }
    if (p.qty < 1e-9) (p.qty = 0), (p.cost = 0);
    p.asset = { ...p.asset, ...a };
    p.trades.push({ id: t.id, day: t.day, side: t.data.side === 'sell' ? 'sell' : 'buy', qty, price, fee, paid: num(t.data.price), paidCurrency: t.data.currency || null, note: t.data.note ?? '' });
    by.set(k, p);
  }
  return [...by.values()];
}

// Exchange rate of a past day (ECB reference rates via Frankfurter, no key); falls back to today's rate.
async function dayRate(day, from, to) {
  if (from === to) return 1;
  const d = /^\d{4}-\d{2}-\d{2}$/.test(String(day)) ? String(day) : 'latest';
  try {
    return await cached(`fx:${d}:${from}:${to}`, d === 'latest' ? 6 * 3600_000 : 30 * 86_400_000, async () => {
      const res = await fetch(`https://api.frankfurter.dev/v1/${d}?from=${from}&to=${to}`, { signal: AbortSignal.timeout(10_000) });
      const rate = res.ok ? (await res.json()).rates?.[to] : null;
      if (!Number.isFinite(rate)) throw new Error('no rate');
      return rate;
    });
  } catch {
    const r = await fxRates().catch(() => null);
    return r?.[from] && r?.[to] ? r[to] / r[from] : null;
  }
}

r.get('/widgets/:id/portfolio', async (req, res) => {
  const w = await getWidget(req.params.id, 'portfolio');
  const base = String(w.config.base || 'HUF').toUpperCase();
  const { rows: trades } = await q("SELECT id, day, value, data FROM widget_items WHERE widget_id = $1 AND kind = 'trade'", [w.id]);
  for (const t of trades) {
    const paid = String(t.data?.currency || '').toUpperCase();
    const instr = String(t.data?.asset?.currency || '').toUpperCase();
    if (!paid || !instr || paid === instr) continue;
    const rate = await dayRate(String(t.day).slice(0, 10), paid, instr);
    if (rate == null) continue;
    t.data.priceInstr = num(t.data.price) * rate;
    t.data.feeInstr = num(t.data.fee) * rate;
  }
  const positions = buildPositions(trades);
  const open = positions.filter((p) => p.qty > 0);
  const [name, p] = providerOf(w.config.provider);
  const ttl = Math.max(1, Number(w.config.refreshMin) || 3) * 60_000 - 5000;
  const quotes = open.length
    ? await cached(`${w.id}:portfolio:${name}:${open.map((x) => x.key).join(',')}`, ttl, async () => {
        const ids = await Promise.all(open.map((x) => idFor(x.asset, name).catch(() => null)));
        const got = ids.some(Boolean) ? await p.quotes([...new Set(ids.filter(Boolean))]).catch(() => ({})) : {};
        return Object.fromEntries(open.map((x, i) => [x.key, ids[i] ? got[ids[i]] : { error: 'nincs ár' }]));
      })
    : {};
  const rates = await fxRates().catch(() => null);
  // amount in `cur` → base currency (rates are per 1 USD)
  const toBase = (amount, cur) => {
    const c = String(cur || base).toUpperCase();
    if (c === base) return amount;
    if (!rates?.[c] || !rates?.[base]) return null;
    return (amount / rates[c]) * rates[base];
  };
  let value = 0, cost = 0, dayBase = 0, realized = 0, missing = false;
  const out = positions.map((x) => {
    const qd = quotes[x.key] ?? {};
    const currency = (qd.currency || x.asset.currency || base).toUpperCase();
    const price = x.qty > 0 && Number.isFinite(qd.price) ? qd.price : null;
    const posValue = price != null ? price * x.qty : null;
    const valueBase = posValue != null ? toBase(posValue, currency) : null;
    const costBase = toBase(x.cost, currency);
    const realizedBase = toBase(x.realized, currency) ?? 0;
    const unrealized = posValue != null ? posValue - x.cost : null;
    if (x.qty > 0) {
      if (valueBase == null) missing = true;
      else {
        value += valueBase;
        cost += costBase ?? 0;
        if (Number.isFinite(qd.change)) dayBase += toBase(qd.change * x.qty, currency) ?? 0;
      }
    }
    realized += realizedBase;
    return {
      key: x.key,
      asset: x.asset,
      qty: x.qty,
      avgCost: x.qty ? x.cost / x.qty : null,
      cost: x.cost,
      currency,
      price,
      dayChangePct: Number.isFinite(qd.changePct) ? qd.changePct : null,
      value: posValue,
      valueBase,
      unrealized,
      unrealizedPct: unrealized != null && x.cost ? (unrealized / x.cost) * 100 : null,
      realized: x.realized,
      realizedBase,
      error: x.qty > 0 && price == null ? qd.error || 'nincs ár' : null,
      trades: x.trades.reverse(),
    };
  });
  for (const o of out) o.weight = o.valueBase != null && value ? (o.valueBase / value) * 100 : null;
  out.sort((a, b) => (b.valueBase ?? -1) - (a.valueBase ?? -1));
  // one snapshot of the total per day for the value curve
  const today = new Date().toISOString().slice(0, 10);
  if (open.length && !missing) {
    const up = await q("UPDATE widget_items SET value = $3 WHERE widget_id = $1 AND kind = 'snap' AND day = $2", [w.id, today, value]);
    if (!up.rowCount) await q("INSERT INTO widget_items (widget_id, kind, day, value) VALUES ($1, 'snap', $2, $3)", [w.id, today, value]);
  }
  const { rows: snaps } = await q("SELECT day, value FROM widget_items WHERE widget_id = $1 AND kind = 'snap' ORDER BY day DESC LIMIT 120", [w.id]);
  const prevValue = value - dayBase;
  res.json({
    base,
    provider: name,
    totals: {
      value,
      cost,
      unrealized: value - cost,
      unrealizedPct: cost ? ((value - cost) / cost) * 100 : null,
      realized,
      dayChange: dayBase,
      dayChangePct: prevValue ? (dayBase / prevValue) * 100 : null,
      missing,
    },
    positions: out.filter((o) => o.qty > 0),
    closed: out.filter((o) => o.qty === 0),
    history: snaps.reverse().map((s) => ({ day: s.day, value: s.value })),
    fetchedAt: new Date().toISOString(),
  });
});

// Several trades in one go (screenshot import): all or nothing, one request instead of one per trade.
r.post('/widgets/:id/portfolio/trades', async (req, res) => {
  const w = await getWidget(req.params.id, 'portfolio');
  const list = Array.isArray(req.body?.trades) ? req.body.trades : [];
  if (!list.length) throw new HttpError(400, 'Nincs mit menteni');
  if (list.length > 500) throw new HttpError(400, 'Egyszerre legfeljebb 500 ügyletet mentek');
  const items = list.map((t, i) => {
    const n = i + 1;
    const qty = Number(t.qty), price = Number(t.price), fee = Number(t.fee ?? 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(t.day))) throw new HttpError(400, `${n}. ügylet: hibás dátum`);
    if (!(qty > 0) || !(price >= 0) || !(fee >= 0)) throw new HttpError(400, `${n}. ügylet: hibás darab / ár / díj`);
    if (!t.asset?.id || !t.asset?.provider) throw new HttpError(400, `${n}. ügylet: nincs papír`);
    const asset = Object.fromEntries(['provider', 'id', 'symbol', 'name', 'type', 'exchange', 'currency', 'region'].map((k) => [k, t.asset[k] ?? null]));
    const currency = /^[A-Z]{3}$/.test(String(t.currency)) ? t.currency : undefined;
    return { day: t.day, value: qty, data: { side: t.side === 'sell' ? 'sell' : 'buy', price, fee, currency, asset, source: t.source || undefined } };
  });
  await q(
    `INSERT INTO widget_items (widget_id, kind, day, value, data)
     SELECT $1, 'trade', (x->>'day')::date, (x->>'value')::float8, x->'data' FROM jsonb_array_elements($2::jsonb) x`,
    [w.id, JSON.stringify(items)],
  );
  res.status(201).json({ saved: items.length, keys: [...new Set(items.map((x) => assetKey(x.data.asset)))] });
});

// Move every trade of a position to another instrument (e.g. a screenshot import matched the wrong one).
r.post('/widgets/:id/portfolio/reassign', async (req, res) => {
  const w = await getWidget(req.params.id, 'portfolio');
  const { key, asset } = req.body ?? {};
  if (!key || !asset?.id || !asset?.provider) throw new HttpError(400, 'Hiányzik a papír');
  const clean = Object.fromEntries(['provider', 'id', 'symbol', 'name', 'type', 'exchange', 'currency', 'region'].map((k) => [k, asset[k] ?? null]));
  const { rows } = await q("SELECT id, data FROM widget_items WHERE widget_id = $1 AND kind = 'trade'", [w.id]);
  const ids = rows.filter((x) => assetKey(x.data?.asset) === key).map((x) => x.id);
  if (ids.length) await q(`UPDATE widget_items SET data = jsonb_set(data, '{asset}', $2::jsonb) WHERE id = ANY($1)`, [ids, JSON.stringify(clean)]);
  res.json({ moved: ids.length });
});

export default r;
