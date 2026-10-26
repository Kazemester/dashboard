import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { getLang, t } from '../i18n.js';

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
    return () => clearInterval(iv);
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
  const markAll = () => {
    const next = new Set([...seen, ...items.map((n) => n.id)].slice(-500));
    setSeen(next);
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
            <span className="eyebrow">{t('Értesítések')}</span>
            {unseen > 0 && (
              <button className="btn btn-ghost sm" onClick={markAll}>
                {t('Mind olvasott')}
              </button>
            )}
          </div>
          {!items.length && <div className="muted small bell-empty">{t('Minden rendben, nincs teendő.')}</div>}
          <ul>
            {items.map((n) => (
              <li key={n.id}>
                <button
                  className={`bell-item lvl-${n.level} ${seen.has(n.id) ? 'seen' : ''}`}
                  onClick={() => {
                    setOpen(false);
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
          </ul>
        </div>
      )}
    </div>
  );
}
