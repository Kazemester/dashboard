// Shared helpers for market data providers.

// Chart ranges offered in the UI → per-provider interval/size.
export const RANGES = {
  '1d': { td: ['5min', 80], yahoo: ['1d', '5m'], label: '1N' },
  '5d': { td: ['30min', 70], yahoo: ['5d', '30m'], label: '5N' },
  '1mo': { td: ['1day', 23], yahoo: ['1mo', '1d'], label: '1H' },
  '6mo': { td: ['1day', 128], yahoo: ['6mo', '1d'], label: '6H' },
  '1y': { td: ['1day', 252], yahoo: ['1y', '1d'], label: '1É' },
  '5y': { td: ['1week', 262], yahoo: ['5y', '1wk'], label: '5É' },
};

const EU = new Set(['Germany', 'United Kingdom', 'France', 'Netherlands', 'Italy', 'Spain', 'Switzerland', 'Austria', 'Belgium', 'Sweden', 'Norway', 'Denmark', 'Finland', 'Poland', 'Portugal', 'Ireland', 'Czech Republic', 'Greece', 'Luxembourg', 'Romania', 'Croatia', 'Slovenia', 'Estonia', 'Latvia', 'Lithuania', 'Iceland']);
const ASIA = new Set(['Japan', 'China', 'Hong Kong', 'South Korea', 'Korea', 'Taiwan', 'India', 'Singapore', 'Thailand', 'Indonesia', 'Malaysia', 'Philippines', 'Vietnam']);
export function regionOfCountry(country) {
  if (!country) return 'other';
  if (country === 'United States') return 'us';
  if (country === 'Hungary') return 'hu';
  if (EU.has(country)) return 'eu';
  if (ASIA.has(country)) return 'asia';
  return 'other';
}

// Market chips in the UI: either a region or an instrument type.
export const MARKETS = {
  all: 'Mind',
  us: 'USA',
  eu: 'Európa',
  hu: 'BÉT',
  asia: 'Ázsia',
  index: 'Indexek',
  commodity: 'Nyersanyag',
  fx: 'Deviza',
  crypto: 'Kripto',
  etf: 'ETF',
};
const NON_REGIONAL = new Set(['fx', 'crypto', 'commodity']);
export function matchesMarket(item, market) {
  if (!market || market === 'all') return true;
  if (['us', 'eu', 'hu', 'asia'].includes(market)) return item.region === market && !NON_REGIONAL.has(item.type);
  return item.type === market;
}

// Everyday names → what the providers actually call them.
const ALIASES = [
  [/^(space ?x|spacex)$/, { td: ['Space Exploration Technologies', 'SPCX'], yahoo: ['SPCX', 'Space Exploration Technologies'] }],
  [/^(arany|gold|xau)$/, { td: ['XAU/USD'], yahoo: ['GC=F', 'gold'] }],
  [/^(ezust|silver|xag)$/, { td: ['XAG/USD'], yahoo: ['SI=F', 'silver'] }],
  [/^(olaj|koolaj|oil|wti|crude)$/, { td: ['WTI/USD'], yahoo: ['CL=F', 'BZ=F'] }],
  [/^(brent)$/, { td: ['BRENT'], yahoo: ['BZ=F'] }],
  [/^(foldgaz|gaz|natural gas)$/, { td: [], yahoo: ['NG=F'] }],
  [/^(bitcoin|btc)$/, { td: ['BTC/USD'], yahoo: ['BTC-USD'] }],
  [/^(ethereum|eth)$/, { td: ['ETH/USD'], yahoo: ['ETH-USD'] }],
  [/^(forint|huf)$/, { td: ['EUR/HUF', 'USD/HUF'], yahoo: ['EURHUF=X', 'HUF=X'] }],
  [/^(euro|eur)$/, { td: ['EUR/USD', 'EUR/HUF'], yahoo: ['EURUSD=X', 'EURHUF=X'] }],
  [/^(s&?p ?500|sp500|s&p)$/, { td: ['SPY'], yahoo: ['^GSPC', 'SPY'] }],
  [/^(nasdaq)$/, { td: ['QQQ'], yahoo: ['^IXIC', 'QQQ'] }],
  [/^(dow|dow jones)$/, { td: ['DIA'], yahoo: ['^DJI', 'DIA'] }],
  [/^(dax)$/, { td: ['DAX'], yahoo: ['^GDAXI'] }],
  [/^(richter)$/, { td: ['RICHT'], yahoo: ['Richter Gedeon'] }],
  [/^(telekom|magyar telekom)$/, { td: ['Magyar Telekom'], yahoo: ['Magyar Telekom'] }],
];
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function expandQuery(q, provider) {
  const f = fold(q);
  const hit = ALIASES.find(([re]) => re.test(f));
  return [...new Set([...(hit ? hit[1][provider] : []), q])];
}

// Rank search results: exact symbol, primary listings and plain stocks first; drop warrants.
const MAJOR = new Set(['NASDAQ', 'NYSE', 'XETR', 'LSE', 'BSE', 'Euronext', 'SIX', 'TSX', 'NMS', 'NYQ', 'BUD', 'GER', 'COMMODITY', 'PHYSICAL CURRENCY', 'CCC', 'CCY', 'CMX', 'NYM']);
export function rank(items, q) {
  const Q = q.toUpperCase();
  const score = (x) =>
    (x.symbol.toUpperCase() === Q ? 0 : 10) +
    (x.type === 'stock' || x.type === 'commodity' || x.type === 'fx' || x.type === 'index' ? 0 : 3) +
    (MAJOR.has(x.exchange) ? 0 : 2) +
    (x.region === 'us' ? 0 : 1);
  const seen = new Set();
  return items
    .filter((x) => x.type !== 'warrant')
    .filter((x) => (seen.has(x.id) ? false : seen.add(x.id)))
    .sort((a, b) => score(a) - score(b));
}

// Price, change and session change from an ascending series of { t, close }.
export function summarise(series, prevCloseHint) {
  const last = series[series.length - 1];
  if (!last) return null;
  let prev = prevCloseHint;
  if (prev == null) {
    const lastDay = last.t.slice(0, 10);
    const before = [...series].reverse().find((p) => p.t.slice(0, 10) < lastDay);
    prev = before?.close ?? series[0].close;
  }
  const change = last.close - prev;
  return { price: last.close, prevClose: prev, change, changePct: prev ? (change / prev) * 100 : 0, time: last.t };
}
