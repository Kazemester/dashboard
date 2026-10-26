import React, { useEffect, useState } from 'react';
import { useNow } from '../hooks.js';
import { api } from '../api.js';
import ThemePicker from './ThemePicker.jsx';
import { animEnabled } from '../theme.js';
import { getLang, locale, setLang, t } from '../i18n.js';
import { greetingKey } from '../shell/context.js';
import Assistant from '../shell/Assistant.jsx';
import Notifications from '../shell/Notifications.jsx';

/*
 * Header: greeting (tap to set your name), the AI command bar in the middle (desktop), and on the right
 * AI status, language, animations, theme and the notification bell. Editing / adding lives in the bottom dock.
 */
export default function TopBar({ onAi, aiVersion, appearance, onAppearance, profile, onProfile, onReveal, wide, subtitle }) {
  const now = useNow(30_000);
  const animOn = animEnabled(appearance);
  const [status, setStatus] = useState(null);
  useEffect(() => {
    api.get('/status').then(setStatus).catch(() => setStatus(null));
  }, [aiVersion]);

  const name = profile?.name?.trim();
  const askName = () => {
    const next = prompt(t('Hogyan szólítsalak?'), name ?? '');
    if (next !== null) onProfile({ name: next.trim() });
  };

  return (
    <header className="topbar">
      <button className="hello" onClick={askName} title={t('Név megadása')}>
        <span className="avatar" aria-hidden>
          {name ? name[0].toUpperCase() : '◉'}
        </span>
        <span className="hello-text">
          <span className="hello-title">
            {t(greetingKey(now))}
            {name ? `, ${name}` : ''}
          </span>
          <span className="hello-sub">
            {now.toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' })} · {now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
            {subtitle ? ` · ${subtitle}` : ''}
          </span>
        </span>
      </button>

      {wide && <Assistant mode="bar" />}

      <div className="topbar-right">
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
          <span className="anim-sw-label">Anim</span>
        </button>
        <div className="lang-switch" role="group" aria-label={t('Nyelv')}>
          {['hu', 'en'].map((l) => (
            <button key={l} className={getLang() === l ? 'on' : ''} aria-pressed={getLang() === l} onClick={() => setLang(l)} title={l === 'hu' ? 'Magyar' : 'English'}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        <ThemePicker appearance={appearance} onChange={onAppearance} />
        <Notifications onReveal={onReveal} />
      </div>
    </header>
  );
}
