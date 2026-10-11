import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData, fmtNum } from '../hooks.js';
import { Sparkline, LineChart } from '../components/Charts.jsx';

const TYPE_LABEL = { stock: 'részvény', etf: 'ETF', index: 'index', commodity: 'nyersanyag', fx: 'deviza', crypto: 'kripto', other: '' };
const digitsFor = (p) => (p == null ? 2 : Number.isInteger(p) ? 0 : Math.abs(p) >= 1 ? 2 : 4);
const money = (v, cur) => (v == null ? '–' : `${fmtNum(v, digitsFor(v))}${cur ? ` ${cur}` : ''}`);
const pct = (v) => (v == null ? '–' : `${v >= 0 ? '+' : '−'}${fmtNum(Math.abs(v), 2)}%`);
const itemKey = (i) => (i.ids ? Object.values(i.ids).join('|') : `${i.provider}:${i.id}`);
const PROVIDER_LABEL = { twelvedata: 'TWELVE DATA', tradingview: 'TRADINGVIEW', yahoo: 'YAHOO' };

// Where today's price sits between the day's low and high.
function DayRange({ range, price }) {
  if (!range || range.high <= range.low || price == null) return <span />;
  const f = Math.max(0, Math.min(1, (price - range.low) / (range.high - range.low)));
  return (
    <span className="day-range" title={`Napi sáv: ${fmtNum(range.low, digitsFor(range.low))} – ${fmtNum(range.high, digitsFor(range.high))}`}>
      <i style={{ left: `${f * 100}%` }} />
    </span>
  );
}

// TradingView's official embeddable chart (used when the provider has no price history API).
function TvChart({ symbol }) {
  const cfg = {
    symbols: [[symbol, `${symbol}|1D`]], chartOnly: true, width: '100%', height: '100%', locale: 'hu', colorTheme: 'dark', autosize: true,
    showVolume: false, showMA: false, hideDateRanges: false, hideMarketStatus: true, hideSymbolLogo: true, scalePosition: 'right', scaleMode: 'Normal',
    fontFamily: 'JetBrains Mono, monospace', fontSize: '10', noTimeScale: false, valuesTracking: '1', changeMode: 'price-and-percent', chartType: 'area',
    lineWidth: 2, lineType: 0, isTransparent: true, lineColor: 'rgba(103, 232, 249, 1)', topColor: 'rgba(103, 232, 249, 0.22)', bottomColor: 'rgba(103, 232, 249, 0)',
    gridLineColor: 'rgba(103, 232, 249, 0.06)', dateRanges: ['1d|1', '1w|15', '1m|30', '3m|60', '12m|1D', '60m|1W', 'all|1M'],
  };
  const src = `https://www.tradingview-widget.com/embed-widget/symbol-overview/?locale=hu#${encodeURIComponent(JSON.stringify(cfg))}`;
  return <iframe className="tv-chart" src={src} title={symbol} loading="lazy" />;
}

function useMeta() {
  const [meta, setMeta] = useState(null);
  useEffect(() => {
    api.get('/stocks/meta').then(setMeta).catch(() => {});
  }, []);
  return meta;
}

// ---------- search & add ----------
function Search({ widget, meta, onAdd, onClose, has }) {
  const [q, setQ] = useState('');
  const [market, setMarket] = useState(widget.config.defaultMarket || 'all');
  const [results, setResults] = useState(null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!q.trim()) {
      setResults(null);
      return;
    }
    timer.current = setTimeout(async () => {
      setBusy(true);
      try {
        const provider = widget.config.provider || 'auto';
        setResults(await api.get(`/stocks/search?q=${encodeURIComponent(q.trim())}&market=${market}&provider=${provider}`));
        setErr(null);
      } catch (e) {
        setErr(e.message);
      } finally {
        setBusy(false);
      }
    }, 350);
    return () => clearTimeout(timer.current);
  }, [q, market, widget.config.provider]);

  return (
    <div className="stk-search">
      <div className="row gap">
        <input className="input sm grow" autoFocus placeholder="Keresés: SpaceX, arany, OTP, Apple, EUR/HUF…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn btn-ghost sm" onClick={onClose}>
          Kész
        </button>
      </div>
      <div className="chips">
        {Object.entries(meta?.markets ?? { all: 'Mind' }).map(([k, label]) => (
          <button key={k} className={`chip ${market === k ? 'chip-on' : ''}`} onClick={() => setMarket(k)}>
            {label}
          </button>
        ))}
      </div>
      {err && <div className="w-error sm">{err}</div>}
      <ul className="stk-results">
        {busy && <li className="loading">KERESÉS…</li>}
        {!busy && results?.length === 0 && <li className="muted sm">Nincs találat ezen a piacon.</li>}
        {!busy &&
          results?.map((r) => {
            const added = has(r);
            return (
              <li key={r.id}>
                <div className="stk-res-main">
                  <span className="stk-sym">{r.symbol}</span>
                  <span className="stk-res-name">{r.name}</span>
                </div>
                <span className="stk-res-meta">
                  {r.price != null && (
                    <b className="stk-res-price">
                      {fmtNum(r.price, digitsFor(r.price))}
                      {r.changePct != null && <span className={r.changePct >= 0 ? 'up' : 'down'}> {pct(r.changePct)}</span>}
                      <br />
                    </b>
                  )}
                  {r.exchange}
                  {r.currency ? ` · ${r.currency}` : ''}
                  {TYPE_LABEL[r.type] ? ` · ${TYPE_LABEL[r.type]}` : ''}
                </span>
                <button className={`btn sm ${added ? 'btn-ghost' : 'btn-primary'}`} disabled={added} onClick={() => onAdd(r)}>
                  {added ? '✓' : '+'}
                </button>
              </li>
            );
          })}
      </ul>
      {!q && <div className="muted sm">Tipp: a köznapi nevek is működnek („arany”, „olaj”, „forint”, „space x”).</div>}
    </div>
  );
}

// ---------- detail view ----------
function Detail({ item, provider, meta, onBack, onRemove }) {
  const [range, setRange] = useState('1d');
  const { data, error } = useWidgetData(`/stocks/detail?provider=${provider}&id=${encodeURIComponent(item.providerId)}&range=${range}`, { interval: range === '1d' ? 60_000 : 0 });
  const series = data?.series ?? [];
  const first = series[0]?.close;
  const last = series[series.length - 1]?.close;
  const st = data?.stats ?? {};
  const price = st.price ?? last ?? item.price;
  const change = range === '1d' ? st.change ?? item.change : last != null && first != null ? last - first : null;
  const changePct = range === '1d' ? st.changePct ?? item.changePct : first ? ((last - first) / first) * 100 : null;
  const cur = data?.currency || item.currency;
  const fmtX = (t) =>
    range === '1d' ? t.slice(11, 16) : range === '5d' ? `${t.slice(5, 7)}.${t.slice(8, 10)}. ${t.slice(11, 16)}` : range === '5y' ? `${t.slice(0, 4)}.${t.slice(5, 7)}.` : `${t.slice(5, 7)}.${t.slice(8, 10)}.`;

  return (
    <div className="stk-detail">
      <div className="row between">
        <button className="btn btn-ghost sm" onClick={onBack}>
          ‹ Lista
        </button>
        <button className="btn btn-ghost sm" onClick={onRemove}>
          Eltávolítás
        </button>
      </div>
      <div className="stk-d-head">
        <div>
          <div className="stk-sym lg">{item.symbol}</div>
          <div className="muted sm">{data?.name || item.name}</div>
        </div>
        <div className="stk-d-price">
          <span className="big-num">{price != null ? fmtNum(price, digitsFor(price)) : '–'}</span>
          <span className="muted"> {cur}</span>
          <div className={`stk-chg ${change >= 0 ? 'up' : 'down'}`}>
            {change != null && `${change >= 0 ? '▲' : '▼'} ${fmtNum(Math.abs(change), digitsFor(Math.abs(change)))} (${pct(changePct)})`}
            <span className="muted"> {range === '1d' ? 'ma' : 'az időszakban'}</span>
          </div>
        </div>
      </div>
      {!data?.embed && <div className="chips">
        {Object.entries(meta?.ranges ?? {}).map(([k, label]) => (
          <button key={k} className={`chip ${range === k ? 'chip-on' : ''}`} onClick={() => setRange(k)}>
            {label}
          </button>
        ))}
      </div>}
      {error && <div className="w-error sm">{error}</div>}
      {data?.embed && (
        <>
          <TvChart symbol={data.embed.symbol} />
          <a className="muted sm tv-link" href={`https://www.tradingview.com/symbols/${data.embed.symbol.replace(':', '-')}/`} target="_blank" rel="noreferrer">
            Teljes grafikon a TradingView-n ↗
          </a>
        </>
      )}
      {!data && !error && <div className="loading">GRAFIKON…</div>}
      {series.length > 1 && <LineChart points={series.map((p) => ({ x: fmtX(p.t), y: p.close }))} goal={range === '1d' ? st.prevClose : undefined} height={140} digits={digitsFor(price)} />}
      {data && (
        <div className="stk-stats">
          {[
            ['Előző záró', money(st.prevClose)],
            ['Napi max', money(st.high)],
            ['Napi min', money(st.low)],
            ['Nyitó', money(st.open)],
            ['52 hetes max', money(st.high52)],
            ['52 hetes min', money(st.low52)],
            ['Forgalom', st.volume ? fmtNum(st.volume) : '–'],
            ['Tőzsde', data.exchange || item.exchange || '–'],
            ['Állapot', data.marketOpen == null ? '–' : data.marketOpen ? 'nyitva' : 'zárva'],
          ]
            .filter(([, v]) => v !== '–')
            .map(([k, v]) => (
              <div key={k}>
                <span className="eyebrow">{k}</span>
                <span>{v}</span>
              </div>
            ))}
        </div>
      )}
      {data?.perf && (
        <div className="stk-perf">
          {Object.entries(data.perf)
            .filter(([, v]) => v != null)
            .map(([k, v]) => (
              <div key={k} className={v >= 0 ? 'up' : 'down'}>
                <span className="eyebrow">{k}</span>
                <span>{pct(v)}</span>
              </div>
            ))}
        </div>
      )}
      {data?.delayMin > 0 && <div className="muted sm">Az adat kb. {data.delayMin} perc késéssel érkezik.</div>}
    </div>
  );
}

// ---------- watchlist ----------
export default function Stocks({ widget, onUpdateConfig }) {
  const meta = useMeta();
  const symbols = widget.config.symbols ?? [];
  const refresh = Math.max(1, Number(widget.config.refreshMin) || 5) * 60_000;
  const { data, error, reload } = useWidgetData(symbols.length ? `/widgets/${widget.id}/stocks` : null, { interval: symbols.length ? refresh : 0, deps: [symbols.length, widget.config.provider] });
  const [mode, setMode] = useState(symbols.length ? 'list' : 'search');
  const [selected, setSelected] = useState(null);

  const has = (r) => symbols.some((s) => s.provider === r.provider && s.id === r.id);
  const add = async (r) => {
    await onUpdateConfig({ symbols: [...symbols, { provider: r.provider, id: r.id, symbol: r.symbol, name: r.name, type: r.type, exchange: r.exchange, currency: r.currency, region: r.region }] });
    reload();
  };
  const remove = async (key) => {
    await onUpdateConfig({ symbols: symbols.filter((s) => itemKey(s) !== key) });
    setSelected(null);
    setMode('list');
  };

  if (mode === 'search') return <Search widget={widget} meta={meta} has={has} onAdd={add} onClose={() => setMode('list')} />;
  if (mode === 'detail' && selected) return <Detail item={selected} provider={data?.provider} meta={meta} onBack={() => setMode('list')} onRemove={() => remove(selected.key)} />;

  const items = data?.items ?? [];
  return (
    <div className="stocks">
      {error && <div className="w-error sm">{error}</div>}
      {!symbols.length && <div className="muted center-text">Még üres a figyelőlista.</div>}
      {symbols.length > 0 && !data && !error && (
        <>
          <div className="loading">PIACI ADATOK…</div>
          {(widget.config.provider === 'twelvedata' || (widget.config.provider !== 'yahoo' && meta?.twelvedataKey)) && (
            <div className="muted sm">Twelve Data ingyenes keret: percenként 8 lekérés. Sok szimbólumnál a betöltés kivárhat egy percet.</div>
          )}
        </>
      )}
      <ul className="stk-list">
        {items.map((i) => {
          const up = (i.change ?? 0) >= 0;
          return (
            <li key={i.key} onClick={() => !i.error && (setSelected(i), setMode('detail'))} className={i.error ? 'err' : ''} title={i.error || `${i.name} · ${i.exchange ?? ''}`}>
              <div className="stk-name">
                <span className="stk-sym">
                  {i.symbol}
                  {i.marketOpen === true && <i className="dot ok stk-open" title="Nyitva" />}
                </span>
                <span className="muted sm stk-sub">{i.error ? i.error : i.name}</span>
              </div>
              {!i.error && (i.spark?.length > 1 ? <Sparkline values={i.spark} height={22} className={up ? 'up' : 'down'} /> : <DayRange range={i.range} price={i.price} />)}
              {!i.error && (
                <div className="stk-price">
                  <span>{money(i.price, i.currency)}</span>
                  <span className={`stk-chg ${up ? 'up' : 'down'}`}>{pct(i.changePct)}</span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <div className="stk-foot">
        <button className="btn btn-ghost sm" onClick={() => setMode('search')}>
          + Hozzáadás
        </button>
        <span className="eyebrow">{data ? `${PROVIDER_LABEL[data.provider] ?? data.provider} · ${new Date(items[0]?.fetchedAt ?? Date.now()).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}` : ''}</span>
      </div>
    </div>
  );
}
