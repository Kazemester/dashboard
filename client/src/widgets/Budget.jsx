import React from 'react';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';
import { fmtMoney, useFinanceReload } from './Kpi.jsx';
import './finance.css';

export default function Budget({ widget, onConfigure }) {
  const { data, error, reload } = useWidgetData(`/widgets/${widget.id}/budget`, { interval: 10 * 60_000, deps: [JSON.stringify(widget.config)] });
  useFinanceReload(reload);
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('Betöltés…')}</div>;
  if (!data.tile)
    return (
      <div className="fin-empty">
        <span className="muted">{data.missing === 'tile' ? t('Nincs ilyen nevű Költségkövető') : t('Adj hozzá egy Költségkövető csempét a kiadásokhoz.')}</span>
      </div>
    );
  const cur = data.tile.currency;
  if (!data.limit)
    return (
      <div className="fin-empty">
        <span className="muted">{t('Nincs beállított keret.')}</span>
        <button className="btn btn-ghost sm" onClick={onConfigure}>
          {t('Keret megadása')}
        </button>
      </div>
    );
  const r = data.ratio;
  const level = r > 1 ? 'over' : r >= 0.85 ? 'warn' : data.spent > data.pace * 1.1 ? 'ahead' : 'ok';
  const status = { over: t('Keret felett'), warn: t('Közel a kerethez'), ahead: t('Gyorsabb a tervezettnél'), ok: t('Terv szerint') }[level];
  return (
    <div className={`fin-budget lvl-${level}`}>
      <div className="fin-bud-nums">
        <span className="fin-bud-spent">{fmtMoney(data.spent, cur)}</span>
        <span className="fin-bud-of">
          {t('elköltve')} / {fmtMoney(data.limit, cur)}
        </span>
      </div>
      <div className="fin-bud-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(r * 100)}>
        <div className="fin-bud-fill" style={{ width: `${Math.min(100, r * 100)}%` }} />
        {data.pace > 0 && data.pace < data.limit && <div className="fin-bud-pace" style={{ left: `${(data.pace / data.limit) * 100}%` }} title={t('Egyenletes tempó mai állása')} />}
      </div>
      <div className="fin-bud-meta">
        <span className={`fin-bud-status ${level}`}>
          {Math.round(r * 100)}% · {status}
        </span>
        <span>{data.left >= 0 ? t('{v} maradt', { v: fmtMoney(data.left, cur) }) : t('{v} túllépés', { v: fmtMoney(-data.left, cur) })}</span>
      </div>
      <div className="fin-bud-stats">
        <div>
          <div className="fin-stat-v">{data.daysLeft}</div>
          <div className="fin-stat-l">{t('nap van hátra')}</div>
        </div>
        <div>
          <div className="fin-stat-v">{fmtMoney(data.daily, cur, 0)}</div>
          <div className="fin-stat-l">{t('költhető naponta')}</div>
        </div>
      </div>
    </div>
  );
}
