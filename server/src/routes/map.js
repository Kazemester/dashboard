import { Router } from 'express';
import { cached, getWidget, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

/*
 * Data for the world-map tile. Every source is free and needs no key:
 *   flights   OpenSky Network (anonymous ~400 credits/day; an optional OAuth client gives much more)
 *   quakes    USGS earthquake feed
 *   news      GDELT DOC 2.0 (articles of the last day, grouped by the source's country)
 *   country   Nominatim reverse geocoding, world-countries (mledoze, via jsDelivr), Nager.Date (holidays), World Bank, open.er-api (rates)
 *   point     Open-Meteo forecast + air quality + elevation + marine
 *   events    NASA EONET (wildfires, volcanoes, storms, floods…)
 *   iss       wheretheiss.at (+ Open Notify crew list)
 *   aurora    NOAA SWPC OVATION model + planetary Kp index
 *   radar     RainViewer
 *   wiki      Wikipedia geosearch
 *   species   GBIF occurrences
 *   airports  OurAirports open data (via jsDelivr)
 *   bikes     CityBikes
 *   search    Open-Meteo geocoding
 * (map tiles and NASA GIBS / OpenSeaMap / OpenRailwayMap overlays are loaded by the browser directly.)
 */
const r = Router();
const UA = 'nexus-dashboard/1.0 (self-hosted personal dashboard)';

async function getJson(url, { headers = {}, ttl = 0, key = url, timeout = 15_000 } = {}) {
  const run = async () => {
    let res;
    try {
      res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json', ...headers }, signal: AbortSignal.timeout(timeout) });
    } catch (err) {
      throw new HttpError(502, `${new URL(url).host}: ${err.name === 'TimeoutError' ? 'timeout' : err.message}`);
    }
    if (res.status === 429) throw new HttpError(429, `${new URL(url).host}: rate limit reached, try again later`);
    if (!res.ok) throw new HttpError(502, `${new URL(url).host}: HTTP ${res.status}`);
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch {
      throw new HttpError(502, `${new URL(url).host}: unexpected answer`);
    }
  };
  return ttl ? cached(key, ttl, run) : run();
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const safeUrl = (u) => (/^https?:\/\//i.test(u ?? '') ? u : null);

// Country facts (names, capital, languages, currencies, centre) — the open mledoze/world-countries data set.
// (REST Countries now needs an API key.) ~1.4 MB, loaded once a week.
const countries = () =>
  cached('world-countries', 7 * 86_400_000, async () => {
    const list = await getJson('https://cdn.jsdelivr.net/npm/world-countries@5/countries.json', { timeout: 30_000 });
    if (!Array.isArray(list)) throw new HttpError(502, 'world-countries: unexpected answer');
    return list;
  });
const fold = (x) => String(x ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

// ---------- flights (OpenSky) ----------
let token = null; // { value, expires }
async function openskyAuth(config) {
  const id = resolveSecrets(config.openskyClientId || '');
  const secret = resolveSecrets(config.openskyClientSecret || '');
  if (!id || !secret) return {};
  if (!token || token.expires < Date.now() + 30_000) {
    const res = await fetch('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', client_id: id, client_secret: secret }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
    const body = res?.ok ? await res.json().catch(() => null) : null;
    if (!body?.access_token) throw new HttpError(400, 'OpenSky: the client id / secret was not accepted');
    token = { value: body.access_token, expires: Date.now() + (body.expires_in ?? 300) * 1000 };
  }
  return { authorization: `Bearer ${token.value}` };
}

r.get('/widgets/:id/map/flights', async (req, res) => {
  const w = await getWidget(req.params.id, 'worldmap');
  const [lamin, lomin, lamax, lomax] = ['lamin', 'lomin', 'lamax', 'lomax'].map((k) => num(req.query[k]));
  if ([lamin, lomin, lamax, lomax].some((v) => v == null)) throw new HttpError(400, 'lamin, lomin, lamax, lomax are required');
  const box = [Math.max(-90, lamin), Math.max(-180, lomin), Math.min(90, lamax), Math.min(180, lomax)].map((v) => Math.round(v));
  const authed = Boolean(w.config.openskyClientId);
  const data = await getJson(
    `https://opensky-network.org/api/states/all?lamin=${box[0]}&lomin=${box[1]}&lamax=${box[2]}&lomax=${box[3]}`,
    { ttl: 25_000, key: `flights:${authed}:${box.join(',')}`, headers: await openskyAuth(w.config) },
  );
  const planes = (data.states ?? [])
    .filter((s) => s[5] != null && s[6] != null)
    .map((s) => ({
      id: s[0],
      call: (s[1] || '').trim(),
      country: s[2],
      lon: s[5],
      lat: s[6],
      alt: s[7] ?? s[13] ?? null, // metres
      ground: Boolean(s[8]),
      speed: s[9], // m/s
      heading: s[10] ?? 0,
    }));
  // Keep the payload and the DOM small: airborne first, then a cap.
  planes.sort((a, b) => Number(a.ground) - Number(b.ground));
  res.json({ total: planes.length, planes: planes.slice(0, 700), time: data.time });
});

// ---------- earthquakes (USGS) ----------
r.get('/widgets/:id/map/quakes', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const feed = { day: '2.5_day', week: '4.5_week' }[req.query.range] ?? '2.5_day';
  const data = await getJson(`https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/${feed}.geojson`, { ttl: 5 * 60_000 });
  res.json(
    (data.features ?? []).map((f) => ({
      lon: f.geometry.coordinates[0],
      lat: f.geometry.coordinates[1],
      depth: f.geometry.coordinates[2],
      mag: f.properties.mag,
      place: f.properties.place,
      time: f.properties.time,
      url: f.properties.url,
    })),
  );
});

// ---------- news (GDELT DOC) ----------
// GDELT's GEO API is gone; the DOC API lists the day's articles with the country of the source,
// so the map shows one bubble per country (at its centre) with its newest articles.
r.get('/widgets/:id/map/news', async (req, res) => {
  const w = await getWidget(req.params.id, 'worldmap');
  const topic = String(req.query.q || w.config.newsQuery || '').trim();
  const query = topic || 'sourcelang:english';
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=artlist&format=json&maxrecords=250&timespan=24h&sort=datedesc`;
  const [data, list] = await Promise.all([getJson(url, { ttl: 20 * 60_000, timeout: 25_000 }), countries()]);
  const byName = new Map();
  for (const c of list) for (const n of [c.name?.common, c.name?.official, ...(c.altSpellings ?? [])]) if (n) byName.set(fold(n), c);
  const groups = new Map();
  for (const a of data.articles ?? []) {
    const c = byName.get(fold(a.sourcecountry));
    const link = safeUrl(a.url);
    if (!c?.latlng || !link || !a.title) continue;
    const g = groups.get(c.cca2) ?? { lat: c.latlng[0], lon: c.latlng[1], place: c.name.common, placeHu: c.translations?.hun?.common ?? null, count: 0, articles: [] };
    g.count += 1;
    if (g.articles.length < 6) g.articles.push({ title: a.title.trim(), url: link, domain: a.domain ?? '' });
    groups.set(c.cca2, g);
  }
  res.json([...groups.values()].sort((a, b) => b.count - a.count));
});

// ---------- country info (Nominatim + world-countries) ----------
r.get('/widgets/:id/map/country', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const lat = num(req.query.lat);
  const lon = num(req.query.lon);
  if (lat == null || lon == null) throw new HttpError(400, 'lat and lon are required');
  const geo = await getJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&addressdetails=1&accept-language=en&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`,
    { ttl: 3600_000 },
  );
  const code = geo.address?.country_code?.toUpperCase();
  if (!code) return res.json({ none: true }); // open sea
  const c = (await settled(countries()))?.find((x) => x.cca2 === code);
  res.json({
    code,
    name: c?.name?.common ?? geo.address.country,
    nameHu: c?.translations?.hun?.common ?? null,
    official: c?.name?.official ?? null,
    capital: c?.capital?.[0] ?? null,
    area: c?.area ?? null,
    region: [c?.region, c?.subregion].filter(Boolean).join(' · '),
    languages: Object.values(c?.languages ?? {}),
    currencyCodes: Object.keys(c?.currencies ?? {}),
    currencies: Object.entries(c?.currencies ?? {}).map(([k, x]) => `${x.name}${x.symbol ? ` (${x.symbol})` : ` (${k})`}`),
    flag: `https://flagcdn.com/${code.toLowerCase()}.svg`,
  });
});

// ---------- helpers for the extra layers ----------
const lang = (req) => (req.query.lang === 'en' ? 'en' : 'hu');
const coord = (req, ...keys) => {
  const out = keys.map((k) => num(req.query[k]));
  if (out.some((v) => v == null)) throw new HttpError(400, `${keys.join(', ')} are required`);
  return out;
};
// a viewport rounded to whole degrees (keeps the cache useful and the upstream query cheap)
const bbox = (req, step = 1) => {
  const [s, w, n, e] = coord(req, 'lamin', 'lomin', 'lamax', 'lomax');
  const r = (v, f) => f(v / step) * step;
  return [Math.max(-90, r(s, Math.floor)), Math.max(-180, r(w, Math.floor)), Math.min(90, r(n, Math.ceil)), Math.min(180, r(e, Math.ceil))];
};
const settled = (p) => p.then((value) => value, () => null);

// ---------- natural events (NASA EONET) ----------
const EVENT_GROUPS = { wildfires: ['wildfires'], volcanoes: ['volcanoes'], storms: ['severeStorms'] };
const centre = (g) => {
  if (g.type === 'Point') return g.coordinates;
  const ring = g.coordinates?.[0];
  if (!Array.isArray(ring) || !ring.length) return null;
  const pts = Array.isArray(ring[0][0]) ? ring[0] : ring;
  return [pts.reduce((a, p) => a + p[0], 0) / pts.length, pts.reduce((a, p) => a + p[1], 0) / pts.length];
};
r.get('/widgets/:id/map/events', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const group = ['wildfires', 'volcanoes', 'storms', 'hazards'].includes(req.query.group) ? req.query.group : 'hazards';
  const data = await getJson('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=500', { ttl: 15 * 60_000 });
  const known = new Set(Object.values(EVENT_GROUPS).flat());
  const out = [];
  for (const ev of data.events ?? []) {
    const cat = ev.categories?.[0];
    if (!cat) continue;
    const inGroup = group === 'hazards' ? !known.has(cat.id) : EVENT_GROUPS[group].includes(cat.id);
    const geo = ev.geometry?.[ev.geometry.length - 1];
    const c = geo && centre(geo);
    if (inGroup && c) out.push({ id: ev.id, title: ev.title, cat: cat.title, lon: c[0], lat: c[1], date: geo.date, link: safeUrl(ev.sources?.[0]?.url) ?? safeUrl(ev.link) });
  }
  res.json(out);
});

// ---------- International Space Station ----------
r.get('/widgets/:id/map/iss', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const now = await getJson('https://api.wheretheiss.at/v1/satellites/25544', { ttl: 4000 });
  const t0 = Math.floor(Date.now() / 1000);
  // ground track: 2 positions behind, 7 ahead, 10 minutes apart (one request, max 10 timestamps)
  const stamps = Array.from({ length: 10 }, (_, i) => t0 + (i - 2) * 600);
  const track = await settled(getJson(`https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${stamps.join(',')}`, { ttl: 5 * 60_000, key: `iss-track:${Math.floor(t0 / 300)}` }));
  const crew = await settled(getJson('http://api.open-notify.org/astros.json', { ttl: 3600_000 }));
  res.json({
    lat: now.latitude,
    lon: now.longitude,
    alt: now.altitude,
    speed: now.velocity,
    visibility: now.visibility,
    track: Array.isArray(track) ? track.map((p) => [p.latitude, p.longitude]) : [],
    crew: crew?.people?.filter((p) => p.craft === 'ISS').map((p) => p.name) ?? null,
  });
});

// ---------- aurora (NOAA SWPC) ----------
r.get('/widgets/:id/map/aurora', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const [oval, kp] = await Promise.all([
    getJson('https://services.swpc.noaa.gov/json/ovation_aurora_latest.json', { ttl: 10 * 60_000, timeout: 25_000 }),
    settled(getJson('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json', { ttl: 10 * 60_000 })),
  ]);
  const points = (oval.coordinates ?? [])
    .filter((p) => p[2] >= 6)
    .sort((a, b) => b[2] - a[2])
    .slice(0, 4500)
    .map(([lon, lat, v]) => [lat, lon > 180 ? lon - 360 : lon, v]);
  const last = Array.isArray(kp) ? kp[kp.length - 1] : null;
  res.json({ points, kp: last ? Number(last[1]) : null, forecastTime: oval['Forecast Time'] ?? null });
});

// ---------- rain radar (RainViewer) ----------
r.get('/widgets/:id/map/radar', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const d = await getJson('https://api.rainviewer.com/public/weather-maps.json', { ttl: 2 * 60_000 });
  const frame = d.radar?.past?.[d.radar.past.length - 1];
  if (!frame) throw new HttpError(502, 'RainViewer: no radar frame available');
  res.json({ tiles: `${d.host ?? 'https://tilecache.rainviewer.com'}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`, time: frame.time });
});

// ---------- Wikipedia articles near a point ----------
r.get('/widgets/:id/map/wiki', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const [lat, lon] = coord(req, 'lat', 'lon');
  const l = lang(req);
  const url = `https://${l}.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat.toFixed(3)}%7C${lon.toFixed(3)}&gsradius=10000&gslimit=60&format=json`;
  const d = await getJson(url, { ttl: 10 * 60_000 });
  res.json((d.query?.geosearch ?? []).map((p) => ({ id: p.pageid, title: p.title, lat: p.lat, lon: p.lon, dist: p.dist, url: `https://${l}.wikipedia.org/?curid=${p.pageid}` })));
});

// ---------- species sightings (GBIF) ----------
r.get('/widgets/:id/map/species', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const [s, w, n, e] = bbox(req, 0.25);
  const url = `https://api.gbif.org/v1/occurrence/search?hasCoordinate=true&mediaType=StillImage&limit=80&decimalLatitude=${s},${n}&decimalLongitude=${w},${e}`;
  const d = await getJson(url, { ttl: 5 * 60_000 });
  res.json(
    (d.results ?? [])
      .filter((o) => o.decimalLatitude != null && o.decimalLongitude != null)
      .map((o) => ({ key: o.key, name: o.vernacularName ?? null, sci: o.scientificName ?? o.species ?? '', lat: o.decimalLatitude, lon: o.decimalLongitude, date: o.eventDate ?? null, img: safeUrl(o.media?.[0]?.identifier) })),
  );
});

// ---------- airports (OurAirports open data) ----------
// The whole list (~12 MB CSV) is loaded once a week and filtered here: no rate limits, works at any zoom.
function csvRows(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++;
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') row.push(cell), (cell = '');
    else if (ch === '\n') row.push(cell), rows.push(row), (row = []), (cell = '');
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) row.push(cell), rows.push(row);
  return rows;
}
const airportList = () =>
  cached('ourairports', 7 * 86_400_000, async () => {
    let res;
    try {
      res = await fetch('https://cdn.jsdelivr.net/gh/davidmegginson/ourairports-data@main/airports.csv', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(60_000) });
    } catch (err) {
      throw new HttpError(502, `OurAirports: ${err.message}`);
    }
    if (!res.ok) throw new HttpError(502, `OurAirports: HTTP ${res.status}`);
    const [head, ...rows] = csvRows(await res.text());
    const col = Object.fromEntries(head.map((h, i) => [h, i]));
    return rows
      .filter((r) => (r[col.type] === 'large_airport' || r[col.type] === 'medium_airport') && r[col.iata_code])
      .map((r) => ({
        name: r[col.name],
        iata: r[col.iata_code],
        icao: r[col.icao_code] || null,
        city: r[col.municipality] || null,
        country: r[col.iso_country] || null,
        large: r[col.type] === 'large_airport',
        lat: Number(r[col.latitude_deg]),
        lon: Number(r[col.longitude_deg]),
        wiki: safeUrl(r[col.wikipedia_link]),
      }))
      .filter((a) => Number.isFinite(a.lat) && Number.isFinite(a.lon));
  });

r.get('/widgets/:id/map/airports', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const [s, w, n, e] = coord(req, 'lamin', 'lomin', 'lamax', 'lomax');
  const wide = (n - s) * (e - w) > 900; // a big view only shows the big airports
  const list = (await airportList()).filter((a) => a.lat >= s && a.lat <= n && a.lon >= w && a.lon <= e && (a.large || !wide));
  list.sort((a, b) => Number(b.large) - Number(a.large));
  res.json(list.slice(0, 400));
});

// ---------- city bike networks (CityBikes) ----------
r.get('/widgets/:id/map/bikes', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const d = await getJson('https://api.citybik.es/v2/networks?fields=id,name,location', { ttl: 6 * 3600_000 });
  res.json((d.networks ?? []).filter((x) => x.location?.latitude != null).map((x) => ({ id: x.id, name: x.name, city: x.location.city, country: x.location.country, lat: x.location.latitude, lon: x.location.longitude })));
});
r.get('/widgets/:id/map/bikes/:network', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  if (!/^[a-z0-9._-]+$/i.test(req.params.network)) throw new HttpError(400, 'bad network id');
  const d = await getJson(`https://api.citybik.es/v2/networks/${req.params.network}?fields=stations`, { ttl: 60_000 });
  res.json((d.network?.stations ?? []).map((x) => ({ name: x.name, lat: x.latitude, lon: x.longitude, bikes: x.free_bikes, free: x.empty_slots })));
});

// ---------- place search (Open-Meteo geocoding) ----------
r.get('/widgets/:id/map/search', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const text = String(req.query.q ?? '').trim();
  if (text.length < 2) return res.json([]);
  const d = await getJson(`https://geocoding-api.open-meteo.com/v1/search?count=6&language=${lang(req)}&name=${encodeURIComponent(text)}`, { ttl: 3600_000 });
  res.json((d.results ?? []).map((p) => ({ name: p.name, admin: p.admin1 ?? null, country: p.country ?? null, lat: p.latitude, lon: p.longitude })));
});

// ---------- what is here: weather, air, elevation, sea (Open-Meteo) ----------
r.get('/widgets/:id/map/point', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const [lat, lon] = coord(req, 'lat', 'lon');
  const la = lat.toFixed(2);
  const lo = lon.toFixed(2);
  const [wx, aq, el, sea] = await Promise.all([
    settled(getJson(`https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&daily=sunrise,sunset&timezone=auto&forecast_days=1`, { ttl: 10 * 60_000 })),
    settled(getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${la}&longitude=${lo}&current=european_aqi,pm2_5,pm10`, { ttl: 10 * 60_000 })),
    settled(getJson(`https://api.open-meteo.com/v1/elevation?latitude=${la}&longitude=${lo}`, { ttl: 24 * 3600_000 })),
    settled(getJson(`https://marine-api.open-meteo.com/v1/marine?latitude=${la}&longitude=${lo}&current=wave_height,wave_period`, { ttl: 30 * 60_000 })),
  ]);
  res.json({
    weather: wx?.current ? { temp: wx.current.temperature_2m, feels: wx.current.apparent_temperature, humidity: wx.current.relative_humidity_2m, wind: wx.current.wind_speed_10m, code: wx.current.weather_code, day: Boolean(wx.current.is_day) } : null,
    sun: wx?.daily ? { rise: wx.daily.sunrise?.[0], set: wx.daily.sunset?.[0] } : null,
    tz: wx ? { name: wx.timezone, abbr: wx.timezone_abbreviation, offset: wx.utc_offset_seconds } : null,
    air: aq?.current?.european_aqi != null ? { aqi: aq.current.european_aqi, pm25: aq.current.pm2_5, pm10: aq.current.pm10 } : null,
    elevation: Array.isArray(el?.elevation) ? el.elevation[0] : null,
    sea: sea?.current?.wave_height != null ? { wave: sea.current.wave_height, period: sea.current.wave_period } : null,
  });
});

// ---------- country extras: holidays, World Bank, exchange rate ----------
const WB = { population: 'SP.POP.TOTL', gdpPc: 'NY.GDP.PCAP.CD', life: 'SP.DYN.LE00.IN', internet: 'IT.NET.USER.ZS', unemployment: 'SL.UEM.TOTL.ZS' };
r.get('/widgets/:id/map/country/extra', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const code = String(req.query.code ?? '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) throw new HttpError(400, 'bad country code');
  const cur = String(req.query.cur ?? '').toUpperCase();
  const [holidays, ...bank] = await Promise.all([
    settled(getJson(`https://date.nager.at/api/v3/NextPublicHolidays/${code}`, { ttl: 6 * 3600_000 })),
    ...Object.values(WB).map((ind) => settled(getJson(`https://api.worldbank.org/v2/country/${code}/indicator/${ind}?format=json&mrnev=1`, { ttl: 24 * 3600_000 }))),
  ]);
  const rates = /^[A-Z]{3}$/.test(cur) ? await settled(getJson('https://open.er-api.com/v6/latest/USD', { ttl: 6 * 3600_000 })) : null;
  const perUSD = rates?.rates?.[cur] ?? null;
  const perEUR = perUSD && rates.rates.EUR ? perUSD / rates.rates.EUR : null;
  res.json({
    holidays: Array.isArray(holidays) ? holidays.slice(0, 3).map((h) => ({ date: h.date, name: h.localName || h.name })) : null,
    bank: Object.fromEntries(Object.keys(WB).map((k, i) => {
      const v = bank[i]?.[1]?.[0];
      return [k, v?.value != null ? { value: v.value, year: v.date } : null];
    })),
    rates: perUSD ? { cur, perUSD, perEUR } : null,
  });
});

export default r;
