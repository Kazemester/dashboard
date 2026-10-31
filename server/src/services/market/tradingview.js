// TradingView public screener + symbol search (no key). Covers practically every market:
// US/EU stocks, Budapest SE (BET:OTP), indices (SP:SPX), gold (TVC:GOLD), FX (FX_IDC:EURHUF), crypto.
// Unofficial endpoints: no price history, so charts use TradingView's official embeddable widget.
import { HttpError, cached } from '../../util.js';

const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const HEADERS = { 'User-Agent': UA, Origin: 'https://www.tradingview.com', Referer: 'https://www.tradingview.com/' };

const COLUMNS = ['description', 'close', 'open', 'high', 'low', 'change', 'change_abs', 'currency', 'exchange', 'volume', 'price_52_week_high', 'price_52_week_low', 'Perf.W', 'Perf.1M', 'Perf.3M', 'Perf.6M', 'Perf.YTD', 'Perf.Y', 'update_mode'];

async function scan(tickers) {
  const res = await fetch('https://scanner.tradingview.com/global/scan', {
    method: 'POST',
    headers: { ...HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbols: { tickers }, columns: COLUMNS }),
    signal: AbortSignal.timeout(15_000),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) throw new HttpError(502, `TradingView ${res.status}`);
  return Object.fromEntries((data.data ?? []).map((row) => [row.s, Object.fromEntries(COLUMNS.map((c, i) => [c, row.d[i]]))]));
}

// 'delayed_streaming_900' → 15 (minutes), 'streaming' → 0
const delayOf = (mode) => (mode?.startsWith('delayed') ? Math.round(Number(mode.split('_').pop()) / 60) || null : mode === 'streaming' ? 0 : null);

function shape(r) {
  const prevClose = r.close != null && r.change_abs != null ? r.close - r.change_abs : null;
  return {
    price: r.close,
    prevClose,
    change: r.change_abs,
    changePct: r.change,
    currency: r.currency,
    exchange: r.exchange,
    name: r.description,
    delayMin: delayOf(r.update_mode),
    range: r.high != null && r.low != null ? { low: r.low, high: r.high } : null,
    stats: {
      price: r.close, prevClose, change: r.change_abs, changePct: r.change,
      open: r.open, high: r.high, low: r.low, volume: r.volume || null,
      high52: r.price_52_week_high, low52: r.price_52_week_low,
    },
    perf: { '1 hét': r['Perf.W'], '1 hó': r['Perf.1M'], '3 hó': r['Perf.3M'], '6 hó': r['Perf.6M'], 'Év eleje óta': r['Perf.YTD'], '1 év': r['Perf.Y'] },
  };
}

export async function quotes(ids) {
  const rows = await scan(ids);
  return Object.fromEntries(ids.map((id) => [id, rows[id] ? shape(rows[id]) : { error: `TradingView: nincs adat (${id})` }]));
}

export async function detail(id) {
  const rows = await cached(`tv:detail:${id}`, 60_000, () => scan([id]));
  if (!rows[id]) throw new HttpError(404, `TradingView: nincs adat (${id})`);
  const q = shape(rows[id]);
  return { ...q, series: [], embed: { symbol: id }, marketOpen: null };
}

// ---------- search ----------
const EU = new Set(['DE', 'GB', 'FR', 'NL', 'IT', 'ES', 'CH', 'AT', 'BE', 'SE', 'NO', 'DK', 'FI', 'PL', 'PT', 'IE', 'CZ', 'GR', 'LU', 'RO', 'HR', 'SI', 'EE', 'LV', 'LT', 'IS', 'EU']);
const ASIA = new Set(['JP', 'CN', 'HK', 'KR', 'TW', 'IN', 'SG', 'TH', 'ID', 'MY', 'PH', 'VN']);
const region = (c) => (c === 'US' ? 'us' : c === 'HU' ? 'hu' : EU.has(c) ? 'eu' : ASIA.has(c) ? 'asia' : 'other');
function typeOf(x) {
  const spec = x.typespecs ?? [];
  if (spec.includes('etf') || x.type === 'fund') return 'etf';
  if (x.type === 'stock' || x.type === 'dr') return 'stock';
  if (x.type === 'index') return spec.includes('crypto') ? 'crypto' : 'index';
  if (x.type === 'forex') return 'fx';
  if (spec.includes('crypto') || x.type === 'crypto') return 'crypto';
  if (x.type === 'commodity' || x.type === 'futures') return 'commodity';
  return 'other';
}
// Narrow the query on TradingView's side where it has a matching filter.
const SEARCH_TYPE = { index: 'index', fx: 'forex', crypto: 'crypto', etf: 'funds', us: 'stocks', eu: 'stocks', hu: 'stocks', asia: 'stocks' };

export async function search(q, market) {
  const params = new URLSearchParams({ text: q, hl: '0', exchange: market === 'hu' ? 'BET' : '', lang: 'en', domain: 'production' });
  if (SEARCH_TYPE[market]) params.set('search_type', SEARCH_TYPE[market]);
  const data = await cached(`tv:search:${params}`, 3600_000, async () => {
    const res = await fetch(`https://symbol-search.tradingview.com/symbol_search/v3/?${params}`, { headers: HEADERS, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new HttpError(502, `TradingView keresés ${res.status}`);
    return res.json();
  });
  const items = (data.symbols ?? [])
    // CRYPTOCAP:* are market-cap indices, not prices
    .filter((x) => !(x.typespecs ?? []).includes('discontinued') && x.prefix !== 'CRYPTOCAP' && x.source_id !== 'CRYPTOCAP')
    .map((x) => {
      const prefix = x.prefix || x.source_id || x.exchange;
      const type = typeOf(x);
      return {
        provider: 'tradingview',
        id: `${prefix}:${x.symbol}`,
        symbol: x.symbol,
        name: String(x.description || '').replace(/<\/?em>/g, ''),
        exchange: prefix,
        country: x.country ?? null,
        currency: x.currency_code ?? null,
        type,
        region: region(x.country),
        synthetic: (x.typespecs ?? []).includes('synthetic') || (x.typespecs ?? []).includes('cfd'),
      };
    });
  // Search also lists symbols the screener has no quotes for (e.g. TVC:USOIL) — keep only priced ones.
  const rows = await scan(items.map((i) => i.id)).catch(() => null);
  if (!rows) return items;
  return items
    .filter((i) => rows[i.id])
    .map((i) => ({ ...i, price: rows[i.id].close, currency: i.currency || rows[i.id].currency, changePct: rows[i.id].change }));
}
