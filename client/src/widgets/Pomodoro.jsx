import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';

const MODES = { focus: 'FÓKUSZ', short: 'RÖVID SZÜNET', long: 'HOSSZÚ SZÜNET' };

function beep() {
  try {
    const ctx = new AudioContext();
    [0, 0.25, 0.5].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
  } catch {
    /* audio not available */
  }
}

const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export default function Pomodoro({ widget }) {
  const cfg = widget.config;
  const durations = {
    focus: (Number(cfg.focus) || 25) * 60,
    short: (Number(cfg.short) || 5) * 60,
    long: (Number(cfg.long) || 15) * 60,
  };
  const storeKey = `pomo:${widget.id}`;
  // Timer state lives in localStorage so a page refresh does not lose a running session.
  const [st, setSt] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(storeKey)) ?? null;
    } catch {
      return null;
    }
  });
  const state = st ?? { mode: 'focus', endsAt: null, remaining: durations.focus, round: 0 };
  const [, tick] = useState(0);
  const { data: stats, setData: setStats } = useWidgetData(`/widgets/${widget.id}/pomodoro`);
  const finishing = useRef(false);

  const save = (s) => {
    setSt(s);
    try {
      localStorage.setItem(storeKey, JSON.stringify(s));
    } catch {
      /* ignore */
    }
  };

  const remaining = state.endsAt ? Math.max(0, Math.round((state.endsAt - Date.now()) / 1000)) : state.remaining;
  const total = durations[state.mode];
  const pct = 1 - remaining / total;

  useEffect(() => {
    if (!state.endsAt) return;
    const t = setInterval(() => tick((x) => x + 1), 500);
    return () => clearInterval(t);
  }, [state.endsAt]);

  useEffect(() => {
    if (!state.endsAt || remaining > 0 || finishing.current) return;
    finishing.current = true;
    (async () => {
      beep();
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('NEXUS', { body: state.mode === 'focus' ? t('Fókusz kész — tarts szünetet!') : t('Szünet vége — vissza a munkához!') });
      }
      const s = await api.post(`/widgets/${widget.id}/pomodoro`, { kind: state.mode, duration_sec: total }).catch(() => null);
      if (s) setStats(s);
      const round = state.mode === 'focus' ? state.round + 1 : state.round;
      const next = state.mode === 'focus' ? (round % (Number(cfg.longEvery) || 4) === 0 ? 'long' : 'short') : 'focus';
      const auto = cfg.autoStart === true;
      save({ mode: next, round, remaining: durations[next], endsAt: auto ? Date.now() + durations[next] * 1000 : null });
      finishing.current = false;
    })();
  });

  const start = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') Notification.requestPermission();
    save({ ...state, endsAt: Date.now() + remaining * 1000 });
  };
  const pause = () => save({ ...state, endsAt: null, remaining });
  const reset = () => save({ ...state, endsAt: null, remaining: durations[state.mode] });
  const switchMode = (m) => save({ ...state, mode: m, endsAt: null, remaining: durations[m] });

  const R = 54;
  const C = 2 * Math.PI * R;
  const maxWeek = Math.max(1, ...(stats?.week ?? []).map((d) => d.focus_sec));

  return (
    <div className="pomo">
      <div className="seg">
        {Object.entries(MODES).map(([k, label]) => (
          <button key={k} className={`seg-btn ${state.mode === k ? 'on' : ''}`} onClick={() => switchMode(k)}>
            {t(label)}
          </button>
        ))}
      </div>

      <div className="pomo-ring">
        <svg viewBox="0 0 128 128">
          <circle className="ring-bg" cx="64" cy="64" r={R} />
          <circle
            className={`ring-fg mode-${state.mode}`}
            cx="64"
            cy="64"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - pct)}
          />
          {Array.from({ length: 60 }).map((_, i) => (
            <line key={i} className={`ring-tick ${i % 5 === 0 ? 'major' : ''}`} x1="64" y1="4" x2="64" y2={i % 5 === 0 ? 9 : 7} transform={`rotate(${i * 6} 64 64)`} />
          ))}
        </svg>
        <div className="pomo-time">
          <div className={`pomo-digits ${state.endsAt ? 'running' : ''}`}>{fmt(remaining)}</div>
          <div className="pomo-round">{t('KÖR #{n}', { n: state.round + 1 })}</div>
        </div>
      </div>

      <div className="row gap center">
        {state.endsAt ? (
          <button className="btn btn-primary" onClick={pause}>
            {t('❚❚ Szünet')}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={start}>
            {t('▶ Indítás')}
          </button>
        )}
        <button className="btn btn-ghost" onClick={reset}>
          ↺
        </button>
      </div>

      {stats && (
        <div className="pomo-stats">
          <div className="stat">
            <span className="stat-val">{stats.today.sessions}</span>
            <span className="stat-lbl">{t('MA')}</span>
          </div>
          <div className="stat">
            <span className="stat-val">{Math.round(stats.today.focus_sec / 60)}′</span>
            <span className="stat-lbl">{t('FÓKUSZ')}</span>
          </div>
          <div className="mini-bars" title={t('Elmúlt 7 nap fókuszpercei')}>
            {stats.week.map((d) => (
              <span key={d.day} style={{ height: `${(d.focus_sec / maxWeek) * 100}%` }} title={t('{day}: {n} perc', { day: d.day, n: Math.round(d.focus_sec / 60) })} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
