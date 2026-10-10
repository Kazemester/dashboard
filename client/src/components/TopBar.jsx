import React, { useEffect, useState } from 'react';
import { useNow } from '../hooks.js';
import { api } from '../api.js';

export default function TopBar({ editing, onToggleEdit, onAdd, count }) {
  const now = useNow(1000);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api.get('/status').then(setStatus).catch(() => setStatus(null));
  }, []);

  return (
    <header className="topbar">
      <div className="brand">
        <svg viewBox="0 0 32 32" className="brand-logo" aria-hidden>
          <polygon points="16,2 30,10 30,22 16,30 2,22 2,10" />
          <circle cx="16" cy="16" r="4" />
        </svg>
        <div>
          <div className="brand-name">NEXUS</div>
          <div className="brand-sub">COMMAND DECK // v0.1</div>
        </div>
      </div>

      <div className="telemetry">
        <span className="tele">
          <i className="dot ok" /> CORE ONLINE
        </span>
        <span className="tele">
          <i className={`dot ${status?.llm ? 'ok' : 'warn'}`} /> AI {status?.llm ? status.model.toUpperCase() : 'OFFLINE'}
        </span>
        <span className="tele">MODULOK: {String(count).padStart(2, '0')}</span>
      </div>

      <div className="topbar-right">
        <div className="clock">
          <div className="clock-time">{now.toLocaleTimeString('hu-HU')}</div>
          <div className="clock-date">
            {now.toLocaleDateString('hu-HU', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button className={`btn ${editing ? 'btn-active' : ''}`} onClick={onToggleEdit}>
          {editing ? '✓ Kész' : '✎ Szerkesztés'}
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          + Modul
        </button>
      </div>
    </header>
  );
}
