import React, { useEffect, useRef, useState } from 'react';
import useBackdropClose from '../components/useBackdropClose.js';
import { t } from '../i18n.js';
import { CAT_ICONS, newCategoryId } from './context.js';

/** Add, rename, re-icon, reorder and delete categories. `startNew` opens with a fresh, focused row. */
export default function CategoryEditor({ categories, startNew, onSave, onClose }) {
  const backdrop = useBackdropClose(onClose);
  const [rows, setRows] = useState(() => [...categories.map((c) => ({ ...c })), ...(startNew ? [{ id: newCategoryId(), name: '', icon: '◆', tiles: [], canvas: [], layout: [], fresh: true }] : [])]);
  const [iconFor, setIconFor] = useState(null);
  const lastInput = useRef(null);

  useEffect(() => {
    if (startNew) lastInput.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [startNew, onClose]);

  const set = (id, patch) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const move = (i, d) =>
    setRows((rs) => {
      const next = [...rs];
      const [x] = next.splice(i, 1);
      next.splice(Math.max(0, Math.min(next.length, i + d)), 0, x);
      return next;
    });
  const remove = (r) => {
    if (r.tiles.length && !confirm(t('Törlöd a(z) „{name}” kategóriát? A csempék megmaradnak az Áttekintésben.', { name: r.name }))) return;
    setRows((rs) => rs.filter((x) => x.id !== r.id));
  };
  const add = () => {
    setRows((rs) => [...rs, { id: newCategoryId(), name: '', icon: '◆', tiles: [], canvas: [], layout: [], fresh: true }]);
    setTimeout(() => lastInput.current?.focus(), 30);
  };
  const submit = (e) => {
    e.preventDefault();
    onSave(rows.filter((r) => r.name.trim()).map(({ fresh, ...r }) => ({ ...r, name: r.name.trim() })));
  };

  return (
    <div className="overlay center" {...backdrop}>
      <form className="modal cat-editor" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="eyebrow">{t('KATEGÓRIÁK')}</div>
        <h2>{t('Saját kategóriák')}</h2>
        <p className="muted small">{t('A csempéket a fejlécükben lévő ◫ gombbal teheted kategóriába. Egy csempe több kategóriában is lehet.')}</p>
        <div className="cat-rows">
          {rows.map((r, i) => (
            <div key={r.id} className="cat-row">
              <button type="button" className="cat-icon-btn" onClick={() => setIconFor(iconFor === r.id ? null : r.id)} title={t('Ikon')}>
                {r.icon}
              </button>
              <input ref={i === rows.length - 1 ? lastInput : undefined} className="input sm grow" value={r.name} maxLength={40} placeholder={t('Kategória neve')} onChange={(e) => set(r.id, { name: e.target.value })} />
              <span className="muted small cat-count">{t('{n} csempe', { n: r.tiles.length })}</span>
              <button type="button" className="icon-btn" disabled={i === 0} onClick={() => move(i, -1)} title={t('Feljebb')}>
                ↑
              </button>
              <button type="button" className="icon-btn" disabled={i === rows.length - 1} onClick={() => move(i, 1)} title={t('Lejjebb')}>
                ↓
              </button>
              <button type="button" className="icon-btn danger" onClick={() => remove(r)} title={t('Törlés')}>
                ✕
              </button>
              {iconFor === r.id && (
                <div className="cat-icons">
                  {CAT_ICONS.map((ic) => (
                    <button
                      type="button"
                      key={ic}
                      className={r.icon === ic ? 'on' : ''}
                      onClick={() => {
                        set(r.id, { icon: ic });
                        setIconFor(null);
                      }}
                    >
                      {ic}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
          {!rows.length && <div className="muted small">{t('Még nincs kategóriád.')}</div>}
        </div>
        <button type="button" className="btn btn-ghost sm" onClick={add}>
          + {t('Új kategória')}
        </button>
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('Mégse')}
          </button>
          <button className="btn btn-primary">{t('Mentés')}</button>
        </div>
      </form>
    </div>
  );
}
