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
  [/^(space ?x|spacex)$/, { prefer: 'stock', td: ['Space Exploration Technologies', 'SPCX'], yahoo: ['SPCX', 'Space Exploration Technologies'], tv: ['SPCX'] }],
  [/^(arany|gold|xau)$/, { prefer: 'commodity', td: ['XAU/USD'], yahoo: ['GC=F', 'gold'], tv: ['gold'] }],
  [/^(ezust|silver|xag)$/, { prefer: 'commodity', td: ['XAG/USD'], yahoo: ['SI=F', 'silver'], tv: ['silver'] }],
  [/^(olaj|koolaj|oil|wti|crude)$/, { prefer: 'commodity', td: ['WTI/USD'], yahoo: ['CL=F', 'BZ=F'], tv: ['USOIL', 'UKOIL'] }],
  [/^(brent)$/, { prefer: 'commodity', td: ['BRENT'], yahoo: ['BZ=F'], tv: ['UKOIL'] }],
  [/^(foldgaz|gaz|natural gas)$/, { prefer: 'commodity', td: [], yahoo: ['NG=F'], tv: ['NATURALGAS'] }],
  [/^(bitcoin|btc)$/, { prefer: 'crypto', td: ['BTC/USD'], yahoo: ['BTC-USD'], tv: ['BTCUSD'] }],
  [/^(ethereum|eth)$/, { prefer: 'crypto', td: ['ETH/USD'], yahoo: ['ETH-USD'], tv: ['ETHUSD'] }],
  [/^(forint|huf)$/, { prefer: 'fx', td: ['EUR/HUF', 'USD/HUF'], yahoo: ['EURHUF=X', 'HUF=X'], tv: ['EURHUF', 'USDHUF'] }],
  [/^(euro|eur)$/, { prefer: 'fx', td: ['EUR/USD', 'EUR/HUF'], yahoo: ['EURUSD=X', 'EURHUF=X'], tv: ['EURUSD', 'EURHUF'] }],
  [/^(s&?p ?500|sp500|s&p)$/, { prefer: 'index', td: ['SPY'], yahoo: ['^GSPC', 'SPY'], tv: ['SPX'] }],
  [/^(nasdaq)$/, { prefer: 'index', td: ['QQQ'], yahoo: ['^IXIC', 'QQQ'], tv: ['NDX', 'IXIC'] }],
  [/^(dow|dow jones)$/, { prefer: 'index', td: ['DIA'], yahoo: ['^DJI', 'DIA'], tv: ['DJI'] }],
  [/^(dax)$/, { prefer: 'index', td: ['DAX'], yahoo: ['^GDAXI'], tv: ['DAX'] }],
  [/^(bux)$/, { prefer: 'index', td: [], yahoo: [], tv: ['BUX'] }],
  [/^(richter)$/, { prefer: 'stock', td: ['RICHT'], yahoo: ['Richter Gedeon'], tv: ['RICHTER'] }],
  [/^(telekom|magyar telekom)$/, { prefer: 'stock', td: ['Magyar Telekom'], yahoo: ['Magyar Telekom'], tv: ['MTELEKOM'] }],
];
const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function expandQuery(q, provider) {
  const f = fold(q);
  const hit = ALIASES.find(([re]) => re.test(f));
  return { queries: [...new Set([...(hit ? hit[1][provider] ?? [] : []), q])], prefer: hit?.[1].prefer };
}

// Rank search results: exact symbol, primary listings and plain stocks first; drop warrants.
const MAJOR = new Set(['NASDAQ', 'NYSE', 'XETR', 'LSE', 'BSE', 'Euronext', 'SIX', 'TSX', 'NMS', 'NYQ', 'BUD', 'GER', 'COMMODITY', 'PHYSICAL CURRENCY', 'CCC', 'CCY', 'CMX', 'NYM', 'BET', 'TVC', 'SP', 'FX_IDC', 'BITSTAMP', 'COINBASE', 'AMEX', 'EURONEXT']);
export function rank(items, q, prefer) {
  const Q = q.toUpperCase();
  const score = (x) =>
    (x.symbol.toUpperCase() === Q ? 0 : 10) +
    (x.type === 'stock' || x.type === 'commodity' || x.type === 'fx' || x.type === 'index' ? 0 : 3) +
    (MAJOR.has(x.exchange) ? 0 : 2) +
    (x.region === 'us' ? 0 : 1) +
    (x.synthetic ? 1 : 0) +
    (prefer && x.type !== prefer ? 20 : 0);
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
