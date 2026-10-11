import React, { useState } from 'react';
import { useItems, isoDay } from '../hooks.js';

const LEVELS = [
  [1, 'Pocsék'],
  [2, 'Rossz'],
  [3, 'Oké'],
  [4, 'Jó'],
  [5, 'Szuper'],
];
const pad = (n) => String(n).padStart(2, '0');
const DOW = ['H', 'K', 'Sz', 'Cs', 'P', 'Sz', 'V'];

export default function Mood({ widget }) {
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const [y, m] = ym;
  const month = `${y}-${pad(m)}`;
  const daysIn = new Date(y, m, 0).getDate();
  const { items, error, setDay } = useItems(widget.id, `kind=mood&from=${month}-01&to=${month}-${pad(daysIn)}`);
  const today = isoDay(now);
  const [sel, setSel] = useState(today);

  if (error) return <div className="w-error">{error}</div>;
  const byDay = Object.fromEntries((items ?? []).map((i) => [i.day, i]));
  const lead = (new Date(y, m - 1, 1).getDay() + 6) % 7; // Monday-first offset
  const vals = Object.values(byDay).map((i) => i.value);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const shift = (d) => {
    const x = new Date(y, m - 1 + d, 1);
    setYm([x.getFullYear(), x.getMonth() + 1]);
  };
  const selItem = byDay[sel];

  return (
    <div className="mood">
      <div className="habit-nav between-full">
        <button className="icon-btn" onClick={() => shift(-1)}>
          ‹
        </button>
        <span className="habit-month">{new Date(y, m - 1, 1).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })}</span>
        <button className="icon-btn" onClick={() => shift(1)}>
          ›
        </button>
        <span className="eyebrow mood-avg">ÁTLAG {avg ? avg.toFixed(1) : '–'}</span>
      </div>
      <div className="mood-grid">
        {DOW.map((d, i) => (
          <span key={i} className="habit-dow">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }).map((_, i) => (
          <span key={`l${i}`} />
        ))}
        {Array.from({ length: daysIn }, (_, i) => {
          const d = `${month}-${pad(i + 1)}`;
          const v = byDay[d]?.value;
          return (
            <button
              key={d}
              className={`mood-day ${d === sel ? 'sel' : ''} ${d === today ? 'today' : ''}`}
              style={{ '--lvl': v ? v / 5 : 0, color: v >= 4 ? 'var(--bg)' : undefined }}
              disabled={d > today}
              onClick={() => setSel(d)}
              title={byDay[d]?.data?.note || d}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
      <div className="mood-pick">
        <span className="eyebrow">{sel === today ? 'MA' : sel.slice(5).replace('-', '.')}</span>
        {LEVELS.map(([v, label]) => (
          <button key={v} className={`mood-lvl ${selItem?.value === v ? 'on' : ''}`} style={{ '--lvl': v / 5 }} title={label} onClick={() => setDay(sel, 'mood', v, selItem?.data ?? {})}>
            <i />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
