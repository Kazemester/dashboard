import React, { useEffect, useState } from 'react';
import { useNow } from '../hooks.js';
import { api } from '../api.js';
import ThemePicker from './ThemePicker.jsx';
import { animEnabled } from '../theme.js';
import { getLang, locale, setLang, t } from '../i18n.js';

export default function TopBar({ editing, onToggleEdit, onAdd, onArrange, onAi, aiVersion, count, appearance, onAppearance }) {
  const now = useNow(1000);
  const animOn = animEnabled(appearance);
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
        <span className="tele">{String(count).padStart(2, '0')} {t('MODUL')}</span>
      </div>

      <div className="topbar-right">
        <div className="clock">
          <span className="clock-time">{now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="clock-date">
            {now.toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
        </div>
        <button className="btn btn-ghost ai-btn" onClick={onAi} title={status?.llm ? `AI: ${status.model}` : t('AI nincs beállítva — kattints a beállításhoz')}>
          <i className={`dot ${status?.llm ? 'ok' : 'off'}`} /> AI
        </button>
        <button
          className="btn btn-ghost anim-switch"
          role="switch"
          aria-label={t('Animációk')}
          aria-checked={animOn}
          onClick={() => onAppearance({ ...appearance, anim: !animOn })}
          title={animOn ? t('Animációk kikapcsolása') : t('Animációk bekapcsolása')}
        >
          <span className={`anim-sw ${animOn ? 'on' : ''}`} aria-hidden>
            <i />
          </span>
          <span className="anim-sw-label">{t('Anim')}</span>
        </button>
        <div className="lang-switch" role="group" aria-label={t('Nyelv')}>
          {['hu', 'en'].map((l) => (
            <button key={l} className={getLang() === l ? 'on' : ''} aria-pressed={getLang() === l} onClick={() => setLang(l)} title={l === 'hu' ? 'Magyar' : 'English'}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <ThemePicker appearance={appearance} onChange={onAppearance} />
        {onArrange && (
          <button className="btn btn-ghost" onClick={onArrange} title={t('Csempék rendezése hézag nélküli rácsba')}>
            {t('Rendezés')}
          </button>
        )}
        <button className={`btn btn-ghost ${editing ? 'btn-active' : ''}`} onClick={onToggleEdit}>
          {editing ? t('Kész') : t('Szerkesztés')}
        </button>
        <button className="btn btn-primary" onClick={onAdd}>
          {t('+ Modul')}
        </button>
      </div>
    </header>
  );
}
