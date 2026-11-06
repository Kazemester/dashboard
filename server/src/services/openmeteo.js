import { cached, HttpError } from '../util.js';

// Shared Open-Meteo helpers (no API key needed).
export function geocode(city) {
  return cached(`geo:${city}`, 24 * 3600_000, async () => {
    const geo = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?count=1&language=hu&name=${encodeURIComponent(city)}`,
    ).then((x) => x.json());
    const place = geo.results?.[0];
    if (!place) throw new HttpError(404, `City not found: ${city}`);
    return { name: `${place.name}, ${place.country_code}`, lat: place.latitude, lon: place.longitude };
  });
}

export function weather(city) {
  return cached(`weather:${city}`, 10 * 60_000, async () => {
    const p = await geocode(city);
    const fc = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${p.lat}&longitude=${p.lon}` +
        '&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day' +
        '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,daylight_duration,uv_index_max' +
        '&timezone=auto&forecast_days=5',
    ).then((x) => x.json());
    if (fc.error) throw new HttpError(502, fc.reason);
    return { place: p.name, current: fc.current, daily: fc.daily };
  });
}

export function airQuality(city) {
  return cached(`air:${city}`, 20 * 60_000, async () => {
    const p = await geocode(city);
    const aq = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${p.lat}&longitude=${p.lon}` +
        '&current=european_aqi,pm2_5,pm10,nitrogen_dioxide,ozone,uv_index,alder_pollen,birch_pollen,grass_pollen,mugwort_pollen,olive_pollen,ragweed_pollen' +
        '&hourly=european_aqi&forecast_days=2&timezone=auto',
    ).then((x) => x.json());
    if (aq.error) throw new HttpError(502, aq.reason);
    return { place: p.name, current: aq.current, hourly: aq.hourly };
  });
}

// WMO weather code → short Hungarian description
const WMO = {
  0: 'derült', 1: 'többnyire derült', 2: 'részben felhős', 3: 'borult', 45: 'köd', 48: 'zúzmarás köd',
  51: 'szitálás', 53: 'szitálás', 55: 'erős szitálás', 61: 'gyenge eső', 63: 'eső', 65: 'erős eső', 66: 'ónos eső', 67: 'ónos eső',
  71: 'gyenge havazás', 73: 'havazás', 75: 'erős havazás', 77: 'hószemcse', 80: 'zápor', 81: 'zápor', 82: 'heves zápor',
  85: 'hózápor', 86: 'hózápor', 95: 'zivatar', 96: 'zivatar jégesővel', 99: 'zivatar jégesővel',
};
export const wmoText = (code) => WMO[code] ?? `kód ${code}`;
