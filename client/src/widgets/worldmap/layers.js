import L from 'leaflet';
import { api } from '../../api.js';
import { getLang, t } from '../../i18n.js';
import { cssVar, dot, el, fmt, link, popup, row, viewQuery, when } from './dom.js';

/*
 * Catalogue of the map's layers. A "data" layer asks the dashboard server (which calls a free API) and draws the
 * answer into a Leaflet layer group; `view` layers reload when the map moves; `local` layers need no API;
 * tile overlays are loaded by the browser straight from the provider.
 */
export const BASES = {
  osm: { label: 'Térkép' },
  dark: { label: 'Sötét' },
  topo: { label: 'Domborzat' },
  nasa: { label: 'Műhold (NASA)' },
  night: { label: 'Éjszakai Föld' },
};

export const LAYERS = {
  flights: { icon: '✈', label: 'Repülők', hint: 'OpenSky' },
  iss: { icon: '◉', label: 'ISS űrállomás', hint: 'wheretheiss.at' },
  quakes: { icon: '◎', label: 'Földrengések', hint: 'USGS' },
  fires: { icon: '♨', label: 'Erdőtüzek', hint: 'NASA EONET' },
  volcanoes: { icon: '▲', label: 'Vulkánok', hint: 'NASA EONET' },
  storms: { icon: '⌁', label: 'Viharok', hint: 'NASA EONET' },
  hazards: { icon: '⚠', label: 'Árvíz, aszály, jég…', hint: 'NASA EONET' },
  aurora: { icon: '✧', label: 'Sarki fény', hint: 'NOAA SWPC' },
  radar: { icon: '☂', label: 'Eső radar', hint: 'RainViewer' },
  countries: { icon: '⚑', label: 'Kattintásra info', hint: 'Open-Meteo, REST Countries, World Bank…' },
  news: { icon: '☰', label: 'Hírek', hint: 'GDELT' },
  wiki: { icon: 'W', label: 'Wikipédia a közelben', hint: 'Wikipedia' },
  species: { icon: '❀', label: 'Fajmegfigyelések', hint: 'GBIF' },
  airports: { icon: '⌂', label: 'Repterek', hint: 'Overpass / OSM' },
  bikes: { icon: '⚲', label: 'Városi bicikli', hint: 'CityBikes' },
  seamarks: { icon: '⚓', label: 'Hajózási jelek', hint: 'OpenSeaMap' },
  rail: { icon: '⛓', label: 'Vasút', hint: 'OpenRailwayMap' },
  night: { icon: '◐', label: 'Nappal / éjszaka' },
  landtemp: { icon: '♨', label: 'Felszíni hőmérséklet', hint: 'NASA GIBS' },
};

export const GROUPS = [
  ['Élő', ['flights', 'iss', 'quakes', 'fires', 'volcanoes', 'storms', 'hazards', 'aurora', 'radar']],
  ['Információ', ['countries', 'news', 'wiki', 'species']],
  ['Infrastruktúra', ['airports', 'bikes', 'seamarks', 'rail']],
  ['Nap & hőmérséklet', ['night', 'landtemp']],
];

export const DEFAULT_LAYERS = ['countries', 'quakes'];

/** Layers of a tile: the `layers` setting ("flights,quakes"), or the old per-layer booleans. */
export function activeLayers(cfg) {
  if (typeof cfg.layers === 'string') return cfg.layers.split(',').map((x) => x.trim()).filter((x) => LAYERS[x]);
  const out = [];
  if (cfg.countries !== false) out.push('countries');
  if (cfg.quakes !== false) out.push('quakes');
  if (cfg.flights) out.push('flights');
  if (cfg.news) out.push('news');
  return out;
}

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

/** Base maps: [url, options]. */
export const baseTiles = () => ({
  osm: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, className: 'wm-osm', attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }],
  dark: ['https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { subdomains: 'abcd', maxZoom: 19, attribution: '© OpenStreetMap · © <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>' }],
  topo: ['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 17, className: 'wm-topo', attribution: '© OpenStreetMap · © <a href="https://opentopomap.org" target="_blank" rel="noopener noreferrer">OpenTopoMap</a>' }],
  nasa: [`${GIBS}/MODIS_Terra_CorrectedReflectance_TrueColor/default/${day(-1)}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`, { maxNativeZoom: 9, maxZoom: 12, attribution: 'NASA GIBS · MODIS' }],
  night: [`${GIBS}/VIIRS_Black_Marble/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png`, { maxNativeZoom: 8, maxZoom: 12, attribution: 'NASA GIBS · VIIRS Black Marble' }],
});

/** Overlays that are only tiles. */
export const overlayTiles = () => ({
  seamarks: ['https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', { maxZoom: 18, zIndex: 6, attribution: '© <a href="https://www.openseamap.org" target="_blank" rel="noopener noreferrer">OpenSeaMap</a>' }],
  rail: ['https://{s}.tiles.openrailwaymap.org/standard/{z}/{x}/{y}.png', { subdomains: 'abc', maxZoom: 19, zIndex: 6, attribution: '© <a href="https://www.openrailwaymap.org" target="_blank" rel="noopener noreferrer">OpenRailwayMap</a>' }],
  landtemp: [`${GIBS}/MODIS_Terra_Land_Surface_Temp_Day/default/${day(-3)}/GoogleMapsCompatible_Level7/{z}/{y}/{x}.png`, { maxNativeZoom: 7, maxZoom: 12, opacity: 0.7, zIndex: 5, attribution: 'NASA GIBS · MODIS LST' }],
});

// ---------- event layers (NASA EONET) ----------
const eventLayer = (group, color) => ({
  path: () => `events?group=${group}`,
  draw(list, g) {
    for (const ev of list) {
      dot(ev.lat, ev.lon, 6, cssVar(color[0], color[1]), 0.45)
        .addTo(g)
        .bindPopup(() => el('div', 'wm-pop', el('b', null, ev.title), row(t('Típus'), ev.cat), row(t('Idő'), when(ev.date)), ev.link && link(ev.link, 'NASA EONET ↗')), popup());
    }
    return `${list.length}`;
  },
});

// ---------- day / night ----------
function sunPosition(date = new Date()) {
  const rad = Math.PI / 180;
  const n = date.getTime() / 86_400_000 + 2440587.5 - 2451545.0;
  const L0 = (280.46 + 0.9856474 * n) % 360;
  const g = (357.528 + 0.9856003 * n) % 360;
  const lambda = L0 + 1.915 * Math.sin(g * rad) + 0.02 * Math.sin(2 * g * rad);
  const eps = 23.439 - 0.0000004 * n;
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad)) / rad;
  const ra = Math.atan2(Math.cos(eps * rad) * Math.sin(lambda * rad), Math.cos(lambda * rad)) / rad;
  const gmst = (280.46061837 + 360.98564736629 * n) % 360;
  const lon = ((((ra - gmst) % 360) + 540) % 360) - 180;
  return { lat: decl, lon };
}

export const nightPolygon = (date = new Date()) => {
  const sun = sunPosition(date);
  const tanDecl = Math.tan((Math.max(Math.abs(sun.lat), 0.01) * Math.sign(sun.lat || 1) * Math.PI) / 180);
  const edge = [];
  for (let lon = -180; lon <= 180; lon += 3) edge.push([(Math.atan(-Math.cos(((lon - sun.lon) * Math.PI) / 180) / tanDecl) * 180) / Math.PI, lon]);
  const pole = sun.lat >= 0 ? -90 : 90; // the night side is the pole away from the Sun
  return { sun, ring: [[pole, -180], ...edge, [pole, 180]] };
};

// ---------- data layers ----------
export const DATA = {
  flights: {
    view: true,
    interval: 60_000,
    path: (m) => `flights?${viewQuery(m)}`,
    draw(d, g) {
      for (const p of d.planes) {
        L.marker([p.lat, p.lon], {
          keyboard: false,
          icon: L.divIcon({
            className: `wm-plane${p.ground ? ' ground' : ''}`,
            html: `<svg viewBox="0 0 24 24" style="transform:rotate(${Math.round(p.heading)}deg)"><path d="M12 2l2.2 7.6L22 14v2l-7.8-2.2L13 20l2.5 1.6V23L12 22l-3.5 1v-1.4L11 20l-1.2-6.2L2 16v-2l7.8-4.4z"/></svg>`,
            iconSize: [18, 18],
            iconAnchor: [9, 9],
          }),
        })
          .addTo(g)
          .bindPopup(() => el('div', 'wm-pop', el('b', null, p.call || p.id), row(t('Ország'), p.country), row(t('Magasság'), p.alt != null ? `${fmt(p.alt)} m` : ''), row(t('Sebesség'), p.speed != null ? `${fmt(p.speed * 3.6)} km/h` : ''), row(t('Irány'), `${Math.round(p.heading)}°`), p.ground && el('div', 'wm-row', t('a földön'))), popup());
      }
      return d.total > d.planes.length ? `${d.planes.length}/${d.total}` : `${d.total}`;
    },
  },

  iss: {
    keep: true,
    interval: 10_000,
    path: () => 'iss',
    draw(d, g) {
      if (!g._iss) {
        g._track = L.polyline([], { color: cssVar('--accent', '#67e8f9'), weight: 1.5, dashArray: '4 6', opacity: 0.7, interactive: false }).addTo(g);
        g._iss = L.marker([d.lat, d.lon], { keyboard: false, icon: L.divIcon({ className: 'wm-iss', html: '<i></i>', iconSize: [22, 22], iconAnchor: [11, 11] }) }).addTo(g);
      }
      g._iss.setLatLng([d.lat, d.lon]);
      // the ground track wraps around the date line: split it there so no line crosses the whole map
      const parts = [[]];
      d.track.forEach((p, i) => {
        if (i && Math.abs(p[1] - d.track[i - 1][1]) > 180) parts.push([]);
        parts[parts.length - 1].push(p);
      });
      g._track.setLatLngs(parts);
      g._iss.unbindPopup().bindPopup(() => el('div', 'wm-pop', el('b', null, 'ISS'), row(t('Magasság'), `${fmt(d.alt)} km`), row(t('Sebesség'), `${fmt(d.speed)} km/h`), row(t('Láthatóság'), d.visibility), d.crew?.length && row(t('Személyzet'), d.crew.join(', '))), popup());
      return `${fmt(d.alt)} km`;
    },
  },

  quakes: {
    path: () => 'quakes',
    draw(list, g) {
      for (const q of list) {
        dot(q.lat, q.lon, 3 + (q.mag ?? 2) * 1.6, cssVar('--danger', '#f87171'))
          .addTo(g)
          .bindPopup(() => el('div', 'wm-pop', el('b', null, `M ${q.mag?.toFixed(1)}`), row(t('Hely'), q.place), row(t('Mélység'), `${Math.round(q.depth)} km`), row(t('Idő'), when(q.time)), q.url && link(q.url, 'USGS ↗')), popup());
      }
      return `${list.length}`;
    },
  },

  fires: eventLayer('wildfires', ['--warn', '#fb923c']),
  volcanoes: eventLayer('volcanoes', ['--danger', '#ef4444']),
  storms: eventLayer('storms', ['--accent', '#60a5fa']),
  hazards: eventLayer('hazards', ['--muted', '#facc15']),

  aurora: {
    interval: 10 * 60_000,
    path: () => 'aurora',
    draw(d, g) {
      for (const [lat, lon, v] of d.points) {
        L.circleMarker([lat, lon], { radius: 5, stroke: false, fillColor: '#4ade80', fillOpacity: Math.min(0.75, 0.12 + v / 120), interactive: false }).addTo(g);
      }
      return d.kp != null ? `Kp ${d.kp}` : `${d.points.length}`;
    },
  },

  radar: {
    interval: 5 * 60_000,
    path: () => 'radar',
    draw(d, g) {
      L.tileLayer(d.tiles, { opacity: 0.65, maxNativeZoom: 7, maxZoom: 12, zIndex: 7, attribution: '<a href="https://www.rainviewer.com" target="_blank" rel="noopener noreferrer">RainViewer</a>' }).addTo(g);
      return when(d.time * 1000).slice(-5);
    },
  },

  news: {
    path: () => 'news',
    draw(list, g) {
      for (const p of list) {
        dot(p.lat, p.lon, 4 + Math.min(10, Math.log2(p.count + 1) * 2), cssVar('--accent', '#67e8f9'), 0.3)
          .addTo(g)
          .bindPopup(() => el('div', 'wm-pop', el('b', null, p.place), p.articles.map((a) => el('div', 'wm-art', link(a.url, a.title)))), popup({ maxWidth: 300 }));
      }
      return `${list.length}`;
    },
  },

  wiki: {
    view: true,
    path: (m) => {
      if (m.getZoom() < 9) return null;
      const c = m.getCenter();
      return `wiki?lat=${c.lat}&lon=${c.lng}&lang=${getLang()}`;
    },
    draw(list, g) {
      for (const a of list) {
        dot(a.lat, a.lon, 4, '#e5e7eb', 0.6)
          .addTo(g)
          .bindPopup(() => el('div', 'wm-pop', el('b', null, a.title), row(t('Távolság'), `${fmt(a.dist)} m`), link(a.url, 'Wikipedia ↗')), popup());
      }
      return `${list.length}`;
    },
  },

  species: {
    view: true,
    path: (m) => (m.getZoom() < 8 ? null : `species?${viewQuery(m)}`),
    draw(list, g) {
      for (const o of list) {
        dot(o.lat, o.lon, 5, '#4ade80', 0.5)
          .addTo(g)
          .bindPopup(
            () => {
              const img = o.img && Object.assign(el('img', 'wm-photo'), { src: o.img, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer' });
              return el('div', 'wm-pop', el('b', null, o.name || o.sci), o.name && el('div', 'wm-sci', o.sci), row(t('Idő'), when(o.date)), img, link(`https://www.gbif.org/occurrence/${o.key}`, 'GBIF ↗'));
            },
            popup(),
          );
      }
      return `${list.length}`;
    },
  },

  airports: {
    view: true,
    path: (m) => (m.getZoom() < 5 ? null : `airports?${viewQuery(m)}`),
    draw(list, g) {
      for (const a of list) {
        dot(a.lat, a.lon, 5, '#f5f5f5', 0.7)
          .addTo(g)
          .bindPopup(() => el('div', 'wm-pop', el('b', null, a.name), row('IATA', a.iata), row('ICAO', a.icao)), popup());
      }
      return `${list.length}`;
    },
  },

  bikes: {
    keep: true,
    path: () => 'bikes',
    draw(list, g, { m, widgetId }) {
      g.clearLayers();
      for (const n of list) {
        dot(n.lat, n.lon, 4, '#2dd4bf', 0.5)
          .addTo(g)
          .bindPopup(() => {
            const btn = el('button', 'wm-btn', t('Állomások mutatása'));
            btn.onclick = async () => {
              btn.disabled = true;
              try {
                const st = await api.get(`/widgets/${widgetId}/map/bikes/${encodeURIComponent(n.id)}`);
                g._stations?.remove();
                g._stations = L.layerGroup(
                  st.map((s) => dot(s.lat, s.lon, 5, '#fbbf24', 0.6).bindPopup(() => el('div', 'wm-pop', el('b', null, s.name), row(t('Szabad bicikli'), s.bikes), row(t('Szabad hely'), s.free)), popup())),
                ).addTo(m);
                if (st.length) m.fitBounds(L.latLngBounds(st.map((s) => [s.lat, s.lon])), { maxZoom: 15, padding: [30, 30] });
                m.closePopup();
              } catch (err) {
                btn.textContent = err.message;
              }
            };
            return el('div', 'wm-pop', el('b', null, n.name), row(t('Város'), [n.city, n.country].filter(Boolean).join(', ')), btn);
          }, popup());
      }
      return `${list.length}`;
    },
  },

  night: {
    local: true,
    interval: 60_000,
    draw(_, g) {
      const { sun, ring } = nightPolygon();
      L.polygon(ring, { stroke: false, fillColor: '#000', fillOpacity: 0.38, interactive: false }).addTo(g);
      L.circleMarker([sun.lat, sun.lon], { radius: 5, color: '#fde047', fillColor: '#fde047', fillOpacity: 0.9, weight: 1, interactive: false }).addTo(g);
      return '';
    },
  },
};

// local keep:false layers clear their group before drawing; `keep` layers manage their own objects
export const isLocal = (id) => Boolean(DATA[id]?.local);
