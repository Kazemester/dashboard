import React from 'react';
import { useWidgetData, fmtNum } from '../hooks.js';
import { Sparkline, Tick } from '../components/Charts.jsx';

const SYM = { usd: '$', eur: '€', huf: 'Ft', gbp: '£' };

export default function Crypto({ widget }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/crypto`, { interval: 2 * 60_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">PIACI ADATOK…</div>;
  const sym = SYM[data.currency] ?? data.currency.toUpperCase();
  const pre = ['$', '€', '£'].includes(sym);
  return (
    <ul className="crypto">
      {data.coins.map((c) => {
        const up = (c.change24h ?? 0) >= 0;
        const digits = c.price < 1 ? 4 : c.price < 100 ? 2 : 0;
        return (
          <li key={c.id}>
            <div className="crypto-name">
              <span className="crypto-sym">{c.symbol}</span>
              <span className="muted sm">{c.name}</span>
            </div>
            <Sparkline values={c.spark} height={24} className={up ? 'up' : 'down'} />
            <div className="crypto-price">
              <Tick value={c.price}>
                {pre && sym}
                {fmtNum(c.price, digits)}
                {!pre && ` ${sym}`}
              </Tick>
              <span className={`crypto-chg ${up ? 'up' : 'down'}`}>
                {up ? '▲' : '▼'} {Math.abs(c.change24h ?? 0).toFixed(2)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
