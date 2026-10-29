import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { isoDay, useWidgetData } from '../hooks.js';
import { Sparkline } from '../components/Charts.jsx';
import { fmtMoney, Trend } from './Kpi.jsx';
import { locale, t } from '../i18n.js';
import './portfolio.css';

/*
 * Portfólió: positions built from the user's own buy / sell trades (several lots per share), valued at live
 * prices (the Tőzsde tile's data source) and converted into one base currency.
 */
const num = (s) => {
  const n = Number(String(s ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};
const fmtQty = (n) => (n == null ? '–' : Number(n).toLocaleString(locale(), { maximumFractionDigits: 6 }));
const signed = (n, unit) => (n == null ? '–' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${fmtMoney(Math.abs(n), unit)}`);
// currency '' = the share's own currency; `auto` marks a price filled in from the live quote
const emptyRow = (side = 'buy', price = '') => ({ side, qty: '', price, auto: price !== '', currency: '', day: isoDay(new Date()), fee: '' });
const BASES = [['HUF', 'Ft'], ['EUR', '€'], ['USD', '$']];
// allocation colours: the accent first, then distinct hues that work on light and dark themes
const PALETTE = ['var(--accent)', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#84cc16', '#a855f7', '#ef4444'];
const colour = (i) => PALETTE[i % PALETTE.length];

function AssetSearch({ onPick, initial = '' }) {
  const [text, setText] = useState(initial);
  const [hits, setHits] = useState(null);
  useEffect(() => {
    if (text.trim().length < 2) return setHits(null);
    const id = setTimeout(() => {
      api
        .get(`/stocks/search?q=${encodeURIComponent(text.trim())}`)
        .then((r) => setHits(r.slice(0, 8)))
        .catch(() => setHits([]));
    }, 350);
    return () => clearTimeout(id);
  }, [text]);
  return (
    <div className="pf-search">
      <input className="input sm" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Részvény, ETF vagy kripto keresése… (pl. OTP, AAPL, VWCE, BTC)')} autoFocus />
      {hits && (
        <ul>
          {!hits.length && <li className="muted small pf-none">{t('Nincs találat')}</li>}
          {hits.map((h) => (
            <li key={`${h.provider}:${h.id}`}>
              <button type="button" onClick={() => onPick({ provider: h.provider, id: h.id, symbol: h.symbol, name: h.name, type: h.type, exchange: h.exchange, currency: h.currency, region: h.region })}>
                <b>{h.symbol}</b> <span className="muted">{h.name}</span>
                <span className="pf-ex">{[h.exchange, h.currency].filter(Boolean).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Side, quantity, unit price (+ currency), date, fee of one lot — used by the trade form and the import review.
function LotFields({ r, cur, onChange }) {
  const currencies = [...new Set([cur, r.currency, 'HUF', 'EUR', 'USD'].filter(Boolean))];
  return (
    <>
      <div className="pf-side" role="group">
        <button type="button" className={r.side === 'buy' ? 'on buy' : ''} onClick={() => onChange({ side: 'buy' })}>
          {t('Vétel')}
        </button>
        <button type="button" className={r.side === 'sell' ? 'on sell' : ''} onClick={() => onChange({ side: 'sell' })}>
          {t('Eladás')}
        </button>
      </div>
      <label>
        <span>{t('Darab')}</span>
        <input className="input sm" inputMode="decimal" value={r.qty} onChange={(e) => onChange({ qty: e.target.value })} placeholder="10" />
      </label>
      <label>
        <span>{t('Ár / db')}</span>
        <span className="pf-price">
          <input className="input sm" inputMode="decimal" value={r.price} onChange={(e) => onChange({ price: e.target.value, auto: false })} />
          <select
            className="input sm"
            value={r.currency || cur}
            onChange={(e) => onChange({ currency: e.target.value === cur ? '' : e.target.value, ...(r.auto ? { price: '', auto: false } : {}) })}
            aria-label={t('Pénznem')}
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </span>
      </label>
      <label>
        <span>{t('Dátum')}</span>
        <input className="input sm" type="date" value={r.day} onChange={(e) => onChange({ day: e.target.value })} />
      </label>
      <label>
        <span>{t('Díj')}</span>
        <input className="input sm" inputMode="decimal" value={r.fee} onChange={(e) => onChange({ fee: e.target.value })} placeholder="0" />
      </label>
    </>
  );
}

// One asset, any number of buy / sell lines (e.g. two purchases at different prices and a sale).
function TradeForm({ widgetId, preset, positions, onDone, onCancel }) {
  const [asset, setAsset] = useState(preset?.asset ?? null);
  const [rows, setRows] = useState([emptyRow(preset?.side ?? 'buy', preset?.price ?? '')]);
  const [quote, setQuote] = useState(preset?.price ? { price: preset.price, currency: preset.asset?.currency } : null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const held = positions.find((p) => asset && p.key === `${asset.provider}:${asset.id}`)?.qty ?? 0;

  // current price as a starting point for the price fields
  useEffect(() => {
    if (!asset || preset?.price) return;
    api
      .get(`/stocks/detail?id=${encodeURIComponent(asset.id)}&provider=${encodeURIComponent(asset.provider)}&range=1d`)
      .then((d) => {
        setQuote({ price: d.price, currency: d.currency || asset.currency });
        if (Number.isFinite(d.price)) setRows((rs) => rs.map((r) => (r.price === '' && !r.currency ? { ...r, price: String(+d.price.toFixed(4)), auto: true } : r)));
      })
      .catch(() => {});
  }, [asset]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const cur = quote?.currency || asset?.currency || '';

  const save = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!asset) return setErr(t('Válassz egy papírt.'));
    let balance = held;
    const clean = [];
    for (const [i, r] of rows.entries()) {
      const qty = num(r.qty);
      const price = num(r.price);
      const fee = r.fee === '' ? 0 : num(r.fee);
      if (!(qty > 0)) return setErr(t('{n}. sor: adj meg pozitív darabszámot.', { n: i + 1 }));
      if (!(price >= 0)) return setErr(t('{n}. sor: adj meg árat.', { n: i + 1 }));
      if (!(fee >= 0)) return setErr(t('{n}. sor: a díj nem szám.', { n: i + 1 }));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return setErr(t('{n}. sor: adj meg dátumot.', { n: i + 1 }));
      balance += r.side === 'sell' ? -qty : qty;
      if (balance < -1e-9) return setErr(t('{n}. sor: többet adnál el, mint amennyi van ({held} db).', { n: i + 1, held: fmtQty(balance + qty) }));
      clean.push({ kind: 'trade', day: r.day, value: qty, data: { side: r.side, price, fee, currency: r.currency || cur || undefined, asset: { ...asset, currency: asset.currency || cur || undefined } } });
    }
    setBusy(true);
    try {
      for (const item of clean) await api.post(`/widgets/${widgetId}/items`, item);
      onDone();
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  };

  return (
    <form className="pf-form" onSubmit={save}>
      <div className="pf-form-head">
        <span className="eyebrow">{t('Új ügylet')}</span>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label={t('Mégse')}>
          ✕
        </button>
      </div>
      {asset ? (
        <div className="pf-asset">
          <b>{asset.symbol}</b>
          <span className="muted grow">{asset.name}</span>
          {quote?.price != null && <span className="pf-ex">{fmtMoney(quote.price, cur)}</span>}
          {!preset?.asset && (
            <button type="button" className="btn btn-ghost sm" onClick={() => setAsset(null)}>
              {t('Másik')}
            </button>
          )}
        </div>
      ) : (
        <>
          {positions.length > 0 && (
            <div className="pf-held">
              {positions.map((p) => (
                <button type="button" key={p.key} className="chip" onClick={() => setAsset(p.asset)}>
                  {p.asset.symbol}
                </button>
              ))}
            </div>
          )}
          <AssetSearch onPick={setAsset} />
        </>
      )}
      {asset && held > 0 && <div className="muted small">{t('Jelenleg: {qty} db', { qty: fmtQty(held) })}</div>}
      {asset && rows.some((r) => r.currency && r.currency !== cur) && <div className="muted small">{t('A más pénznemben megadott árat a vétel napi (EKB) árfolyamán számolom át {cur}-ra.', { cur })}</div>}
      {asset &&
        rows.map((r, i) => (
          <div key={i} className="pf-row">
            <LotFields r={r} cur={cur} onChange={(patch) => set(i, patch)} />
            {rows.length > 1 && (
              <button type="button" className="icon-btn danger pf-del" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={t('Sor törlése')}>
                ✕
              </button>
            )}
          </div>
        ))}
      {err && <div className="w-error sm">{err}</div>}
      {asset && (
        <div className="pf-form-foot">
          <button type="button" className="btn btn-ghost sm" onClick={() => setRows((rs) => [...rs, emptyRow(rs[rs.length - 1].side, quote?.price != null ? String(+quote.price.toFixed(4)) : '')])}>
            + {t('Még egy ügylet')}
          </button>
          <button className="btn btn-primary sm" disabled={busy}>
            {busy ? t('Mentés…') : t('Mentés')}
          </button>
        </div>
      )}
    </form>
  );
}

// ---------- import from screenshots ----------
const MAX_SLICES = 8;
const loadImage = (file) =>
  new Promise((ok, fail) => {
    const img = new Image();
    img.onload = () => ok(img);
    img.onerror = () => fail(new Error(t('Ezt a képet nem tudom megnyitni: {name}', { name: file.name })));
    img.src = URL.createObjectURL(file);
  });

// Screenshots → JPEGs small enough for a vision model; a long (scrolling) screenshot is cut into overlapping slices.
async function prepareImages(files) {
  const SLICE = 1800, OVERLAP = 160;
  const out = [];
  for (const file of files) {
    const img = await loadImage(file);
    const scale = Math.min(1, 1100 / img.naturalWidth);
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    for (let y = 0; y < h; y += SLICE - OVERLAP) {
      const sh = Math.min(SLICE, h - y);
      const c = document.createElement('canvas');
      c.width = w;
      c.height = sh;
      const g = c.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, w, sh);
      g.drawImage(img, 0, -y, w, h);
      out.push(c.toDataURL('image/jpeg', 0.85));
      if (y + sh >= h) break;
    }
    URL.revokeObjectURL(img.src);
  }
  return out;
}

const reviewRow = (x) => ({
  ...x,
  qty: x.qty != null ? String(x.qty) : '',
  price: x.price != null ? String(x.price) : '',
  fee: x.fee ? String(x.fee) : '',
  day: x.day || '',
  side: x.side || 'buy',
  // '' = the share's own currency, like in the trade form
  currency: x.currency && x.currency !== x.asset?.currency ? x.currency : '',
  include: Boolean(x.asset && x.qty && x.price && x.day && !x.duplicate),
  searching: !x.asset,
});

// Screenshots of a broker's trade list → the AI reads the trades → the user checks and fixes them → saved.
function ImportPanel({ widgetId, onDone, onCancel }) {
  const [shots, setShots] = useState([]); // data URLs
  const [rows, setRows] = useState(null); // review lines after the analysis
  const [busy, setBusy] = useState(null); // null | 'prep' | 'ai' | 'save'
  const [err, setErr] = useState(null);
  const [info, setInfo] = useState(null);

  const addFiles = async (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/'));
    if (!list.length) return;
    setErr(null);
    setBusy('prep');
    try {
      const imgs = await prepareImages(list);
      setShots((s) => {
        const all = [...s, ...imgs];
        if (all.length > MAX_SLICES) setErr(t('Egyszerre legfeljebb {n} képrészletet elemzek — a többit hagyd a következő körre.', { n: MAX_SLICES }));
        return all.slice(0, MAX_SLICES);
      });
    } catch (e) {
      setErr(e.message);
    }
    setBusy(null);
  };

  // pasting a screenshot (desktop: Cmd/Ctrl+V)
  useEffect(() => {
    const onPaste = (e) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (files.length && !rows) addFiles(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const analyse = async () => {
    setErr(null);
    setBusy('ai');
    try {
      const res = await api.postJob(`/widgets/${widgetId}/portfolio/import`, { images: shots });
      setRows(res.trades.map(reviewRow));
      setInfo([...res.warnings, !res.trades.length && t('Nem találtam ügyletet a képeken.')].filter(Boolean).join(' '));
    } catch (e) {
      setErr(e.message);
    }
    setBusy(null);
  };

  const set = (i, patch) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const chosen = rows?.filter((r) => r.include) ?? [];

  const save = async () => {
    setErr(null);
    const clean = [];
    for (const r of chosen) {
      const n = rows.indexOf(r) + 1;
      const qty = num(r.qty);
      const price = num(r.price);
      const fee = r.fee === '' ? 0 : num(r.fee);
      if (!r.asset) return setErr(t('{n}. sor: válaszd ki a papírt.', { n }));
      if (!(qty > 0)) return setErr(t('{n}. sor: adj meg pozitív darabszámot.', { n }));
      if (!(price >= 0)) return setErr(t('{n}. sor: adj meg árat.', { n }));
      if (!(fee >= 0)) return setErr(t('{n}. sor: a díj nem szám.', { n }));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(r.day)) return setErr(t('{n}. sor: adj meg dátumot.', { n }));
      clean.push({ kind: 'trade', day: r.day, value: qty, data: { side: r.side, price, fee, currency: r.currency || r.asset.currency || undefined, asset: r.asset, source: 'screenshot' } });
    }
    setBusy('save');
    try {
      for (const item of clean) await api.post(`/widgets/${widgetId}/items`, item);
      onDone();
    } catch (e) {
      setErr(e.message);
      setBusy(null);
    }
  };

  return (
    <div className="pf-form pf-import">
      <div className="pf-form-head">
        <span className="eyebrow">{t('Import képernyőképből')}</span>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label={t('Mégse')}>
          ✕
        </button>
      </div>
      {!rows && (
        <>
          <p className="muted small pf-imp-help">{t('Tölts fel képernyőképeket a brókered vagy bankod ügyletlistájáról (pl. Revolut → Részvények → Előzmények). Az AI kiolvassa a vételeket és eladásokat, te ellenőrzöd, és csak utána mentem.')}</p>
          <label className={`pf-drop ${busy === 'prep' ? 'busy' : ''}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => (e.preventDefault(), addFiles(e.dataTransfer.files))}>
            <input type="file" accept="image/*" multiple onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
            <span>📷 {t('Képek kiválasztása')}</span>
            <span className="muted small">{t('vagy húzd ide / illeszd be')}</span>
          </label>
          {shots.length > 0 && (
            <div className="pf-shots">
              {shots.map((src, i) => (
                <span key={i} className="pf-shot">
                  <img src={src} alt="" />
                  <button type="button" className="icon-btn" onClick={() => setShots((s) => s.filter((_, j) => j !== i))} aria-label={t('Kép eltávolítása')}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
          {err && <div className="w-error sm">{err}</div>}
          <div className="pf-form-foot">
            <span className="muted small">{busy === 'ai' ? t('Elemzem a képeket… helyi modellel ez képenként akár egy-két perc is lehet.') : ''}</span>
            <button type="button" className="btn btn-primary sm" disabled={!shots.length || !!busy} onClick={analyse}>
              {busy === 'ai' ? t('Elemzés…') : t('Elemzés')}
            </button>
          </div>
        </>
      )}
      {rows && (
        <>
          {info && <div className="muted small">{info}</div>}
          {rows.length > 0 && <div className="muted small">{t('Ellenőrizd a sorokat — a kép alapján töltöttem ki őket, de tévedhetek. A pipával jelölteket mentem.')}</div>}
          {rows.map((r, i) => (
            <div key={i} className={`pf-imp-row ${r.include ? '' : 'off'}`}>
              <div className="pf-imp-head">
                <input type="checkbox" checked={r.include} onChange={(e) => set(i, { include: e.target.checked })} aria-label={t('Mentés')} />
                {r.asset && !r.searching ? (
                  <button type="button" className="pf-imp-asset" onClick={() => set(i, { searching: true })} title={t('Másik papír')}>
                    <b>{r.asset.symbol}</b> <span className="muted">{r.asset.name}</span> <span className="pf-ex">{[r.asset.exchange, r.asset.currency].filter(Boolean).join(' · ')}</span>
                  </button>
                ) : (
                  <span className="pf-imp-asset muted">{t('A képen: {name}', { name: [r.symbol, r.name].filter(Boolean).join(' · ') || '?' })}</span>
                )}
                {r.duplicate && <span className="pf-badge">{t('Már rögzítve')}</span>}
                {r.guessedYear && (
                  <span className="pf-badge warn" title={t('A képen nem látszott az év — ellenőrizd a dátumot.')}>
                    {t('év?')}
                  </span>
                )}
                <button type="button" className="icon-btn danger" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))} aria-label={t('Sor törlése')}>
                  ✕
                </button>
              </div>
              {r.searching && <AssetSearch initial={r.symbol || r.name || ''} onPick={(a) => set(i, { asset: a, searching: false, include: true })} />}
              <div className="pf-row">
                <LotFields r={r} cur={r.asset?.currency || ''} onChange={(patch) => set(i, patch)} />
              </div>
            </div>
          ))}
          {err && <div className="w-error sm">{err}</div>}
          <div className="pf-form-foot">
            <button type="button" className="btn btn-ghost sm" onClick={() => (setRows(null), setInfo(null))} disabled={!!busy}>
              ← {t('Vissza a képekhez')}
            </button>
            <button type="button" className="btn btn-primary sm" disabled={!chosen.length || !!busy} onClick={save}>
              {busy === 'save' ? t('Mentés…') : t('{n} ügylet mentése', { n: chosen.length })}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Position({ p, base, open, onToggle, onTrade, onDelete }) {
  return (
    <li className={`pf-pos ${open ? 'open' : ''}`}>
      <button type="button" className="pf-pos-main" onClick={onToggle} aria-expanded={open}>
        <span className="pf-sym">
          <b>{p.asset.symbol}</b>
          <span className="muted">{p.asset.name}</span>
        </span>
        <span className="pf-qty muted">
          {fmtQty(p.qty)} {t('db')}
        </span>
        <span className="pf-val">
          <b>{fmtMoney(p.valueBase, base)}</b>
          {p.currency !== base && p.value != null && <span className="pf-native">{fmtMoney(p.value, p.currency)}</span>}
          {p.error ? <span className="pf-err">{t('nincs ár')}</span> : <Trend change={p.unrealizedPct} />}
        </span>
      </button>
      {open && (
        <div className="pf-detail">
          <div className="pf-stats">
            <div>
              <span className="muted">{t('Átlagár')}</span>
              <b>{fmtMoney(p.avgCost, p.currency)}</b>
            </div>
            <div>
              <span className="muted">{t('Jelenlegi ár')}</span>
              <b>{fmtMoney(p.price, p.currency)}</b>
            </div>
            <div>
              <span className="muted">{t('Hozam')}</span>
              <b className={p.unrealized >= 0 ? 'pos' : 'neg'}>{signed(p.unrealized, p.currency)}</b>
            </div>
            <div>
              <span className="muted">{t('Ma')}</span>
              <b className={p.dayChangePct >= 0 ? 'pos' : 'neg'}>{p.dayChangePct == null ? '–' : `${p.dayChangePct >= 0 ? '+' : ''}${p.dayChangePct.toFixed(2)}%`}</b>
            </div>
            {p.realized !== 0 && (
              <div>
                <span className="muted">{t('Realizált')}</span>
                <b className={p.realized >= 0 ? 'pos' : 'neg'}>{signed(p.realized, p.currency)}</b>
              </div>
            )}
          </div>
          <table className="pf-trades">
            <tbody>
              {p.trades.map((tr) => (
                <tr key={tr.id}>
                  <td className={tr.side}>{tr.side === 'sell' ? t('Eladás') : t('Vétel')}</td>
                  <td>{tr.day}</td>
                  <td>
                    {fmtQty(tr.qty)} × {fmtMoney(tr.paid ?? tr.price, tr.paidCurrency || p.currency)}
                    {tr.paidCurrency && tr.paidCurrency !== p.currency && <span className="muted"> ≈ {fmtMoney(tr.price, p.currency)}</span>}
                  </td>
                  <td>
                    <button type="button" className="icon-btn danger" onClick={() => onDelete(tr)} aria-label={t('Ügylet törlése')} title={t('Ügylet törlése')}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pf-detail-actions">
            <button type="button" className="btn btn-ghost sm" onClick={() => onTrade('buy')}>
              + {t('Vétel')}
            </button>
            {p.qty > 0 && (
              <button type="button" className="btn btn-ghost sm" onClick={() => onTrade('sell')}>
                − {t('Eladás')}
              </button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export default function Portfolio({ widget, onUpdateConfig }) {
  const refresh = Math.max(1, Number(widget.config.refreshMin) || 3) * 60_000;
  const { data, error, reload } = useWidgetData(`/widgets/${widget.id}/portfolio`, { interval: refresh });
  const [form, setForm] = useState(null); // null | { asset?, side?, price? } | { import: true }
  const [openKey, setOpenKey] = useState(null);
  const [showClosed, setShowClosed] = useState(false);
  const positions = useMemo(() => data?.positions ?? [], [data]);

  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('PORTFÓLIÓ BETÖLTÉSE…')}</div>;
  const { base, totals } = data;
  const empty = !positions.length && !data.closed.length;

  const remove = async (tr) => {
    if (!confirm(t('Törlöd ezt az ügyletet? ({side}, {qty} db)', { side: tr.side === 'sell' ? t('Eladás') : t('Vétel'), qty: fmtQty(tr.qty) }))) return;
    await api.del(`/items/${tr.id}`);
    reload();
  };
  const trade = (p, side) => setForm({ asset: p.asset, side, price: p.price != null ? String(+p.price.toFixed(4)) : '' });

  return (
    <div className="pf">
      {!empty && (
        <div className="pf-top">
          <div className="pf-total">
            <span className="pf-head">
              <span className="eyebrow">{t('Portfólió értéke')}</span>
              <span className="pf-cur" role="group" aria-label={t('Pénznem')}>
                {BASES.map(([code, label]) => (
                  <button key={code} type="button" className={base === code ? 'on' : ''} aria-pressed={base === code} onClick={() => onUpdateConfig?.({ base: code })} title={code}>
                    {label}
                  </button>
                ))}
              </span>
            </span>
            <span className="big-num">{fmtMoney(totals.value, base)}</span>
            <span className="pf-line">
              <Trend change={totals.unrealizedPct} />
              <span className={totals.unrealized >= 0 ? 'pos' : 'neg'}>{signed(totals.unrealized, base)}</span>
              <span className="muted">· {t('Ma')}</span>
              <span className={totals.dayChange >= 0 ? 'pos' : 'neg'}>{signed(totals.dayChange, base)}</span>
            </span>
            {totals.realized !== 0 && (
              <span className="muted small">
                {t('Realizált nyereség')}: <b className={totals.realized >= 0 ? 'pos' : 'neg'}>{signed(totals.realized, base)}</b>
              </span>
            )}
          </div>
          {data.history.length > 1 && <Sparkline values={data.history.map((h) => h.value)} height={44} fill className="pf-spark" />}
        </div>
      )}
      {positions.length > 1 && (
        <>
          <div className="pf-alloc" aria-label={t('Eloszlás')}>
            {positions
              .filter((p) => p.weight > 0)
              .map((p, i) => (
                <i key={p.key} style={{ width: `${p.weight}%`, '--c': colour(i) }} title={`${p.asset.symbol} ${p.weight.toFixed(1)}%`} />
              ))}
          </div>
          <div className="pf-legend">
            {positions
              .filter((p) => p.weight > 0)
              .map((p, i) => (
                <span key={p.key} style={{ '--c': colour(i) }}>
                  <i />
                  {p.asset.symbol} {p.weight.toFixed(p.weight < 10 ? 1 : 0)}%
                </span>
              ))}
          </div>
        </>
      )}
      {totals.missing && <div className="muted small">{t('Néhány papírnak most nincs ára, ezek nincsenek benne az összegben.')}</div>}

      {form?.import ? (
        <ImportPanel
          widgetId={widget.id}
          onCancel={() => setForm(null)}
          onDone={() => {
            setForm(null);
            reload();
          }}
        />
      ) : form ? (
        <TradeForm
          widgetId={widget.id}
          preset={form}
          positions={positions}
          onCancel={() => setForm(null)}
          onDone={() => {
            setForm(null);
            reload();
          }}
        />
      ) : empty ? (
        <div className="pf-empty">
          <p className="muted">{t('Add hozzá a részvényeidet: melyik papír, hány darab, milyen áron vetted. Később több vételt és eladást is rögzíthetsz.')}</p>
          <span className="pf-actions">
            <button className="btn btn-primary" onClick={() => setForm({})}>
              + {t('Első ügylet')}
            </button>
            <button className="btn btn-ghost" onClick={() => setForm({ import: true })}>
              📷 {t('Import képből')}
            </button>
          </span>
        </div>
      ) : (
        <div className="pf-actions">
          <button className="btn btn-primary sm" onClick={() => setForm({ side: 'buy' })}>
            + {t('Vétel')}
          </button>
          <button className="btn btn-ghost sm" onClick={() => setForm({ side: 'sell' })} disabled={!positions.length}>
            − {t('Eladás')}
          </button>
          <button className="btn btn-ghost sm" onClick={() => setForm({ import: true })} title={t('Ügyletek beolvasása képernyőképről')}>
            📷 {t('Képből')}
          </button>
        </div>
      )}

      {positions.length > 0 && (
        <ul className="pf-list">
          {positions.map((p) => (
            <Position key={p.key} p={p} base={base} open={openKey === p.key} onToggle={() => setOpenKey(openKey === p.key ? null : p.key)} onTrade={(side) => trade(p, side)} onDelete={remove} />
          ))}
        </ul>
      )}
      {data.closed.length > 0 && (
        <>
          <button type="button" className="btn btn-ghost sm pf-closed-btn" onClick={() => setShowClosed((v) => !v)}>
            {t('Lezárt pozíciók ({n})', { n: data.closed.length })} {showClosed ? '▴' : '▾'}
          </button>
          {showClosed && (
            <ul className="pf-list">
              {data.closed.map((p) => (
                <Position key={p.key} p={{ ...p, valueBase: p.realizedBase }} base={base} open={openKey === p.key} onToggle={() => setOpenKey(openKey === p.key ? null : p.key)} onTrade={(side) => trade(p, side)} onDelete={remove} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
