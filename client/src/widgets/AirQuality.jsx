import React from 'react';
import { useWidgetData } from '../hooks.js';
import { Sparkline } from '../components/Charts.jsx';

// European AQI bands
const AQI = [
  [20, 'Kiváló'],
  [40, 'Jó'],
  [60, 'Mérsékelt'],
  [80, 'Gyenge'],
  [100, 'Rossz'],
  [Infinity, 'Nagyon rossz'],
];
const POLLEN = [
  ['ragweed_pollen', 'Parlagfű'],
  ['grass_pollen', 'Fű'],
  ['birch_pollen', 'Nyír'],
  ['alder_pollen', 'Éger'],
  ['mugwort_pollen', 'Üröm'],
];
// grains/m³ → level
const pollenLevel = (v) => (v == null ? '–' : v < 1 ? 'nincs' : v < 10 ? 'alacsony' : v < 50 ? 'közepes' : v < 200 ? 'magas' : 'nagyon magas');

export default function AirQuality({ widget }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/air`, { interval: 20 * 60_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">LÉGKÖRI ADATOK…</div>;
  const c = data.current;
  const band = AQI.find(([max]) => c.european_aqi <= max)[1];
  const nowIdx = data.hourly.time.findIndex((t) => t >= c.time);
  const next = data.hourly.european_aqi.slice(Math.max(0, nowIdx), Math.max(0, nowIdx) + 24);
  const pollen = POLLEN.filter(([k]) => c[k] != null);

  return (
    <div className="air">
      <div className="air-top">
        <div>
          <span className="big-num">{c.european_aqi}</span>
          <span className="muted"> AQI</span>
          <div className={`air-band lvl-${AQI.findIndex(([max]) => c.european_aqi <= max)}`}>{band}</div>
        </div>
        <div className="air-meta">
          <div className="eyebrow">{data.place}</div>
          <div>
            <span className="muted">PM2.5</span> {c.pm2_5} µg
          </div>
          <div>
            <span className="muted">PM10</span> {c.pm10} µg
          </div>
          <div>
            <span className="muted">UV</span> {c.uv_index}
          </div>
        </div>
      </div>
      <div>
        <div className="eyebrow">KÖVETKEZŐ 24 ÓRA</div>
        <Sparkline values={next} height={26} fill />
      </div>
      {pollen.length > 0 && (
        <div className="pollen">
          {pollen.map(([k, label]) => (
            <div key={k} className={`pollen-row ${c[k] >= 10 ? 'warn' : ''}`}>
              <span>{label}</span>
              <span className="mono">{pollenLevel(c[k])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
