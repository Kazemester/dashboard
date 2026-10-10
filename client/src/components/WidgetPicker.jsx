import React, { useEffect, useState } from 'react';
import { CATALOG, CATEGORIES } from '../widgets/registry.js';

export default function WidgetPicker({ onPick, onClose }) {
  const [filter, setFilter] = useState('');
  const [cat, setCat] = useState('all');

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const items = CATALOG.filter(
    (d) =>
      (cat === 'all' || d.category === cat) &&
      (d.name + d.description).toLowerCase().includes(filter.toLowerCase()),
  );

  return (
    <div className="overlay" onClick={onClose}>
      <aside className="drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">MODUL KATALÓGUS</div>
            <h2>Válassz egy modult</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <input
          className="input"
          autoFocus
          placeholder="Keresés…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="chips">
          {[['all', 'Mind'], ...Object.entries(CATEGORIES)].map(([k, label]) => (
            <button key={k} className={`chip ${cat === k ? 'chip-on' : ''}`} onClick={() => setCat(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="catalog">
          {items.map((d) => (
            <button key={d.key} className={`cat-card accent-${d.accent}`} onClick={() => onPick(d)}>
              <span className="cat-icon">{d.icon}</span>
              <span className="cat-text">
                <span className="cat-name">{d.name}</span>
                <span className="cat-desc">{d.description}</span>
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
