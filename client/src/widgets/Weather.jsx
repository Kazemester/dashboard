import React from 'react';
import { useWidgetData } from '../hooks.js';
import { t, locale } from '../i18n.js';

// WMO weather codes → monochrome glyph + label
const T = '\uFE0E';
const SUN = `☀${T}`, CLOUD = `☁${T}`, RAIN = `☂${T}`, SNOW = `❄${T}`, FOG = '≋', STORM = 'ϟ';
const WMO = {
  0: [SUN, 'Derült'], 1: [SUN, 'Többnyire derült'], 2: [CLOUD, 'Részben felhős'], 3: [CLOUD, 'Borult'],
  45: [FOG, 'Köd'], 48: [FOG, 'Zúzmarás köd'], 51: [RAIN, 'Szitálás'], 53: [RAIN, 'Szitálás'], 55: [RAIN, 'Erős szitálás'],
  61: [RAIN, 'Gyenge eső'], 63: [RAIN, 'Eső'], 65: [RAIN, 'Erős eső'], 66: [RAIN, 'Ónos eső'], 67: [RAIN, 'Ónos eső'],
  71: [SNOW, 'Gyenge havazás'], 73: [SNOW, 'Havazás'], 75: [SNOW, 'Erős havazás'], 77: [SNOW, 'Hószemcse'],
  80: [RAIN, 'Zápor'], 81: [RAIN, 'Zápor'], 82: [STORM, 'Heves zápor'], 85: [SNOW, 'Hózápor'], 86: [SNOW, 'Hózápor'],
  95: [STORM, 'Zivatar'], 96: [STORM, 'Zivatar jégesővel'], 99: [STORM, 'Zivatar jégesővel'],
};
const wmo = (c) => (WMO[c] ? [WMO[c][0], t(WMO[c][1])] : ['·', t('Kód {c}', { c })]);

export default function Weather({ widget }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/weather`, { interval: 10 * 60_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('LÉGKÖRI ADATOK…')}</div>;
  const c = data.current;
  const [icon, label] = wmo(c.weather_code);
  return (
    <div className="weather">
      <div className="weather-now">
        <div className="weather-icon">{icon}</div>
        <div>
          <div className="big-num">{Math.round(c.temperature_2m)}°</div>
          <div className="muted">
            {label} · {t('hőérzet')} {Math.round(c.apparent_temperature)}°
          </div>
        </div>
        <div className="weather-meta">
          <div className="eyebrow">{data.place}</div>
          <div><span className="muted">{t('PÁRA')}</span> {c.relative_humidity_2m}%</div>
          <div><span className="muted">{t('SZÉL')}</span> {Math.round(c.wind_speed_10m)} km/h</div>
        </div>
      </div>
      <div className="weather-days">
        {data.daily.time.map((d, i) => (
          <div key={d} className="wday">
            <span className="eyebrow">{i === 0 ? t('MA') : new Date(d).toLocaleDateString(locale(), { weekday: 'short' }).toUpperCase()}</span>
            <span className="wday-icon">{wmo(data.daily.weather_code[i])[0]}</span>
            <span>
              {Math.round(data.daily.temperature_2m_max[i])}° <span className="muted">{Math.round(data.daily.temperature_2m_min[i])}°</span>
            </span>
            <span className="muted sm">{data.daily.precipitation_probability_max[i] ?? 0}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
