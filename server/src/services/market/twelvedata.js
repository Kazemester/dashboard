// Twelve Data (https://twelvedata.com) — free API key: 800 credits/day, 8 credits/minute.
import { HttpError, cached } from '../../util.js';
import { RANGES, regionOfCountry, summarise } from './common.js';

const BASE = () => (process.env.TWELVEDATA_BASE_URL || 'https://api.twelvedata.com').replace(/\/$/, '');
export const tdKey = () => process.env.SECRET_TWELVEDATA_KEY || process.env.TWELVEDATA_API_KEY || '';

// Simple sliding-window limiter so a watchlist refresh never blows the per-minute quota.
const PER_MIN = () => Number(process.env.TWELVEDATA_CREDITS_PER_MIN) || 8;
const used = [];
async function spend(n) {
  for (;;) {
    const now = Date.now();
    while (used.length && now - used[0] > 60_000) used.shift();
    if (!used.length || used.length + n <= PER_MIN()) {
      for (let i = 0; i < n; i++) used.push(now);
      return;
    }
    await new Promise((r) => setTimeout(r, 60_000 - (now - used[0]) + 100));
  }
}

async function td(path, params, credits = 0) {
  if (credits) {
    if (!tdKey()) throw new HttpError(400, 'Twelve Data API kulcs hiányzik (SECRET_TWELVEDATA_KEY a .env-ben)');
    await spend(credits);
  }
  const qs = new URLSearchParams({ ...params, ...(tdKey() ? { apikey: tdKey() } : {}) });
  const res = await fetch(`${BASE()}${path}?${qs}`, { signal: AbortSignal.timeout(20_000) });
  const data = await res.json().catch(() => null);
  if (!res.ok || data?.status === 'error') {
    throw new HttpError(data?.code === 429 || res.status === 429 ? 429 : 502, `Twelve Data: ${data?.message || res.status}`);
  }
  return data;
}

const TYPE = {
  'Common Stock': 'stock', 'Preferred Stock': 'stock', 'Depositary Receipt': 'stock', REIT: 'stock',
  ETF: 'etf', 'Mutual Fund': 'etf', Index: 'index', Warrant: 'warrant',
  'Physical Currency': 'fx', 'Digital Currency': 'crypto',
  'Precious Metal': 'commodity', 'Energy Resource': 'commodity', 'Agricultural Product': 'commodity', 'Industrial Metal': 'commodity', 'Livestock': 'commodity',
};
// Exchange-less symbols for pairs; SYMBOL:EXCHANGE for listed instruments (OTP trades on 8 exchanges).
const idOf = (x, type) => (['fx', 'crypto', 'commodity'].includes(type) ? x.symbol : `${x.symbol}:${x.exchange}`);

export async function search(q) {
  // symbol_search does not cost credits and works without a key
  const data = await cached(`td:search:${q}`, 3600_000, () => td('/symbol_search', { symbol: q, outputsize: 30 }));
  return (data.data ?? []).map((x) => {
    const type = TYPE[x.instrument_type] ?? 'other';
    return {
      provider: 'twelvedata',
      id: idOf(x, type),
      symbol: x.symbol,
      name: x.instrument_name,
      exchange: x.exchange,
      mic: x.mic_code,
      country: x.country,
      currency: x.currency,
      type,
      region: regionOfCountry(x.country),
    };
  });
}

const toSeries = (values) =>
  (values ?? [])
    .map((v) => ({ t: v.datetime, close: Number(v.close), high: Number(v.high), low: Number(v.low), open: Number(v.open), volume: Number(v.volume) || 0 }))
    .reverse();

// Watchlist: one batched time_series call (1 credit / symbol) gives price, change and a sparkline.
export async function quotes(ids) {
  const out = {};
  for (let i = 0; i < ids.length; i += PER_MIN()) {
    const chunk = ids.slice(i, i + PER_MIN());
    let data;
    try {
      data = await td('/time_series', { symbol: chunk.join(','), interval: '1h', outputsize: 40 }, chunk.length);
    } catch (err) {
      for (const id of chunk) out[id] = { error: err.message };
      continue;
    }
    const map = chunk.length === 1 ? { [chunk[0]]: data } : data;
    for (const id of chunk) {
      const r = map[id];
      if (!r || r.status === 'error') {
        out[id] = { error: r?.message || 'Nincs adat' };
        continue;
      }
      const series = toSeries(r.values);
      out[id] = { ...summarise(series), currency: r.meta?.currency, exchange: r.meta?.exchange, spark: series.map((p) => p.close) };
    }
  }
  return out;
}

export async function detail(id, range) {
  const [interval, outputsize] = (RANGES[range] ?? RANGES['1d']).td;
  const [series, q] = await Promise.all([
    td('/time_series', { symbol: id, interval, outputsize }, 1),
    td('/quote', { symbol: id }, 1).catch(() => null),
  ]);
  const s = toSeries(series.values);
  const n = (v) => (v == null || v === '' ? null : Number(v));
  return {
    series: s.map((p) => ({ t: p.t, close: p.close })),
    currency: series.meta?.currency,
    exchange: series.meta?.exchange,
    timezone: series.meta?.exchange_timezone,
    name: q?.name,
    marketOpen: q?.is_market_open ?? null,
    stats: q && {
      price: n(q.close), prevClose: n(q.previous_close), change: n(q.change), changePct: n(q.percent_change),
      open: n(q.open), high: n(q.high), low: n(q.low), volume: n(q.volume),
      high52: n(q.fifty_two_week?.high), low52: n(q.fifty_two_week?.low),
    },
  };
}
