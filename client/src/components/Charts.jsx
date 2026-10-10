import React from 'react';

// Tiny dependency-free SVG charts in the HUD style.
export function Sparkline({ values, height = 28, className = '', fill = false }) {
  const v = values.filter((x) => x != null && !isNaN(x));
  if (v.length < 2) return <svg className={`spark-line ${className}`} viewBox="0 0 100 20" />;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const pts = v.map((x, i) => [(i / (v.length - 1)) * 100, 19 - ((x - min) / (max - min || 1)) * 18]);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
  return (
    <svg className={`spark-line ${className}`} viewBox="0 0 100 20" preserveAspectRatio="none" style={{ height }}>
      {fill && <path d={`${d} L100,20 L0,20 Z`} className="spark-area" />}
      <path d={d} className="spark-path" />
    </svg>
  );
}

// Line chart with min/max labels and an optional goal line. points: [{ x: label, y: number }]
export function LineChart({ points, goal, unit = '', height = 120, digits = 1 }) {
  if (points.length < 2) return <div className="muted sm center-text">Legalább két mérés kell a grafikonhoz.</div>;
  const ys = points.map((p) => p.y).concat(goal != null && goal !== '' ? [Number(goal)] : []);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const pad = (max - min) * 0.1 || 1;
  const lo = min - pad;
  const hi = max + pad;
  const W = 300;
  const H = 100;
  const X = (i) => (i / (points.length - 1)) * W;
  const Y = (y) => H - ((y - lo) / (hi - lo)) * H;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  return (
    <div className="line-chart" style={{ height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} className="lc-grid" />
        ))}
        {goal != null && goal !== '' && <line x1="0" x2={W} y1={Y(Number(goal))} y2={Y(Number(goal))} className="lc-goal" />}
        <path d={`${d} L${W},${H} L0,${H} Z`} className="spark-area" />
        <path d={d} className="spark-path" />
        <circle cx={X(points.length - 1)} cy={Y(last.y)} r="2.5" className="lc-dot" />
      </svg>
      <span className="lc-label lc-max">{max.toFixed(digits)}{unit}</span>
      <span className="lc-label lc-min">{min.toFixed(digits)}{unit}</span>
      <span className="lc-label lc-from">{points[0].x}</span>
      <span className="lc-label lc-to">{last.x}</span>
    </div>
  );
}

// Thin ring gauge, value 0..100
export function Ring({ value, label, sub, size = 84 }) {
  const R = 40;
  const C = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <div className="gauge" style={{ width: size }}>
      <svg viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={R} className="ring-bg" />
        <circle cx="50" cy="50" r={R} className={`ring-fg ${v > 85 ? 'hot' : ''}`} strokeDasharray={C} strokeDashoffset={C * (1 - v / 100)} transform="rotate(-90 50 50)" />
      </svg>
      <div className="gauge-val">{value == null ? '–' : `${Math.round(v)}%`}</div>
      <div className="gauge-lbl">{label}</div>
      {sub && <div className="gauge-sub">{sub}</div>}
    </div>
  );
}
