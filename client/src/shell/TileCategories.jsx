import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n.js';
import { useShell } from './context.js';

/*
 * The ◫ button in a tile's header: tick the categories the tile belongs to (or make a new one).
 * The menu is portalled to <body>, so it is neither clipped by the tile nor scaled with the canvas.
 */
export default function TileCategories({ widget }) {
  const shell = useShell();
  const btn = useRef(null);
  const menu = useRef(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const [name, setName] = useState('');

  useLayoutEffect(() => {
    if (!open) return;
    const r = btn.current.getBoundingClientRect();
    const w = 240;
    setPos({ top: Math.min(r.bottom + 6, innerHeight - 80), left: Math.max(8, Math.min(r.right - w, innerWidth - w - 8)), width: w });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => !menu.current?.contains(e.target) && !btn.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  if (!shell) return null;
  const mine = shell.categories.filter((c) => c.tiles.includes(widget.id)).map((c) => c.id);
  const toggle = (id) => shell.setTileCategories(widget.id, mine.includes(id) ? mine.filter((x) => x !== id) : [...mine, id]);
  const create = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const id = shell.createCategory(name.trim());
    shell.setTileCategories(widget.id, [...mine, id]);
    setName('');
  };

  return (
    <>
      <button ref={btn} className={`icon-btn ${mine.length ? 'on' : ''}`} title={t('Kategóriák')} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        ◫
      </button>
      {open &&
        pos &&
        createPortal(
          <div ref={menu} className="pop tile-cats" style={pos} role="dialog" aria-label={t('Kategóriák')}>
            <div className="eyebrow">{t('Kategóriákba')}</div>
            {shell.categories.map((c) => (
              <label key={c.id} className="pop-row">
                <input type="checkbox" checked={mine.includes(c.id)} onChange={() => toggle(c.id)} />
                <span className="pop-ic">{c.icon}</span>
                <span className="grow">{c.name}</span>
              </label>
            ))}
            {!shell.categories.length && <div className="muted small">{t('Még nincs kategóriád.')}</div>}
            <form className="row gap pop-new" onSubmit={create}>
              <input className="input sm grow" value={name} maxLength={40} placeholder={t('Új kategória…')} onChange={(e) => setName(e.target.value)} />
              <button className="btn btn-primary sm" disabled={!name.trim()}>
                +
              </button>
            </form>
          </div>,
          document.body,
        )}
    </>
  );
}
