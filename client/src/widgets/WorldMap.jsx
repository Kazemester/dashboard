import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';
import { useLive } from '../hooks.js';
import { getLang, t } from '../i18n.js';

const LAYERS = [
  { key: 'countries', icon: '⚑', label: 'Ország' },
  { key: 'flights', icon: '✈', label: 'Repülők' },
  { key: 'quakes', icon: '◎', label: 'Rengések' },
  { key: 'news', icon: '☰', label: 'Hírek' },
];
const FLIGHT_REFRESH = 60_000;
// canvas-drawn markers need real colours, so read the theme's
const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

// DOM helper: popups are built from elements, so API text can never inject markup.
const el = (tag, cls, ...kids) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k of kids.flat()) if (k != null && k !== false) n.append(k.nodeType ? k : String(k));
  return n;
};
const row = (k, v) => (v ? el('div', 'wm-row', el('span', 'wm-k', k), el('span', null, v)) : null);
const fmt = (n) => (n == null ? '' : Number(n).toLocaleString(getLang() === 'en' ? 'en-GB' : 'hu-HU'));
const link = (href, text) => {
  const a = el('a', null, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
};

const planeIcon = (heading, ground) =>
  L.divIcon({
    className: `wm-plane${ground ? ' ground' : ''}`,
    html: `<svg viewBox="0 0 24 24" style="transform:rotate(${Math.round(heading)}deg)"><path d="M12 2l2.2 7.6L22 14v2l-7.8-2.2L13 20l2.5 1.6V23L12 22l-3.5 1v-1.4L11 20l-1.2-6.2L2 16v-2l7.8-4.4z"/></svg>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

export default function WorldMap({ widget, onUpdateConfig }) {
  const cfg = widget.config ?? {};
  const on = { countries: cfg.countries !== false, flights: Boolean(cfg.flights), quakes: cfg.quakes !== false, news: Boolean(cfg.news) };
  const box = useRef(null);
  const map = useRef(null);
  const layers = useRef({});
  const [status, setStatus] = useState({});
  const [zoom, setZoom] = useState(2);
  const viewKey = `nexus-map-${widget.id}`;

  useLive(on.flights);

  const setLayerStatus = useCallback((key, value) => setStatus((s) => ({ ...s, [key]: value })), []);

  // ---- create the map once ----
  useEffect(() => {
    let view = { center: [30, 15], zoom: 2 };
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey) ?? 'null');
      if (saved?.center && saved.zoom) view = saved;
    } catch {
      /* no saved view */
    }
    const m = L.map(box.current, { center: view.center, zoom: view.zoom, minZoom: 1, worldCopyJump: true, zoomControl: true, attributionControl: true, preferCanvas: true });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>' }).addTo(m);
    for (const k of ['flights', 'quakes', 'news']) layers.current[k] = L.layerGroup().addTo(m);
    m.on('moveend', () => {
      setZoom(m.getZoom());
      try {
        const c = m.getCenter();
        localStorage.setItem(viewKey, JSON.stringify({ center: [c.lat, c.lng], zoom: m.getZoom() }));
      } catch {
        /* ignore */
      }
    });
    map.current = m;
    // the tile can be resized by the user: keep Leaflet's idea of the size in sync
    const ro = new ResizeObserver(() => m.invalidateSize());
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- country info on click ----
  useEffect(() => {
    const m = map.current;
    if (!m || !on.countries) return undefined;
    const onClick = async (e) => {
      const pop = L.popup({ className: 'wm-popup', maxWidth: 280, autoPanPadding: [12, 12] }).setLatLng(e.latlng).setContent(el('div', 'wm-pop', t('Betöltés…'))).openOn(m);
      try {
        const lng = ((((e.latlng.lng + 180) % 360) + 360) % 360) - 180;
        const c = await api.get(`/widgets/${widget.id}/map/country?lat=${e.latlng.lat}&lon=${lng}`);
        if (c.none) return pop.setContent(el('div', 'wm-pop', t('Nyílt víz')));
        const name = getLang() === 'hu' && c.nameHu ? c.nameHu : c.name;
        const head = el('div', 'wm-head', c.flag && Object.assign(el('img'), { src: c.flag, alt: '', width: 26, height: 17 }), el('b', null, name));
        pop.setContent(
          el(
            'div',
            'wm-pop',
            head,
            row(t('Főváros'), c.capital),
            row(t('Népesség'), fmt(c.population)),
            row(t('Terület'), c.area ? `${fmt(Math.round(c.area))} km²` : ''),
            row(t('Régió'), c.region),
            row(t('Nyelvek'), c.languages.join(', ')),
            row(t('Pénznem'), c.currencies.join(', ')),
            row(t('Időzóna'), c.timezones.join(', ')),
          ),
        );
        pop.update(); // the content grew: re-measure so the popup is panned fully into view
      } catch (err) {
        pop.setContent(el('div', 'wm-pop wm-err', err.message));
      }
    };
    m.on('click', onClick);
    return () => m.off('click', onClick);
  }, [on.countries, widget.id]);

  // ---- earthquakes ----
  useEffect(() => {
    const g = layers.current.quakes;
    g?.clearLayers();
    setLayerStatus('quakes', null);
    if (!on.quakes) return undefined;
    let dead = false;
    api
      .get(`/widgets/${widget.id}/map/quakes`)
      .then((qs) => {
        if (dead) return;
        for (const q of qs) {
          const c = L.circleMarker([q.lat, q.lon], { radius: 3 + (q.mag ?? 2) * 1.6, color: cssVar('--danger', '#f87171'), fillColor: cssVar('--danger', '#f87171'), fillOpacity: 0.35, weight: 1 }).addTo(g);
          c.bindPopup(() => el('div', 'wm-pop', el('b', null, `M ${q.mag?.toFixed(1)}`), row(t('Hely'), q.place), row(t('Mélység'), `${Math.round(q.depth)} km`), row(t('Idő'), new Date(q.time).toLocaleString(getLang() === 'en' ? 'en-GB' : 'hu-HU')), q.url && link(q.url, 'USGS ↗')), { className: 'wm-popup' });
        }
        setLayerStatus('quakes', `${qs.length}`);
      })
      .catch((e) => !dead && setLayerStatus('quakes', { error: e.message }));
    return () => {
      dead = true;
      g?.clearLayers();
    };
  }, [on.quakes, widget.id, setLayerStatus]);

  // ---- news ----
  useEffect(() => {
    const g = layers.current.news;
    g?.clearLayers();
    setLayerStatus('news', null);
    if (!on.news) return undefined;
    let dead = false;
    api
      .get(`/widgets/${widget.id}/map/news`)
      .then((ps) => {
        if (dead) return;
        for (const p of ps) {
          const c = L.circleMarker([p.lat, p.lon], { radius: 4 + Math.min(10, Math.log2(p.count + 1) * 2), color: cssVar('--accent', '#67e8f9'), fillColor: cssVar('--accent', '#67e8f9'), fillOpacity: 0.3, weight: 1 }).addTo(g);
          c.bindPopup(() => el('div', 'wm-pop', el('b', null, p.place), p.articles.map((a) => el('div', 'wm-art', link(a.url, a.title)))), { className: 'wm-popup', maxWidth: 300 });
        }
        setLayerStatus('news', `${ps.length}`);
      })
      .catch((e) => !dead && setLayerStatus('news', { error: e.message }));
    return () => {
      dead = true;
      g?.clearLayers();
    };
  }, [on.news, cfg.newsQuery, widget.id, setLayerStatus]);

  // ---- flights: what is in view, refreshed every minute while the layer is on ----
  useEffect(() => {
    const m = map.current;
    const g = layers.current.flights;
    g?.clearLayers();
    setLayerStatus('flights', null);
    if (!m || !on.flights) return undefined;
    let dead = false;
    let timer = null;
    const load = async () => {
      const b = m.getBounds();
      const w = b.getWest();
      const e = b.getEast();
      // a view that spans the whole world (or wraps around) asks for everything
      const wholeLng = e - w >= 360 || w < -180 || e > 180;
      const q = new URLSearchParams({ lamin: b.getSouth(), lamax: b.getNorth(), lomin: wholeLng ? -180 : w, lomax: wholeLng ? 180 : e });
      try {
        const d = await api.get(`/widgets/${widget.id}/map/flights?${q}`);
        if (dead) return;
        g.clearLayers();
        for (const p of d.planes) {
          const mk = L.marker([p.lat, p.lon], { icon: planeIcon(p.heading, p.ground), keyboard: false }).addTo(g);
          mk.bindPopup(
            () =>
              el(
                'div',
                'wm-pop',
                el('b', null, p.call || p.id),
                row(t('Ország'), p.country),
                row(t('Magasság'), p.alt != null ? `${fmt(Math.round(p.alt))} m` : ''),
                row(t('Sebesség'), p.speed != null ? `${fmt(Math.round(p.speed * 3.6))} km/h` : ''),
                row(t('Irány'), `${Math.round(p.heading)}°`),
                p.ground && el('div', 'wm-row', t('a földön')),
              ),
            { className: 'wm-popup' },
          );
        }
        setLayerStatus('flights', d.total > d.planes.length ? `${d.planes.length}/${d.total}` : `${d.total}`);
      } catch (err) {
        if (!dead) setLayerStatus('flights', { error: err.message });
      }
    };
    const kick = () => {
      clearTimeout(timer);
      timer = setTimeout(load, 700);
    };
    load();
    const iv = setInterval(() => !document.hidden && load(), FLIGHT_REFRESH);
    m.on('moveend', kick);
    return () => {
      dead = true;
      clearTimeout(timer);
      clearInterval(iv);
      m.off('moveend', kick);
      g.clearLayers();
    };
  }, [on.flights, widget.id, setLayerStatus]);

  const toggle = (key) => onUpdateConfig?.({ [key]: !on[key] });
  const err = Object.values(status).find((s) => s?.error)?.error;

  return (
    <div className="wm">
      <div className="wm-bar no-drag">
        {LAYERS.map(({ key, icon, label }) => (
          <button key={key} role="switch" aria-checked={on[key]} className={`wm-chip ${on[key] ? 'on' : ''}`} onClick={() => toggle(key)} title={t(label)}>
            <span aria-hidden>{icon}</span> {t(label)}
            {on[key] && typeof status[key] === 'string' && key !== 'countries' && <i className="wm-n">{status[key]}</i>}
          </button>
        ))}
      </div>
      <div className="wm-map nowheel no-drag" ref={box} />
      {on.flights && zoom < 3 && <div className="wm-hint">{t('Nagyíts rá a pontosabb repülő-képhez')}</div>}
      {err && <div className="wm-error">{err}</div>}
    </div>
  );
}
