import React, { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api.js';
import { useLive } from '../hooks.js';
import { getLang, t } from '../i18n.js';
import { el, fmt, link, popup, row } from './worldmap/dom.js';
import { activeLayers, BASES, baseTiles, DATA, DEFAULT_LAYERS, GROUPS, LAYERS, overlayTiles } from './worldmap/layers.js';

const WMO = [
  [[0], 'Derült'],
  [[1, 2, 3], 'Felhős'],
  [[45, 48], 'Köd'],
  [[51, 53, 55, 56, 57], 'Szitálás'],
  [[61, 63, 65, 66, 67], 'Eső'],
  [[71, 73, 75, 77], 'Havazás'],
  [[80, 81, 82], 'Zápor'],
  [[85, 86], 'Hózápor'],
  [[95, 96, 99], 'Zivatar'],
];
const AQI = [[20, 'Kiváló'], [40, 'Jó'], [60, 'Mérsékelt'], [80, 'Gyenge'], [100, 'Rossz'], [Infinity, 'Nagyon rossz']];
const DATA_IDS = Object.keys(DATA);
const TILE_IDS = Object.keys(overlayTiles());
const bankLine = (b, key, label, unit, digits = 0) => row(label, b?.[key] ? `${fmt(b[key].value, digits)}${unit} (${b[key].year})` : '');

// The popup of a click: country card, then "here" (weather, air, elevation, sea), then country extras. Sections arrive as their APIs answer.
function infoNode({ country, here, extra, cur }) {
  const parts = [];
  if (country?.none) parts.push(el('b', null, t('Nyílt víz')));
  else if (country) {
    const name = getLang() === 'hu' && country.nameHu ? country.nameHu : country.name;
    parts.push(
      el('div', 'wm-head', country.flag && Object.assign(el('img'), { src: country.flag, alt: '', width: 26, height: 17 }), el('b', null, name)),
      row(t('Főváros'), country.capital),
      row(t('Népesség'), fmt(country.population)),
      row(t('Terület'), country.area ? `${fmt(country.area)} km²` : ''),
      row(t('Régió'), country.region),
      row(t('Nyelvek'), country.languages?.join(', ')),
      row(t('Pénznem'), country.currencies?.join(', ')),
    );
  }
  if (extra?.rates) {
    const { perUSD, perEUR } = extra.rates;
    if (cur !== 'USD') parts.push(row(t('Árfolyam'), `1 USD = ${fmt(perUSD, 2)} ${cur}`));
    if (cur !== 'EUR' && perEUR) parts.push(row('', `1 EUR = ${fmt(perEUR, 2)} ${cur}`));
  }
  if (extra?.bank) {
    const b = extra.bank;
    parts.push(bankLine(b, 'gdpPc', t('GDP / fő'), ' $'), bankLine(b, 'life', t('Várható élettartam'), t(' év'), 1), bankLine(b, 'internet', t('Internetezők'), '%', 0), bankLine(b, 'unemployment', t('Munkanélküliség'), '%', 1));
  }
  if (extra?.holidays?.length) parts.push(el('div', 'wm-sec', t('Következő ünnepnapok')), ...extra.holidays.map((h) => row(h.date, h.name)));
  if (here) {
    parts.push(el('div', 'wm-sec', t('Itt most')));
    const w = here.weather;
    if (w) {
      const text = WMO.find(([codes]) => codes.includes(w.code))?.[1];
      parts.push(row(t('Időjárás'), `${fmt(w.temp, 1)} °C${text ? `, ${t(text)}` : ''}`), row(t('Érzet'), `${fmt(w.feels, 1)} °C`), row(t('Szél'), `${fmt(w.wind, 0)} km/h`), row(t('Páratartalom'), `${w.humidity}%`));
    }
    if (here.tz) parts.push(row(t('Helyi idő'), `${new Date(Date.now() + here.tz.offset * 1000).toISOString().slice(11, 16)} (${here.tz.abbr})`));
    if (here.sun?.rise) parts.push(row(t('Nap'), `${here.sun.rise.slice(11, 16)} – ${here.sun.set.slice(11, 16)}`));
    if (here.air) parts.push(row(t('Levegő'), `AQI ${here.air.aqi} (${t(AQI.find(([max]) => here.air.aqi <= max)[1])}), PM2.5 ${fmt(here.air.pm25, 1)}`));
    parts.push(row(t('Tengerszint feletti magasság'), here.elevation != null ? `${fmt(here.elevation)} m` : ''));
    if (here.sea) parts.push(row(t('Hullámmagasság'), `${fmt(here.sea.wave, 1)} m · ${fmt(here.sea.period, 0)} s`));
  } else if (country && !country.none && !extra) parts.push(el('div', 'wm-sec', t('Betöltés…')));
  return el('div', 'wm-pop', ...parts);
}

export default function WorldMap({ widget, onUpdateConfig }) {
  const cfg = widget.config ?? {};
  const fromConfig = () => (activeLayers(cfg).length || typeof cfg.layers === 'string' ? activeLayers(cfg) : DEFAULT_LAYERS);
  // local copies: a toggle shows at once and quick successive clicks do not overwrite each other while the save is in flight
  const [layers, setLayers] = useState(fromConfig);
  const [base, setBase] = useState(BASES[cfg.base] ? cfg.base : 'osm');
  useEffect(() => setLayers(fromConfig()), [cfg.layers, cfg.countries, cfg.quakes, cfg.flights, cfg.news]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => setBase(BASES[cfg.base] ? cfg.base : 'osm'), [cfg.base]);
  const on = new Set(layers);
  const box = useRef(null);
  const map = useRef(null);
  const groups = useRef({});
  const baseLayer = useRef(null);
  const [status, setStatus] = useState({});
  const [panel, setPanel] = useState(false);
  const [found, setFound] = useState(null);
  const [query, setQuery] = useState('');
  const viewKey = `nexus-map-${widget.id}`;

  useLive(on.has('flights') || on.has('iss') || on.has('radar') || on.has('aurora'));
  const put = useCallback((id, value) => setStatus((s) => ({ ...s, [id]: value })), []);

  // ---- create the map once ----
  useEffect(() => {
    let view = { center: [30, 15], zoom: 2 };
    try {
      const saved = JSON.parse(localStorage.getItem(viewKey) ?? 'null');
      if (saved?.center && saved.zoom) view = saved;
    } catch {
      /* no saved view */
    }
    const m = L.map(box.current, { center: view.center, zoom: view.zoom, minZoom: 1, worldCopyJump: true, preferCanvas: true });
    for (const id of DATA_IDS) groups.current[id] = L.layerGroup().addTo(m);
    m.on('moveend', () => {
      try {
        const c = m.getCenter();
        localStorage.setItem(viewKey, JSON.stringify({ center: [c.lat, c.lng], zoom: m.getZoom() }));
      } catch {
        /* ignore */
      }
    });
    map.current = m;
    const ro = new ResizeObserver(() => m.invalidateSize()); // the tile can be resized by the user
    ro.observe(box.current);
    return () => {
      ro.disconnect();
      m.remove();
      map.current = null;
      groups.current = {};
      baseLayer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- base map ----
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    baseLayer.current?.remove();
    const [url, opts] = baseTiles()[base];
    baseLayer.current = L.tileLayer(url, { zIndex: 1, ...opts }).addTo(m);
  }, [base]);

  // ---- data layers (one effect per layer, the list is static) ----
  for (const id of DATA_IDS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const m = map.current;
      const g = groups.current[id];
      const spec = DATA[id];
      if (!m || !g) return undefined;
      put(id, null);
      if (!on.has(id)) return undefined;
      let dead = false;
      let timer = null;
      const run = async () => {
        const path = spec.local ? '' : spec.path(m);
        if (path == null) {
          if (!spec.keep) g.clearLayers();
          put(id, { hint: true });
          return;
        }
        try {
          const data = spec.local ? null : await api.get(`/widgets/${widget.id}/map/${path}`);
          if (dead) return;
          if (!spec.keep) g.clearLayers();
          put(id, spec.draw(data, g, { m, widgetId: widget.id }) ?? '');
        } catch (err) {
          if (!dead) put(id, { error: err.message });
        }
      };
      run();
      const iv = spec.interval ? setInterval(() => !document.hidden && run(), spec.interval) : null;
      const kick = () => {
        clearTimeout(timer);
        timer = setTimeout(run, 700);
      };
      if (spec.view) m.on('moveend', kick);
      return () => {
        dead = true;
        clearTimeout(timer);
        if (iv) clearInterval(iv);
        if (spec.view) m.off('moveend', kick);
        g.clearLayers();
        g._stations?.remove();
        g._stations = null;
        g._iss = null;
        g._track = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [on.has(id), widget.id, id === 'news' ? cfg.newsQuery : null]);
  }

  // ---- tile overlays ----
  for (const id of TILE_IDS) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const m = map.current;
      if (!m || !on.has(id)) return undefined;
      const [url, opts] = overlayTiles()[id];
      const layer = L.tileLayer(url, opts).addTo(m);
      return () => {
        layer.remove();
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [on.has(id)]);
  }

  // ---- click / search: what is here? ----
  const openInfo = useCallback(
    async (latlng) => {
      const m = map.current;
      if (!m) return;
      const lat = latlng.lat;
      const lon = ((((latlng.lng + 180) % 360) + 360) % 360) - 180;
      const base = `/widgets/${widget.id}/map`;
      const pop = L.popup(popup({ autoPanPadding: [12, 12] })).setLatLng(latlng).setContent(el('div', 'wm-pop', t('Betöltés…'))).openOn(m);
      const state = {};
      const paint = () => {
        pop.setContent(infoNode(state));
        pop.update();
      };
      const [country, here] = await Promise.allSettled([api.get(`${base}/country?lat=${lat}&lon=${lon}`), api.get(`${base}/point?lat=${lat}&lon=${lon}&lang=${getLang()}`)]);
      if (here.status === 'fulfilled') state.here = here.value;
      if (country.status === 'fulfilled') state.country = country.value;
      else if (!state.here) return pop.setContent(el('div', 'wm-pop wm-err', country.reason.message));
      paint();
      const c = state.country;
      if (c && !c.none) {
        state.cur = c.currencyCodes?.[0] ?? '';
        try {
          state.extra = await api.get(`${base}/country/extra?code=${c.code}&cur=${state.cur}`);
          paint();
        } catch {
          /* the extras are optional */
        }
      }
    },
    [widget.id],
  );

  useEffect(() => {
    const m = map.current;
    if (!m || !on.has('countries')) return undefined;
    const onClick = (e) => openInfo(e.latlng);
    m.on('click', onClick);
    return () => m.off('click', onClick);
  }, [on.has('countries'), openInfo]);

  // ---- place search ----
  useEffect(() => {
    if (query.trim().length < 2) return setFound(null);
    const id = setTimeout(() => {
      api
        .get(`/widgets/${widget.id}/map/search?q=${encodeURIComponent(query.trim())}&lang=${getLang()}`)
        .then(setFound)
        .catch(() => setFound([]));
    }, 350);
    return () => clearTimeout(id);
  }, [query, widget.id]);

  const goTo = (p) => {
    setFound(null);
    setQuery('');
    const m = map.current;
    m.flyTo([p.lat, p.lon], Math.max(m.getZoom(), 8), { duration: 1.2 });
    m.once('moveend', () => openInfo(L.latLng(p.lat, p.lon)));
  };

  const toggle = (id) => {
    const next = on.has(id) ? layers.filter((x) => x !== id) : [...layers, id];
    setLayers(next);
    onUpdateConfig?.({ layers: next.join(',') });
  };
  const errors = [...new Set(Object.values(status).filter((s) => s?.error).map((s) => s.error))];

  return (
    <div className="wm">
      <div className="wm-bar no-drag">
        <div className="wm-search">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('Hely keresése…')} aria-label={t('Hely keresése…')} />
          {found && (
            <ul>
              {found.length === 0 && <li className="muted">{t('Nincs találat')}</li>}
              {found.map((p) => (
                <li key={`${p.lat},${p.lon}`}>
                  <button onClick={() => goTo(p)}>
                    {p.name}
                    <span className="muted"> {[p.admin, p.country].filter(Boolean).join(', ')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className={`wm-chip ${panel ? 'on' : ''}`} aria-expanded={panel} onClick={() => setPanel((v) => !v)}>
          ☰ {t('Rétegek')} <i className="wm-n">{layers.length}</i>
        </button>
      </div>
      <div className="wm-stage">
        <div className="wm-map no-drag" ref={box} />
        {panel && (
          <div className="wm-panel no-drag">
            <div className="wm-sec">{t('Alaptérkép')}</div>
            <div className="wm-bases">
              {Object.entries(BASES).map(([id, b]) => (
                <button key={id} className={`wm-chip ${base === id ? 'on' : ''}`} aria-pressed={base === id} onClick={() => { setBase(id); onUpdateConfig?.({ base: id }); }}>
                  {t(b.label)}
                </button>
              ))}
            </div>
            {GROUPS.map(([group, ids]) => (
              <div key={group}>
                <div className="wm-sec">{t(group)}</div>
                {ids.map((id) => {
                  const s = status[id];
                  return (
                    <label key={id} className="wm-layer" title={LAYERS[id].hint}>
                      <input type="checkbox" checked={on.has(id)} onChange={() => toggle(id)} />
                      <span className="wm-ic" aria-hidden>{LAYERS[id].icon}</span>
                      <span className="wm-lb">{t(LAYERS[id].label)}</span>
                      {on.has(id) && s?.hint && <i className="wm-n">{t('nagyíts rá')}</i>}
                      {on.has(id) && s?.error && <i className="wm-n bad">!</i>}
                      {on.has(id) && typeof s === 'string' && s && <i className="wm-n">{s}</i>}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        )}
        {errors.length > 0 && <div className="wm-error">{errors.join(' · ')}</div>}
      </div>
    </div>
  );
}
