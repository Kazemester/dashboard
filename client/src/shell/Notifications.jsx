import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { getLang, locale, t } from '../i18n.js';
import PushToggle from './PushToggle.jsx';

const ICON = { todo: '☐', event: '★', calendar: '◷', habit: '◈', money: '¤' };
const SEEN = 'nexus-seen-notifications';
const readSeen = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]'));
  } catch {
    return new Set();
  }
};

/** The bell: things that need attention today, gathered by the server from the tiles. */
export default function Notifications({ onReveal }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [log, setLog] = useState(null); // sent push notifications (history), null = not shown
  const openLog = useCallback(() => {
    setOpen(true);
    setLog([]);
    api.get('/push/log').then(setLog).catch(() => setLog([]));
  }, []);
  useEffect(() => {
    window.addEventListener('nexus:pushlog', openLog);
    return () => window.removeEventListener('nexus:pushlog', openLog);
  }, [openLog]);
  const box = useRef(null);

  const load = useCallback(() => {
    api
      .get(`/notifications?lang=${getLang()}`)
      .then(setItems)
      .catch(() => {});
  }, []);
  useEffect(() => {
    load();
    const iv = setInterval(() => !document.hidden && load(), 5 * 60_000);
    // coming back to the app (e.g. after tapping a notification): fresh list and badge
    const vis = () => !document.hidden && load();
    document.addEventListener('visibilitychange', vis);
    // read state is shared with the other devices (and the app icon badge) through the server
    api
      .get('/notifications/seen')
      .then((ids) => {
        setSeen((cur) => {
          const local = [...cur].filter((x) => !ids.includes(x));
          if (local.length) api.post('/notifications/seen', { ids: local }).catch(() => {});
          return new Set([...ids, ...cur]);
        });
      })
      .catch(() => {});
    return () => {
      clearInterval(iv);
      document.removeEventListener('visibilitychange', vis);
    };
  }, [load]);
  useEffect(() => {
    if (!open) return undefined;
    load();
    const close = (e) => !box.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open, load]);

  const unseen = items.filter((n) => !seen.has(n.id)).length;
  // the same number on the home screen icon (installed app; needs notification permission on iPhone)
  useEffect(() => {
    if (!('setAppBadge' in navigator)) return;
    (unseen > 0 ? navigator.setAppBadge(unseen) : navigator.clearAppBadge()).catch(() => {});
  }, [unseen]);
  const markAll = () => {
    const next = new Set([...seen, ...items.map((n) => n.id)].slice(-500));
    setSeen(next);
    api.post('/notifications/seen', { ids: items.map((n) => n.id) }).catch(() => {});
    try {
      localStorage.setItem(SEEN, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="bell" ref={box}>
      <button className={`bell-btn ${open ? 'on' : ''}`} onClick={() => setOpen((v) => !v)} aria-label={t('Értesítések')} aria-expanded={open} title={t('Értesítések')}>
        <svg viewBox="0 0 24 24" aria-hidden>
          <path d="M12 3a6 6 0 0 0-6 6v3.6L4.4 15.4A1 1 0 0 0 5.3 17h13.4a1 1 0 0 0 .9-1.6L18 12.6V9a6 6 0 0 0-6-6zm-2.5 15.5a2.5 2.5 0 0 0 5 0z" />
        </svg>
        {unseen > 0 && <i className="bell-n">{unseen > 9 ? '9+' : unseen}</i>}
      </button>
      {open && (
        <div className="pop bell-panel" role="dialog" aria-label={t('Értesítések')}>
          <div className="bell-head">
            <span className="eyebrow">{log ? t('Elküldött értesítések') : t('Értesítések')}</span>
            <button className="btn btn-ghost sm" onClick={() => (log ? setLog(null) : openLog())}>
              {log ? `← ${t('Teendők')}` : t('Előzmények')}
            </button>
            {unseen > 0 && (
              <button className="btn btn-ghost sm" onClick={markAll}>
                {t('Mind olvasott')}
              </button>
            )}
          </div>
          {log && (
            <ul className="push-log">
              {!log.length && <li className="muted small bell-empty">{t('Még nem ment értesítés.')}</li>}
              {log.map((n) => (
                <li key={n.id}>
                  <button
                    className="push-log-item"
                    onClick={() => {
                      const id = new URL(n.url || '/', location.origin).searchParams.get('w');
                      if (id) (setOpen(false), onReveal(id));
                    }}
                  >
                    <span className="push-log-head">
                      <b>{n.title}</b>
                      <span className="muted small">{new Date(n.created_at).toLocaleString(locale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    </span>
                    {n.body && <span className="push-log-body">{n.body}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!log && !items.length && <div className="muted small bell-empty">{t('Minden rendben, nincs teendő.')}</div>}
          {!log && <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  className={`bell-item lvl-${n.level} ${seen.has(n.id) ? 'seen' : ''}`}
                  onClick={() => {
                    setOpen(false);
                    if (!seen.has(n.id)) {
                      setSeen((cur) => new Set([...cur, n.id]));
                      api.post('/notifications/seen', { ids: [n.id] }).catch(() => {});
                    }
                    if (n.widgetId) onReveal(n.widgetId);
                  }}
                >
                  <span className="bell-ic" aria-hidden>
                    {ICON[n.kind] ?? '•'}
                  </span>
                  <span className="bell-text">
                    <span className="bell-title">{n.title}</span>
                    {n.detail && <span className="bell-detail">{n.detail}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>}
          {!log && <PushToggle />}
        </div>
      )}
    </div>
  );
}
