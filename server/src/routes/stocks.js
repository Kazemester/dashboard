import { Router } from 'express';
import { getWidget, cached, HttpError } from '../util.js';
import { MARKETS, RANGES, matchesMarket, expandQuery, rank } from '../services/market/common.js';
import * as twelvedata from '../services/market/twelvedata.js';
import * as yahoo from '../services/market/yahoo.js';

const PROVIDERS = { twelvedata, yahoo };
const r = Router();

// 'auto' → Twelve Data when a key is configured, otherwise Yahoo (no key).
const resolve = (p) => (p && p !== 'auto' ? p : twelvedata.tdKey() ? 'twelvedata' : 'yahoo');
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
  const queries = expandQuery(q, name === 'twelvedata' ? 'td' : 'yahoo');
  const results = (await Promise.all(queries.map((x) => p.search(x).catch((err) => (x === q ? Promise.reject(err) : []))))).flat();
  res.json(rank(results, q).filter((x) => matchesMarket(x, req.query.market)).slice(0, 25));
});

// Instrument id for the provider in use (presets may carry ids for several providers).
async function idFor(item, name) {
  if (item.ids?.[name]) return item.ids[name];
  if (item.provider === name && item.id) return item.id;
  // fall back to a name search on this provider (e.g. preset without an id for it)
  const hits = rank(await PROVIDERS[name].search(item.name || item.symbol), item.symbol || '');
  const best = hits.find((h) => !item.region || h.region === item.region) ?? hits[0];
  if (!best) throw new HttpError(404, `Nem található: ${item.name || item.symbol}`);
  return best.id;
}

r.get('/widgets/:id/stocks', async (req, res) => {
  const w = await getWidget(req.params.id, 'stocks');
  const items = w.config.symbols ?? [];
  const [name, p] = providerOf(w.config.provider);
  const ttl = Math.max(1, Number(w.config.refreshMin) || (name === 'twelvedata' ? 10 : 2)) * 60_000 - 5000;
  const key = `${w.id}:stocks:${name}:${items.map((i) => i.ids?.[name] ?? i.id ?? i.name).join(',')}`;
  const result = await cached(key, ttl, async () => {
    const ids = await Promise.all(items.map((i) => idFor(i, name).catch(() => null)));
    const quotes = await p.quotes([...new Set(ids.filter(Boolean))]);
    return items.map((item, k) => ({
      key: item.ids ? Object.values(item.ids).join('|') : `${item.provider}:${item.id}`,
      providerId: ids[k],
      symbol: item.symbol,
      name: item.name,
      type: item.type,
      ...(ids[k] ? quotes[ids[k]] : { error: 'Ennél a szolgáltatónál nem található' }),
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
