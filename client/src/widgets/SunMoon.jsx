import React from 'react';
import { useWidgetData, useNow } from '../hooks.js';
import { t } from '../i18n.js';

const SYNODIC = 29.530588853;
const NEW_MOON_REF = Date.UTC(2000, 0, 6, 18, 14); // a known new moon

function moon(date) {
  const p = ((((date - NEW_MOON_REF) / 86400_000) % SYNODIC) + SYNODIC) % SYNODIC / SYNODIC; // 0..1
  const illum = (1 - Math.cos(2 * Math.PI * p)) / 2;
  const names = [t('Újhold'), t('Növő sarló'), t('Első negyed'), t('Növő hold'), t('Telihold'), t('Fogyó hold'), t('Utolsó negyed'), t('Fogyó sarló')];
  const name = names[Math.round(p * 8) % 8];
  const toFull = ((0.5 - p + 1) % 1) * SYNODIC;
  const toNew = ((1 - p) % 1) * SYNODIC;
  return { p, illum, name, toFull, toNew };
}

function MoonIcon({ p }) {
  const r = 40;
  const k = Math.cos(2 * Math.PI * p); // 1 = new, -1 = full
  const rx = Math.abs(k) * r;
  const waxing = p < 0.5;
  // outer limb on the lit side, then back along the terminator ellipse
  const outer = waxing ? `A${r},${r} 0 0 1 50,90` : `A${r},${r} 0 0 0 50,90`;
  const crescent = k > 0;
  const sweep = waxing ? (crescent ? 0 : 1) : crescent ? 1 : 0;
  return (
    <svg viewBox="0 0 100 100" className="moon-icon">
      <circle cx="50" cy="50" r={r} className="moon-dark" />
      <path d={`M50,10 ${outer} A${rx},${r} 0 0 ${sweep} 50,10 Z`} className="moon-lit" />
    </svg>
  );
}

const hm = (iso) => iso.slice(11, 16);
const dur = (sec) => t('{h} ó {m} p', { h: Math.floor(sec / 3600), m: Math.round((sec % 3600) / 60) });

export default function SunMoon({ widget }) {
  const now = useNow(60_000);
  const { data, error } = useWidgetData(`/widgets/${widget.id}/sun`, { interval: 3600_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('PÁLYAADATOK…')}</div>;
  const today = data.days[0];
  const tomorrow = data.days[1];
  // Open-Meteo returns local times of the place without offset; compare as local wall-clock time
  const toMin = (iso) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const rise = toMin(today.sunrise);
  const set = toMin(today.sunset);
  const f = Math.max(0, Math.min(1, (nowMin - rise) / (set - rise)));
  const isDay = nowMin >= rise && nowMin <= set;
  const ang = Math.PI * (1 - f);
  const sx = 50 + 42 * Math.cos(ang);
  const sy = 50 - 42 * Math.sin(ang);
  const diff = Math.round(tomorrow.daylight - today.daylight);
  const mo = moon(now);

  return (
    <div className="sunmoon">
      <div className="sun-arc">
        <svg viewBox="0 0 100 56">
          <path d="M8,50 A42,42 0 0 1 92,50" className="arc-path" />
          <path d={`M8,50 A42,42 0 0 1 ${sx.toFixed(2)},${sy.toFixed(2)}`} className="arc-done" />
          <line x1="2" x2="98" y1="50" y2="50" className="arc-horizon" />
          {isDay && <circle cx={sx} cy={sy} r="3" className="sun-dot" />}
        </svg>
        <div className="sun-times">
          <span>
            <span className="eyebrow">{t('NAPKELTE')}</span> {hm(today.sunrise)}
          </span>
          <span className="center-col">
            <span className="eyebrow">{t('NAPPAL')}</span> {dur(today.daylight)}
            <span className="muted sm">
              {t('holnap {d} perc', { d: `${diff >= 0 ? '+' : '−'}${Math.abs(Math.round(diff / 60))}` })}
            </span>
          </span>
          <span className="right-col">
            <span className="eyebrow">{t('NAPNYUGTA')}</span> {hm(today.sunset)}
          </span>
        </div>
      </div>
      <div className="moon">
        <MoonIcon p={mo.p} />
        <div>
          <div className="moon-name">{mo.name}</div>
          <div className="muted sm">{t('{n}% megvilágított', { n: Math.round(mo.illum * 100) })}</div>
          <div className="muted sm">
            {t('telihold {a} nap · újhold {b} nap', { a: Math.round(mo.toFull), b: Math.round(mo.toNew) })}
          </div>
        </div>
        <div className="moon-uv">
          <span className="eyebrow">UV MAX</span>
          <span className="big-num sm-num">{today.uv ?? '–'}</span>
        </div>
      </div>
    </div>
  );
}
