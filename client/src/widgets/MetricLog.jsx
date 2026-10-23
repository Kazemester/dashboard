import React, { useState } from 'react';
import { useItems, isoDay, fmtNum } from '../hooks.js';
import { LineChart } from '../components/Charts.jsx';
import { t } from '../i18n.js';

export default function MetricLog({ widget, editing }) {
  const cfg = widget.config;
  const digits = Number(cfg.decimals ?? 1);
  const range = Number(cfg.rangeDays) || 90;
  const { items, error, setDay, remove } = useItems(widget.id, `kind=metric&from=${isoDay(Date.now() - range * 86400_000)}`);
  const [val, setVal] = useState('');
  const [day, setDayInput] = useState(isoDay(new Date()));

  if (error) return <div className="w-error">{error}</div>;
  if (!items) return <div className="loading">{t('BETÖLTÉS…')}</div>;
  const sorted = [...items].sort((a, b) => a.day.localeCompare(b.day));
  const last = sorted[sorted.length - 1];
  const prev = sorted[sorted.length - 2];
  const delta = last && prev ? last.value - prev.value : null;
  const first = sorted[0];
  const total = last && first && last !== first ? last.value - first.value : null;

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(String(val).replace(',', '.'));
    if (val === '' || isNaN(n)) return;
    await setDay(day, 'metric', n);
    setVal('');
  };

  return (
    <div className="metric">
      <div className="metric-top">
        <div>
          <span className="big-num">{last ? fmtNum(last.value, digits) : '–'}</span>
          <span className="muted"> {cfg.unit}</span>
        </div>
        <div className="metric-deltas">
          {delta != null && (
            <span className={delta > 0 ? 'up' : delta < 0 ? 'down' : ''}>
              {delta > 0 ? '▲' : delta < 0 ? '▼' : '■'} {fmtNum(Math.abs(delta), digits)} {t('előzőhöz')}
            </span>
          )}
          {total != null && (
            <span className="muted">
              {total > 0 ? '+' : ''}
              {fmtNum(total, digits)} / {t('{n} nap', { n: range })}
            </span>
          )}
          {cfg.goal !== undefined && cfg.goal !== '' && last && (
            <span className="muted">
              {t('cél: {goal} ({left} van hátra)', { goal: cfg.goal, left: fmtNum(Math.abs(last.value - cfg.goal), digits) })}
            </span>
          )}
        </div>
      </div>
      <LineChart points={sorted.map((i) => ({ x: i.day.slice(5).replace('-', '.'), y: i.value }))} goal={cfg.goal} unit={cfg.unit ? ` ${cfg.unit}` : ''} digits={digits} />
      {editing && sorted.length > 0 && (
        <div className="chips">
          {sorted.slice(-8).map((i) => (
            <button key={i.id} className="chip" onClick={() => remove(i.id)} title={t('Törlés')}>
              {i.day.slice(5)} {i.value} ✕
            </button>
          ))}
        </div>
      )}
      <form className="row gap" onSubmit={submit}>
        <input className="input sm grow" inputMode="decimal" placeholder={t('Új mérés ({unit})', { unit: cfg.unit || t('érték') })} value={val} onChange={(e) => setVal(e.target.value)} />
        <input className="input sm w-date" type="date" value={day} max={isoDay(new Date())} onChange={(e) => setDayInput(e.target.value)} />
        <button className="btn btn-ghost sm">+</button>
      </form>
    </div>
  );
}
