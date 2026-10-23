import { Router } from 'express';
import { cached, getWidget, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

/*
 * Data for the world-map tile (every source is free; none needs a key):
 *   flights  – OpenSky Network (anonymous: ~400 credits/day; optional OAuth client gives much more)
 *   quakes   – USGS earthquake feed
 *   news     – GDELT GEO 2.0 (geolocated news mentions)
 *   country  – Nominatim reverse geocoding + REST Countries
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

// ---------- news (GDELT GEO) ----------
const safeUrl = (u) => (/^https?:\/\//i.test(u) ? u : null);
// GDELT puts a little HTML snippet in every point; keep only the article links.
function articles(html) {
  const out = [];
  for (const m of String(html ?? '').matchAll(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = safeUrl(m[1]);
    const title = m[2].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    if (url && title) out.push({ title, url });
    if (out.length >= 5) break;
  }
  return out;
}

r.get('/widgets/:id/map/news', async (req, res) => {
  const w = await getWidget(req.params.id, 'worldmap');
  const query = String(req.query.q || w.config.newsQuery || '').trim() || 'sourcelang:eng';
  const url = `https://api.gdeltproject.org/api/v2/geo/geo?query=${encodeURIComponent(query)}&format=GeoJSON&timespan=24h&maxpoints=150`;
  const data = await getJson(url, { ttl: 15 * 60_000, timeout: 25_000 });
  res.json(
    (data.features ?? [])
      .filter((f) => f.geometry?.coordinates?.length >= 2)
      .map((f) => ({
        lon: f.geometry.coordinates[0],
        lat: f.geometry.coordinates[1],
        place: f.properties?.name ?? '',
        count: num(f.properties?.count) ?? 1,
        articles: articles(f.properties?.html),
      }))
      .filter((p) => p.articles.length),
  );
});

// ---------- country info (Nominatim + REST Countries) ----------
r.get('/widgets/:id/map/country', async (req, res) => {
  await getWidget(req.params.id, 'worldmap');
  const lat = num(req.query.lat);
  const lon = num(req.query.lon);
  if (lat == null || lon == null) throw new HttpError(400, 'lat and lon are required');
  const geo = await getJson(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=3&addressdetails=1&lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`,
    { ttl: 3600_000 },
  );
  const code = geo.address?.country_code?.toUpperCase();
  if (!code) return res.json({ none: true }); // open sea
  const [c] = await getJson(
    `https://restcountries.com/v3.1/alpha/${code}?fields=name,translations,capital,population,area,region,subregion,languages,currencies,flags,cca2,timezones`,
    { ttl: 24 * 3600_000 },
  ).then((x) => (Array.isArray(x) ? x : [x]));
  res.json({
    code,
    name: c?.name?.common ?? geo.address.country,
    nameHu: c?.translations?.hun?.common ?? null,
    official: c?.name?.official ?? null,
    capital: c?.capital?.[0] ?? null,
    population: c?.population ?? null,
    area: c?.area ?? null,
    region: [c?.region, c?.subregion].filter(Boolean).join(' · '),
    languages: Object.values(c?.languages ?? {}),
    currencies: Object.values(c?.currencies ?? {}).map((x) => `${x.name}${x.symbol ? ` (${x.symbol})` : ''}`),
    flag: c?.flags?.svg ?? c?.flags?.png ?? null,
    timezones: (c?.timezones ?? []).slice(0, 3),
  });
});

export default r;
