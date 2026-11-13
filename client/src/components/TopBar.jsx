import React, { useEffect, useRef, useState } from 'react';
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

  // --topbar-h = where the header ends on screen: the phone spacer and the landscape category bar sit below it.
  // Measured by the header itself, so a remount (portrait ↔ landscape moves it) never leaves a stale 0.
  const head = useRef(null);
  useEffect(() => {
    const el = head.current;
    if (!el) return undefined;
    const set = () => {
      const b = Math.round(el.getBoundingClientRect().bottom);
      if (el.isConnected && el.offsetHeight > 0 && b > 0) document.documentElement.style.setProperty('--topbar-h', `${b}px`);
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener('resize', set);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', set);
    };
  }, []);

  const name = profile?.name?.trim();
  const askName = () => {
    setMenu(false);
    const next = prompt(t('Hogyan szólítsalak?'), name ?? '');
    if (next !== null) onProfile({ ...profile, name: next.trim() });
  };

  // avatar: tap → upload a picture (cropped to a square, shrunk to 256 px in the browser), or remove it
  const [menu, setMenu] = useState(false);
  const file = useRef(null);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const away = (e) => !menuRef.current?.contains(e.target) && setMenu(false);
    document.addEventListener('pointerdown', away);
    return () => document.removeEventListener('pointerdown', away);
  }, [menu]);
  const pick = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    setMenu(false);
    if (!f) return;
    try {
      onProfile({ ...profile, avatar: await squareImage(f, 256) });
    } catch {
      alert(t('Ezt a képet nem sikerült beolvasni.'));
    }
  };

  return (
    <header className="topbar" ref={head}>
      <div className="hello">
        <span className="avatar-wrap" ref={menuRef}>
          <button className={`avatar${profile?.avatar ? ' has-img' : ''}`} onClick={() => setMenu((m) => !m)} title={t('Profilkép')} aria-label={t('Profilkép')} aria-expanded={menu}>
            {profile?.avatar ? <img src={profile.avatar} alt="" /> : name ? name[0].toUpperCase() : '◉'}
          </button>
          {menu && (
            <div className="avatar-menu" role="menu">
              <button role="menuitem" onClick={() => file.current?.click()}>
                {profile?.avatar ? t('Kép cseréje') : t('Kép feltöltése')}
              </button>
              {profile?.avatar && (
                <button role="menuitem" onClick={() => (setMenu(false), onProfile({ name: profile.name ?? '' }))}>
                  {t('Kép eltávolítása')}
                </button>
              )}
              <button role="menuitem" onClick={askName}>
                {t('Név megadása')}
              </button>
            </div>
          )}
          <input ref={file} type="file" accept="image/*" hidden onChange={pick} />
        </span>
        <button className="hello-text" onClick={askName} title={t('Név megadása')}>
          <span className="hello-title">
            {t(greetingKey(now))}
            {name ? `, ${name}` : ''}
          </span>
          <span className="hello-sub">
            {now.toLocaleDateString(locale(), { weekday: 'long', month: 'long', day: 'numeric' })} · {now.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}
            {subtitle ? ` · ${subtitle}` : ''}
          </span>
        </button>
      </div>

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

// A picture → a centre-cropped square JPEG data URL (phone photos are megabytes; this is ~20 KB)
async function squareImage(f, size) {
  const url = URL.createObjectURL(f);
  try {
    const img = await new Promise((ok, fail) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = fail;
      i.src = url;
    });
    const side = Math.min(img.naturalWidth, img.naturalHeight);
    if (!side) throw new Error('empty');
    const c = document.createElement('canvas');
    c.width = c.height = size;
    c.getContext('2d').drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
    return c.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
