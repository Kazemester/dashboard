import L from 'leaflet';
import { getLang } from '../../i18n.js';

// Popups are built from DOM nodes (never HTML strings), so API text cannot inject markup.
export const el = (tag, cls, ...kids) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  for (const k of kids.flat()) if (k != null && k !== false && k !== '') n.append(k.nodeType ? k : String(k));
  return n;
};
export const row = (k, v) => (v != null && v !== '' && v !== false ? el('div', 'wm-row', el('span', 'wm-k', k), el('span', null, v)) : null);
export const loc = () => (getLang() === 'en' ? 'en-GB' : 'hu-HU');
export const fmt = (n, d = 0) => (n == null || Number.isNaN(Number(n)) ? '' : Number(n).toLocaleString(loc(), { maximumFractionDigits: d }));
export const when = (v) => (v ? new Date(v).toLocaleString(loc(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const link = (href, text) => {
  const a = el('a', null, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
};
export const popup = (extra = {}) => ({ className: 'wm-popup', maxWidth: 300, maxHeight: 340, ...extra });
// canvas-drawn markers need real colours, so read the theme's
export const cssVar = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
export const dot = (lat, lon, radius, color, opacity = 0.35) => L.circleMarker([lat, lon], { radius, color, fillColor: color, fillOpacity: opacity, weight: 1 });
// the visible part of the map as query parameters (a view wider than the world asks for everything)
export function viewQuery(m) {
  const b = m.getBounds();
  const w = b.getWest();
  const e = b.getEast();
  const whole = e - w >= 360 || w < -180 || e > 180;
  return new URLSearchParams({ lamin: b.getSouth(), lamax: b.getNorth(), lomin: whole ? -180 : w, lomax: whole ? 180 : e }).toString();
}
