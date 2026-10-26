import React, { useEffect, useState } from 'react';
import { CATALOG, CATEGORIES, REGISTRY } from '../widgets/registry.js';
import useBackdropClose from './useBackdropClose.js';
import { t } from '../i18n.js';

export default function WidgetPicker({ onPick, onClose, category, existing, onPickExisting }) {
  const backdrop = useBackdropClose(onClose);
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState('all');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const mine = (existing ?? []).filter((w) => t(w.title).toLowerCase().includes(filter.toLowerCase()));
  const items = CATALOG.filter(
    (d) =>
      (cat === 'all' || d.category === cat) &&
      (t(d.name) + t(d.description)).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="overlay" {...backdrop}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{category ? `${category.icon} ${category.name}` : t('MODUL KATALÓGUS')}</div>
            <h2>{category ? t('Csempe hozzáadása a kategóriához') : t('Válassz egy modult')}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="input"
          autoFocus
          placeholder={t('Keresés…')}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {existing && (
          <>
            <div className="eyebrow picker-sec">{t('Meglévő csempék')}</div>
            {mine.length ? (
              <div className="catalog existing">
                {mine.map((w) => (
                  <button key={w.id} className="cat-card" onClick={() => onPickExisting(w)}>
                    <span className="cat-icon">{REGISTRY[w.type]?.icon ?? '◆'}</span>
                    <span className="cat-text">
                      <span className="cat-name">{t(w.title)}</span>
                      <span className="cat-desc">{t(REGISTRY[w.type]?.name ?? w.type)}</span>
                    </span>
                    <span className="cat-size">＋</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="muted small">{existing.length ? t('Nincs találat') : t('Minden csempéd benne van már ebben a kategóriában.')}</div>
            )}
            <div className="eyebrow picker-sec">{t('Új csempe a katalógusból')}</div>
          </>
        )}
        <div className="chips">
          {[['all', 'Mind'], ...Object.entries(CATEGORIES)].map(([k, label]) => (
            <button key={k} className={`chip ${cat === k ? 'chip-on' : ''}`} onClick={() => setCat(k)}>
              {t(label)}
            </button>
          ))}
        </div>
        <div className="catalog">
          {items.map((d) => (
            <button key={d.key} className={`cat-card accent-${d.accent}`} onClick={() => onPick(d)}>
              <span className="cat-icon">{d.icon}</span>
              <span className="cat-text">
                <span className="cat-name">{t(d.name)}</span>
                <span className="cat-desc">{t(d.description)}</span>
              </span>
              <span className="cat-size">
                {d.size.w}×{d.size.h}
              </span>
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
