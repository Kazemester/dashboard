import React, { useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import { locale, t } from '../i18n.js';

/*
 * Heti áttekintés: the weekly review the server writes on Sunday evening (reviews.js) — the latest one open,
 * earlier ones a tap away; "Készíts most" makes one for the last 7 days.
 */
const span = (r) => `${new Date(`${r.from}T12:00:00`).toLocaleDateString(locale(), { month: 'short', day: 'numeric' })} – ${new Date(`${r.to}T12:00:00`).toLocaleDateString(locale(), { month: 'short', day: 'numeric' })}`;

export default function Review() {
  const { data, error, reload } = useWidgetData('/reviews', { interval: 30 * 60_000 });
  const [pick, setPick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      await api.postJob('/reviews/run');
      setPick(0);
      await reload();
    } catch (e) {
      setErr(e.message);
    }
    setBusy(false);
  };
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('BETÖLTÉS…')}</div>;
  const r = data[pick];
  return (
    <div className="review">
      <div className="review-top">
        {data.length > 0 ? (
          <select className="input sm" value={pick} onChange={(e) => setPick(Number(e.target.value))} aria-label={t('Hét')}>
            {data.map((x, i) => (
              <option key={x.to} value={i}>
                {span(x)}
              </option>
            ))}
          </select>
        ) : (
          <span className="muted small">{t('Még nincs áttekintés.')}</span>
        )}
        <button className="btn btn-ghost sm" onClick={run} disabled={busy}>
          {busy ? t('Írom… (AI-val pár perc is lehet)') : t('Készíts most')}
        </button>
      </div>
      {err && <div className="w-error sm">{err}</div>}
      {r ? (
        <>
          <div className="review-text">{r.text}</div>
          <div className="review-stats">
            {r.data?.mood?.average != null && <span className="chip chip-static">{t('Hangulat')} {r.data.mood.average}/5</span>}
            {r.data?.health?.steps_avg != null && <span className="chip chip-static">{t('Lépés')} ⌀ {Number(r.data.health.steps_avg).toLocaleString(locale())}</span>}
            {r.data?.spending?.total != null && <span className="chip chip-static">{t('Kiadás')} {Number(r.data.spending.total).toLocaleString(locale())}</span>}
            {r.data?.portfolio?.change_pct != null && <span className="chip chip-static">{t('Portfólió')} {r.data.portfolio.change_pct > 0 ? '+' : ''}{r.data.portfolio.change_pct}%</span>}
          </div>
        </>
      ) : (
        <p className="muted small">{t('Vasárnap este magától elkészül (a csengőben állítható), vagy kérj egyet most. A szokások, hangulat, kiadások, egészség-adatok és a portfólió alapján írja.')}</p>
      )}
    </div>
  );
}
