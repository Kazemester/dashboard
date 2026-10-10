import React from 'react';
import { useNow } from '../hooks.js';

export default function TimeProgress({ widget }) {
  const now = useNow(30_000);
  const y = now.getFullYear();
  const startOfDay = new Date(now.toDateString());
  const dow = (now.getDay() + 6) % 7;
  const startOfWeek = new Date(startOfDay.getTime() - dow * 86400_000);
  const rows = [
    ['NAP', (now - startOfDay) / 86400_000, `${23 - now.getHours()} óra van hátra`],
    ['HÉT', (now - startOfWeek) / (7 * 86400_000), `${6 - dow} nap van hátra`],
    ['HÓNAP', (now - new Date(y, now.getMonth(), 1)) / (new Date(y, now.getMonth() + 1, 1) - new Date(y, now.getMonth(), 1)), `${new Date(y, now.getMonth() + 1, 0).getDate() - now.getDate()} nap van hátra`],
    ['ÉV', (now - new Date(y, 0, 1)) / (new Date(y + 1, 0, 1) - new Date(y, 0, 1)), `${Math.ceil((new Date(y + 1, 0, 1) - now) / 86400_000)} nap van hátra`],
  ];
  const by = Number(widget.config.birthYear);
  if (by > 1900) {
    const exp = Number(widget.config.lifeExpectancy) || 80;
    const born = new Date(by, (Number(widget.config.birthMonth) || 1) - 1, 1);
    const age = (now - born) / (365.25 * 86400_000);
    rows.push(['ÉLET', age / exp, `${age.toFixed(1)} / ${exp} év`]);
  }
  return (
    <div className="timeprog">
      {rows.map(([label, f, sub]) => (
        <div key={label} className="tp-row">
          <div className="tp-top">
            <span className="eyebrow">{label}</span>
            <span className="tp-pct">{(f * 100).toFixed(label === 'ÉLET' ? 1 : 0)}%</span>
          </div>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${Math.min(100, f * 100)}%` }} />
          </div>
          <span className="tp-sub">{sub}</span>
        </div>
      ))}
    </div>
  );
}
