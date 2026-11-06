import React, { useEffect, useState } from 'react';
import { t } from '../i18n.js';

const fmt = (ms, withMs = true) => {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n) => String(n).padStart(2, '0');
  const base = `${h ? `${h}:` : ''}${pad(m)}:${pad(s % 60)}`;
  return withMs ? `${base}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}` : base;
};

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 1.2);
  } catch {
    /* no audio */
  }
}

export default function Stopwatch({ widget }) {
  const key = `sw:${widget.id}`;
  const [st, setSt] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(key)) ?? null;
    } catch {
      return null;
    }
  });
  const s = st ?? { mode: 'stopwatch', startedAt: null, acc: 0, laps: [], timerMs: 5 * 60_000 };
  const [, tick] = useState(0);
  const save = (v) => {
    setSt(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  };
  const running = s.startedAt != null;
  const elapsed = s.acc + (running ? Date.now() - s.startedAt : 0);
  const remaining = Math.max(0, s.timerMs - elapsed);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((x) => x + 1), 50);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (s.mode === 'timer' && running && remaining === 0) {
      beep();
      save({ ...s, startedAt: null, acc: s.timerMs });
    }
  });

  const start = () => save({ ...s, startedAt: Date.now() });
  const stop = () => save({ ...s, startedAt: null, acc: elapsed });
  const reset = () => save({ ...s, startedAt: null, acc: 0, laps: [] });
  const lap = () => save({ ...s, laps: [elapsed, ...s.laps].slice(0, 20) });
  const setMode = (mode) => save({ ...s, mode, startedAt: null, acc: 0, laps: [] });
  const setTimer = (min) => save({ ...s, timerMs: min * 60_000, startedAt: null, acc: 0 });

  return (
    <div className="sw">
      <div className="seg">
        <button className={`seg-btn ${s.mode === 'stopwatch' ? 'on' : ''}`} onClick={() => setMode('stopwatch')}>
          {t('STOPPER')}
        </button>
        <button className={`seg-btn ${s.mode === 'timer' ? 'on' : ''}`} onClick={() => setMode('timer')}>
          {t('IDŐZÍTŐ')}
        </button>
      </div>
      <div className={`sw-time ${running ? 'running' : ''}`}>{s.mode === 'timer' ? fmt(remaining, false) : fmt(elapsed)}</div>
      {s.mode === 'timer' && !running && elapsed === 0 && (
        <div className="chips center">
          {[1, 3, 5, 10, 15, 30, 60].map((m) => (
            <button key={m} className={`chip ${s.timerMs === m * 60_000 ? 'chip-on' : ''}`} onClick={() => setTimer(m)}>
              {m}′
            </button>
          ))}
        </div>
      )}
      <div className="row gap center">
        {running ? (
          <button className="btn btn-primary sm" onClick={stop}>
            ❚❚ {t('Állj')}
          </button>
        ) : (
          <button className="btn btn-primary sm" onClick={start} disabled={s.mode === 'timer' && remaining === 0}>
            ▶ {elapsed ? t('Folytat') : t('Indít')}
          </button>
        )}
        {s.mode === 'stopwatch' && running && (
          <button className="btn btn-ghost sm" onClick={lap}>
            {t('Kör')}
          </button>
        )}
        <button className="btn btn-ghost sm" onClick={reset}>
          ↺
        </button>
      </div>
      {s.mode === 'stopwatch' && s.laps.length > 0 && (
        <ol className="sw-laps">
          {s.laps.map((l, i) => (
            <li key={i}>
              <span className="muted">#{s.laps.length - i}</span>
              <span>{fmt(l)}</span>
              <span className="muted">+{fmt(l - (s.laps[i + 1] ?? 0))}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
