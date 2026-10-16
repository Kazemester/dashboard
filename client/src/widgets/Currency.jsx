import React, { useState } from 'react';
import { useWidgetData, fmtNum } from '../hooks.js';

export default function Currency({ widget }) {
  const cfg = widget.config;
  const [from, setFrom] = useState(cfg.from || 'EUR');
  const [to, setTo] = useState(cfg.to || 'HUF');
  const [amount, setAmount] = useState('100');
  const { data, error } = useWidgetData(`/fx?base=${from}`, { interval: 3600_000 });
  const watch = String(cfg.watch || 'USD, GBP, CHF, HUF').split(',').map((c) => c.trim().toUpperCase()).filter((c) => c && c !== from);

  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">ÁRFOLYAMOK…</div>;
  const codes = [data.base, ...Object.keys(data.rates)].sort();
  const rate = to === from ? 1 : data.rates[to];
  const n = Number(String(amount).replace(/\s/g, '').replace(',', '.')) || 0;
  const digits = (v) => (v >= 100 ? 2 : 4);

  return (
    <div className="fx">
      <div className="fx-row">
        <input className="input fx-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        <select className="input fx-cur" value={from} onChange={(e) => setFrom(e.target.value)}>
          {codes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <button
          className="icon-btn"
          title="Csere"
          onClick={() => {
            setFrom(to);
            setTo(from);
          }}
        >
          ⇄
        </button>
        <select className="input fx-cur" value={to} onChange={(e) => setTo(e.target.value)}>
          {codes.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="fx-result">
        <span className="big-num">{rate ? fmtNum(n * rate, 2) : '–'}</span>
        <span className="muted"> {to}</span>
      </div>
      <div className="eyebrow">
        1 {from} = {rate ? fmtNum(rate, digits(rate)) : '–'} {to} · EKB {data.date}
      </div>
      <ul className="fx-watch">
        {watch
          .filter((c) => data.rates[c])
          .map((c) => (
            <li key={c}>
              <span className="mono">{c}</span>
              <span>{fmtNum(data.rates[c], digits(data.rates[c]))}</span>
            </li>
          ))}
      </ul>
    </div>
  );
}
