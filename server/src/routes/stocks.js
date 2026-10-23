import { Router } from 'express';
import { getWidget, cached, HttpError } from '../util.js';
import { MARKETS, RANGES, matchesMarket, expandQuery, rank } from '../services/market/common.js';
import * as twelvedata from '../services/market/twelvedata.js';
import * as yahoo from '../services/market/yahoo.js';
import * as tradingview from '../services/market/tradingview.js';

const PROVIDERS = { twelvedata, tradingview, yahoo };
const r = Router();

// 'auto' → Twelve Data when a key is configured, otherwise TradingView (no key).
const resolve = (p) => (p && p !== 'auto' ? p : twelvedata.tdKey() ? 'twelvedata' : 'tradingview');
const providerOf = (p) => {
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

export default r;
