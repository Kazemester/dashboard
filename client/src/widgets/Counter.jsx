import React from 'react';
import { useItems, isoDay, fmtNum } from '../hooks.js';
import { t } from '../i18n.js';

export default function Counter({ widget }) {
  const cfg = widget.config;
  const goal = Number(cfg.goal) || 0;
  const step = Number(cfg.step) || 1;
  const from = isoDay(Date.now() - 13 * 86400_000);
  const { items, error, setDay } = useItems(widget.id, `kind=count&from=${from}`);
  if (error) return <div className="w-error">{error}</div>;
  if (!items) return <div className="loading">{t('BETÖLTÉS…')}</div>;

  const today = isoDay(new Date());
  const byDay = Object.fromEntries(items.map((i) => [i.day, i.value]));
  const value = byDay[today] ?? 0;
  const days = Array.from({ length: 14 }, (_, i) => isoDay(Date.now() - (13 - i) * 86400_000));
  const max = Math.max(goal, ...days.map((d) => byDay[d] ?? 0), 1);
  const hits = days.filter((d) => goal && (byDay[d] ?? 0) >= goal).length;

  return (
    <div className="counter">
      <div className="counter-main">
        <button className="counter-btn" onClick={() => setDay(today, 'count', Math.max(0, value - step))}>
          −
        </button>
        <div className="counter-val">
          <span className="big-num">{fmtNum(value, step % 1 ? 1 : 0)}</span>
          <span className="muted">
            {goal ? ` / ${goal}` : ''} {cfg.unit}
          </span>
        </div>
        <button className="counter-btn plus" onClick={() => setDay(today, 'count', value + step)}>
          +
        </button>
      </div>
      {goal > 0 && (
        <div className="bar">
          <div className="bar-fill" style={{ width: `${Math.min(100, (value / goal) * 100)}%` }} />
        </div>
      )}
      <div className="counter-hist" title={t('Elmúlt 14 nap')}>
        {days.map((d) => {
          const v = byDay[d] ?? 0;
          return (
            <span key={d} className={`${goal && v >= goal ? 'hit' : ''} ${d === today ? 'today' : ''}`} style={{ height: `${Math.max(4, (v / max) * 100)}%` }} title={`${d}: ${v}`} />
          );
        })}
      </div>
      {goal > 0 && <div className="eyebrow center-text-sm">{t('CÉL TELJESÍTVE {hits}/14 NAPON', { hits })}</div>}
    </div>
  );
}
