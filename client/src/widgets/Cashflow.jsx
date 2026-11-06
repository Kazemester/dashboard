import React, { useEffect, useRef, useState } from 'react';
import { useWidgetData } from '../hooks.js';
import { t, locale } from '../i18n.js';
import { fmtCompact, fmtMoney, useFinanceReload } from './Kpi.jsx';
import './finance.css';

// a "nice" axis step: 1, 2, 2.5 or 5 × 10^k giving about `n` gridlines
function niceStep(max, n = 4) {
  const raw = max / n;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 2.5, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? raw;
}

function useSize(ref) {
  const [s, setS] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setS({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);
  return s;
}

function Chart({ months, currency, uid }) {
  const box = useRef(null);
  const { w, h } = useSize(box);
  const [hover, setHover] = useState(null);
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const step = niceStep(max);
  const top = Math.ceil(max / step) * step;
  const padL = 34;
  const padB = 18;
  const padT = 6;
  const plotW = Math.max(0, w - padL);
  const plotH = Math.max(0, h - padB - padT);
  const band = months.length ? plotW / months.length : 0;
  const bw = Math.max(3, Math.min(18, (band - 6) / 2 - 1));
  const y = (v) => padT + plotH - (v / top) * plotH;
  const ticks = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(v);
  const label = (ym, short) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5)) - 1, 1).toLocaleDateString(locale(), short ? { month: 'short' } : { year: 'numeric', month: 'long' });
  const showEvery = band < 30 ? 2 : 1;
  const hm = hover != null ? months[hover] : null;
  // the tooltip sits beside the hovered month, flipped / clamped so it never leaves the chart
  const TIP = 170;
  const ax = hover != null ? padL + band * hover + band / 2 : 0;
  const tipLeft = ax + 10 + TIP > w && ax - 10 - TIP >= 0;
  const tipX = tipLeft ? ax : Math.max(0, Math.min(ax, w - TIP - 10));

  return (
    <div className="fin-cf-chart" ref={box} onMouseLeave={() => setHover(null)}>
      {w > 0 && h > 0 && (
        <svg width={w} height={h} role="img" aria-label={t('Bevétel és kiadás havonta')}>
          <defs>
            <pattern id={`fin-hatch-${uid}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="5" height="5" className="fin-cf-inc-bg" />
              <line x1="0" y1="0" x2="0" y2="5" className="fin-cf-inc-line" />
            </pattern>
          </defs>
          {ticks.map((v) => (
            <g key={v}>
              <line x1={padL} x2={w} y1={y(v)} y2={y(v)} className="fin-cf-grid" />
              <text x={padL - 6} y={y(v)} dy="0.32em" textAnchor="end" className="fin-cf-axis">
                {v === 0 ? '0' : fmtCompact(v)}
              </text>
            </g>
          ))}
          {months.map((m, i) => {
            const cx = padL + band * i + band / 2;
            const hi = (v) => Math.max(v > 0 ? 2 : 0, plotH * (v / top));
            const last = i === months.length - 1;
            return (
              <g key={m.ym} className={hover != null && hover !== i ? 'fin-cf-dim' : ''}>
                {hover === i && <rect x={cx - band / 2 + 1} y={padT} width={band - 2} height={plotH} className="fin-cf-hover" rx="4" />}
                <rect x={cx - bw - 1} y={y(0) - hi(m.income)} width={bw} height={hi(m.income)} rx={Math.min(4, bw / 2)} fill={`url(#fin-hatch-${uid})`} className="fin-cf-inc" />
                <rect x={cx + 1} y={y(0) - hi(m.expense)} width={bw} height={hi(m.expense)} rx={Math.min(4, bw / 2)} className="fin-cf-exp" />
                {(i % showEvery === (months.length - 1) % showEvery) && (
                  <text x={cx} y={h - 4} textAnchor="middle" className={`fin-cf-axis ${last ? 'cur' : ''}`}>
                    {label(m.ym, true)}
                  </text>
                )}
                <rect
                  x={cx - band / 2}
                  y={0}
                  width={band}
                  height={h}
                  fill="transparent"
                  onMouseEnter={() => setHover(i)}
                  onClick={() => setHover((x) => (x === i ? null : i))}
                />
              </g>
            );
          })}
        </svg>
      )}
      {hm && (
        <div className={`fin-cf-tip ${tipLeft ? 'left' : ''}`} style={{ left: tipX }}>
          <div className="fin-cf-tip-m">{label(hm.ym)}</div>
          <div className="fin-cf-tip-r">
            <i className="fin-key inc" /> {t('Bevétel')} <b>{fmtMoney(hm.income, currency)}</b>
          </div>
          <div className="fin-cf-tip-r">
            <i className="fin-key exp" /> {t('Kiadás')} <b>{fmtMoney(hm.expense, currency)}</b>
          </div>
          <div className={`fin-cf-tip-r net ${hm.income - hm.expense < 0 ? 'neg' : 'pos'}`}>
            {t('Egyenleg')} <b>{(hm.income - hm.expense > 0 ? '+' : '') + fmtMoney(hm.income - hm.expense, currency)}</b>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Cashflow({ widget }) {
  const { data, error, reload } = useWidgetData(`/widgets/${widget.id}/cashflow`, { interval: 15 * 60_000, deps: [JSON.stringify(widget.config)] });
  useFinanceReload(reload);
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('Betöltés…')}</div>;
  if (!data.tiles)
    return (
      <div className="fin-empty">
        <span className="muted">{t('Adj hozzá egy Költségkövető csempét a kiadásokhoz.')}</span>
      </div>
    );
  const cur = data.months[data.months.length - 1];
  return (
    <div className="fin-cashflow">
      <div className="fin-cf-head">
        <div>
          <div className="fin-cf-net-l">{t('Nettó ebben a hónapban')}</div>
          <div className={`fin-cf-net ${data.net < 0 ? 'neg' : ''}`}>{(data.net > 0 ? '+' : '') + fmtMoney(data.net, data.currency)}</div>
        </div>
        <div className="fin-cf-legend">
          <span>
            <i className="fin-key inc" /> {t('Bevétel')}
          </span>
          <span>
            <i className="fin-key exp" /> {t('Kiadás')}
          </span>
        </div>
      </div>
      <div className="fin-cf-sub">
        {t('Bevétel')} <b>{fmtMoney(cur.income, data.currency)}</b> · {t('Kiadás')} <b>{fmtMoney(cur.expense, data.currency)}</b>
      </div>
      <Chart months={data.months} currency={data.currency} uid={widget.id} />
    </div>
  );
}
