import React from 'react';
import './health.css';
import { isoDay, useWidgetData } from '../hooks.js';
import { Sparkline } from '../components/Charts.jsx';
import { locale, t } from '../i18n.js';

/*
 * Egészség: steps, sleep, weight… sent by an iPhone Shortcut from Apple Health (POST /api/hook/health).
 * The setup guide opens from here (and from the bell).
 */
const openGuide = () => window.dispatchEvent(new CustomEvent('nexus:shortcuts', { detail: { focus: 'health' } }));
const fmt = (v, d = 0) => (v == null ? '–' : Number(v).toLocaleString(locale(), { maximumFractionDigits: d }));

export default function Health({ widget }) {
  const from = isoDay(new Date(Date.now() - 30 * 86_400_000));
  const { data, error } = useWidgetData(`/widgets/${widget.id}/items?kind=health&from=${from}`, { interval: 10 * 60_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('BETÖLTÉS…')}</div>;
  const days = [...data].sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const last = days.at(-1);
  const goal = Number(widget.config.stepsGoal) || 8000;

  if (!last)
    return (
      <div className="hl hl-empty">
        <p className="muted">{t('Még nincs adat. Egy iPhone Parancs automatizálás minden este átküldi az Egészség app adatait (lépés, alvás, súly…).')}</p>
        <button className="btn btn-primary sm" onClick={openGuide}>
          📱 {t('Beállítás iPhone-on')}
        </button>
      </div>
    );

  const d = last.data;
  const series = (k) => days.map((x) => x.data[k]).filter((v) => v != null);
  const stepsPct = d.steps != null ? Math.min(100, (d.steps / goal) * 100) : 0;
  const isToday = last.day === isoDay(new Date());
  return (
    <div className="hl">
      <div className="hl-steps">
        <span className="eyebrow">{isToday ? t('Ma') : last.day}</span>
        <span className="big-num">{fmt(d.steps)}</span>
        <span className="muted small">{t('lépés · cél {goal}', { goal: fmt(goal) })}</span>
        <div className="hl-bar">
          <i style={{ width: `${stepsPct}%` }} />
        </div>
      </div>
      <div className="hl-grid">
        {[
          ['sleep', t('Alvás'), (v) => `${fmt(v, 1)} ${t('óra')}`],
          ['weight', t('Súly'), (v) => `${fmt(v, 1)} kg`],
          ['kcal', t('Aktív energia'), (v) => `${fmt(v)} kcal`],
          ['hr', t('Nyugalmi pulzus'), (v) => `${fmt(v)} bpm`],
          ['km', t('Távolság'), (v) => `${fmt(v, 1)} km`],
        ]
          .filter(([k]) => d[k] != null || series(k).length)
          .map(([k, label, show]) => (
            <div key={k} className="hl-cell">
              <span className="muted small">{label}</span>
              <b>{d[k] != null ? show(d[k]) : '–'}</b>
              {series(k).length > 2 && <Sparkline values={series(k)} height={22} />}
            </div>
          ))}
      </div>
      {series('steps').length > 2 && (
        <div className="hl-hist">
          <span className="muted small">{t('Lépés, {n} nap', { n: series('steps').length })}</span>
          <Sparkline values={series('steps')} height={34} fill />
        </div>
      )}
      <div className="hl-foot muted small">
        <span>
          {t('Szinkron')}: {d.at ? new Date(d.at).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '–'}
        </span>
        <button type="button" className="link-btn" onClick={openGuide}>
          📱 {t('Beállítás')}
        </button>
      </div>
    </div>
  );
}
