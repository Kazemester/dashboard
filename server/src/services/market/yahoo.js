// Yahoo Finance (unofficial, no key). Covers most exchanges incl. Budapest (.BD), indices (^GSPC),
// futures (GC=F gold), FX (EURHUF=X) and crypto (BTC-USD). Yahoo may rate-limit cloud/datacenter IPs.
import { HttpError, cached } from '../../util.js';
import { RANGES, summarise } from './common.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const Q = 'https://query1.finance.yahoo.com';
let session = { cookie: '', crumb: '', at: 0 };

async function handshake() {
  const r = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA }, redirect: 'manual', signal: AbortSignal.timeout(10_000) }).catch(() => null);
  const cookie = (r?.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
  const c = await fetch(`${Q}/v1/test/getcrumb`, { headers: { 'User-Agent': UA, Cookie: cookie }, signal: AbortSignal.timeout(10_000) });
  const crumb = c.ok ? (await c.text()).trim() : '';
  session = { cookie, crumb, at: Date.now() };
}

async function y(path, params = {}, retry = true) {
  if (!session.at || Date.now() - session.at > 6 * 3600_000) await handshake().catch(() => {});
  const qs = new URLSearchParams({ ...params, ...(session.crumb ? { crumb: session.crumb } : {}) });
  const res = await fetch(`${Q}${path}?${qs}`, {
    headers: { 'User-Agent': UA, ...(session.cookie ? { Cookie: session.cookie } : {}) },
    signal: AbortSignal.timeout(15_000),
  });
  if ((res.status === 401 || res.status === 403) && retry) {
    session.at = 0;
    return y(path, params, false);
  }
  if (res.status === 429) throw new HttpError(429, 'Yahoo Finance korlátozza a kéréseket erről az IP-ről. Próbáld a Twelve Data szolgáltatót (ingyenes kulcs).');
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new HttpError(502, `Yahoo Finance ${res.status}`);
  return data;
}

const TYPE = { EQUITY: 'stock', ETF: 'etf', MUTUALFUND: 'etf', INDEX: 'index', FUTURE: 'commodity', CURRENCY: 'fx', CRYPTOCURRENCY: 'crypto' };
const REGION = {
  us: ['NMS', 'NYQ', 'NGM', 'NCM', 'PCX', 'ASE', 'BTS', 'PNK', 'OQB', 'OQX', 'NAS', 'NYS'],
  hu: ['BUD'],
  eu: ['GER', 'FRA', 'STU', 'MUN', 'DUS', 'HAM', 'BER', 'LSE', 'PAR', 'AMS', 'MIL', 'MCE', 'EBS', 'VIE', 'WSE', 'STO', 'CPH', 'HEL', 'OSL', 'BRU', 'LIS', 'ISE', 'PRA', 'ATH', 'IOB', 'CXE'],
  asia: ['JPX', 'TYO', 'HKG', 'SHH', 'SHZ', 'KSC', 'KOE', 'TAI', 'TWO', 'NSI', 'BSE', 'SES', 'SET', 'JKT', 'KLS'],
};
const regionOf = (exch) => Object.entries(REGION).find(([, list]) => list.includes(exch))?.[0] ?? 'other';

export async function search(q) {
  const data = await cached(`y:search:${q}`, 3600_000, () => y('/v1/finance/search', { q, quotesCount: 20, newsCount: 0, listsCount: 0 }));
  return (data.quotes ?? [])
    .filter((x) => x.symbol && x.quoteType !== 'OPTION')
    .map((x) => ({
      provider: 'yahoo',
      id: x.symbol,
      symbol: x.symbol,
      name: x.shortname || x.longname || x.symbol,
      exchange: x.exchDisp || x.exchange,
      mic: x.exchange,
      country: null,
      currency: null,
      type: TYPE[x.quoteType] ?? 'other',
      region: regionOf(x.exchange),
    }));
}

async function chart(id, range, interval) {
  const data = await y(`/v8/finance/chart/${encodeURIComponent(id)}`, { range, interval, includePrePost: false });
  const r = data.chart?.result?.[0];
  if (!r) throw new HttpError(404, data.chart?.error?.description || `Nincs adat: ${id}`);
  const ts = r.timestamp ?? [];
  const q = r.indicators?.quote?.[0] ?? {};
  const series = ts
    .map((t, i) => ({ t: new Date(t * 1000).toISOString(), close: q.close?.[i], high: q.high?.[i], low: q.low?.[i], volume: q.volume?.[i] }))
    .filter((p) => p.close != null);
  return { meta: r.meta, series };
}

const marketOpen = (meta) => {
  const p = meta.currentTradingPeriod?.regular;
  const now = Date.now() / 1000;
  return p ? now >= p.start && now <= p.end : null;
};

export async function quotes(ids) {
  const out = {};
  await Promise.all(
    ids.map(async (id) => {
      try {
        const { meta, series } = await chart(id, '5d', '1h');
        const price = meta.regularMarketPrice ?? series[series.length - 1]?.close;
        const prev = meta.previousClose ?? meta.chartPreviousClose;
        const s = summarise([...series, { t: new Date().toISOString(), close: price }], prev ?? undefined);
        out[id] = { ...s, currency: meta.currency, exchange: meta.fullExchangeName || meta.exchangeName, marketOpen: marketOpen(meta), name: meta.longName || meta.shortName, spark: series.map((p) => p.close) };
      } catch (err) {
        out[id] = { error: err.message };
      }
    }),
  );
  return out;
}

export async function detail(id, range) {
  const [yr, interval] = (RANGES[range] ?? RANGES['1d']).yahoo;
  const { meta, series } = await chart(id, yr, interval);
  const prev = range === '1d' ? meta.previousClose ?? meta.chartPreviousClose : series[0]?.close;
  const price = meta.regularMarketPrice;
  return {
    series: series.map((p) => ({ t: p.t, close: p.close })),
    currency: meta.currency,
    exchange: meta.fullExchangeName || meta.exchangeName,
    timezone: meta.exchangeTimezoneName,
    name: meta.longName || meta.shortName,
    marketOpen: marketOpen(meta),
    stats: {
      price, prevClose: meta.previousClose ?? meta.chartPreviousClose, change: prev != null ? price - prev : null, changePct: prev ? ((price - prev) / prev) * 100 : null,
      open: null, high: meta.regularMarketDayHigh, low: meta.regularMarketDayLow, volume: meta.regularMarketVolume,
      high52: meta.fiftyTwoWeekHigh, low52: meta.fiftyTwoWeekLow,
    },
  };
}
