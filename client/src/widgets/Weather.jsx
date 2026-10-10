import React from 'react';
import { useWidgetData } from '../hooks.js';

// WMO weather codes → icon + label
const WMO = {
  0: ['☀️', 'Derült'], 1: ['🌤️', 'Többnyire derült'], 2: ['⛅', 'Részben felhős'], 3: ['☁️', 'Borult'],
  45: ['🌫️', 'Köd'], 48: ['🌫️', 'Zúzmarás köd'], 51: ['🌦️', 'Szitálás'], 53: ['🌦️', 'Szitálás'], 55: ['🌦️', 'Erős szitálás'],
  61: ['🌧️', 'Gyenge eső'], 63: ['🌧️', 'Eső'], 65: ['🌧️', 'Erős eső'], 66: ['🌧️', 'Ónos eső'], 67: ['🌧️', 'Ónos eső'],
  71: ['🌨️', 'Gyenge havazás'], 73: ['🌨️', 'Havazás'], 75: ['❄️', 'Erős havazás'], 77: ['🌨️', 'Hószemcse'],
  80: ['🌦️', 'Zápor'], 81: ['🌧️', 'Zápor'], 82: ['⛈️', 'Heves zápor'], 85: ['🌨️', 'Hózápor'], 86: ['🌨️', 'Hózápor'],
  95: ['⛈️', 'Zivatar'], 96: ['⛈️', 'Zivatar jégesővel'], 99: ['⛈️', 'Zivatar jégesővel'],
};
const wmo = (c) => WMO[c] ?? ['🛰️', `Kód ${c}`];

export default function Weather({ widget }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/weather`, { interval: 10 * 60_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">LÉGKÖRI ADATOK…</div>;
  const c = data.current;
  const [icon, label] = wmo(c.weather_code);
  return (
    <div className="weather">
      <div className="weather-now">
        <div className="weather-icon">{icon}</div>
        <div>
          <div className="big-num">{Math.round(c.temperature_2m)}°</div>
          <div className="muted">
            {label} · hőérzet {Math.round(c.apparent_temperature)}°
          </div>
        </div>
        <div className="weather-meta">
          <div className="eyebrow">{data.place}</div>
          <div>💧 {c.relative_humidity_2m}%</div>
          <div>🌬 {Math.round(c.wind_speed_10m)} km/h</div>
        </div>
      </div>
      <div className="weather-days">
        {data.daily.time.map((d, i) => (
          <div key={d} className="wday">
            <span className="eyebrow">{i === 0 ? 'MA' : new Date(d).toLocaleDateString('hu-HU', { weekday: 'short' }).toUpperCase()}</span>
            <span className="wday-icon">{wmo(data.daily.weather_code[i])[0]}</span>
            <span>
              {Math.round(data.daily.temperature_2m_max[i])}° <span className="muted">{Math.round(data.daily.temperature_2m_min[i])}°</span>
            </span>
            <span className="muted sm">☔ {data.daily.precipitation_probability_max[i] ?? 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
