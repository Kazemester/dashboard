import React, { useEffect, useState } from 'react';
import { useNow } from '../hooks.js';
import { api } from '../api.js';
import ThemePicker from './ThemePicker.jsx';

export default function TopBar({ editing, onToggleEdit, onAdd, onArrange, onAi, aiVersion, count, appearance, onAppearance }) {
  const now = useNow(1000);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api.get('/status').then(setStatus).catch(() => setStatus(null));
  }, [aiVersion]);

  return (
    <header className="topbar">
      <div className="brand">
        <svg viewBox="0 0 24 24" className="brand-logo" aria-hidden>
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="3.5" />
        </svg>
        <span className="brand-name">NEXUS</span>
      </div>

      <div className="telemetry">
        <span className="tele">
          <i className="dot ok" /> ONLINE
        </span>
        <button className="tele tele-btn" onClick={onAi}>
          <i className={`dot ${status?.llm ? 'ok' : 'off'}`} /> AI {status?.llm ? status.model.toUpperCase() : 'OFFLINE'}
        </button>
        <span className="tele">{String(count).padStart(2, '0')} MODUL</span>
      </div>

      <div className="topbar-right">
        <div className="clock">
          <span className="clock-time">{now.toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="clock-date">
            {now.toLocaleDateString('hu-HU', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <button className="btn btn-ghost ai-btn" onClick={onAi} title={status?.llm ? `AI: ${status.model}` : 'AI nincs beállítva — kattints a beállításhoz'}>
          <i className={`dot ${status?.llm ? 'ok' : 'off'}`} /> AI
        </button>
        <ThemePicker appearance={appearance} onChange={onAppearance} />
        {onArrange && (
          <button className="btn btn-ghost" onClick={onArrange} title="Csempék rendezése hézag nélküli rácsba">
            Rendezés
          </button>
        )}
        <button className={`btn btn-ghost ${editing ? 'btn-active' : ''}`} onClick={onToggleEdit}>
          {editing ? 'Kész' : 'Szerkesztés'}
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          + Modul
        </button>
      </div>
    </header>
  );
}
