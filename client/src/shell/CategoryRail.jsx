import React from 'react';
import { t } from '../i18n.js';

/*
 * The user's categories on the right edge: in reach of the right thumb on a phone, a floating glass pill on
 * the desktop. "Áttekintés" shows every tile; the categories show only what the user put into them.
 */
export default function CategoryRail({ categories, active, onSelect, onAdd, onManage }) {
  const item = (id, icon, label, count) => (
    <button key={id ?? 'all'} className={`rail-item ${active === id ? 'on' : ''}`} onClick={() => onSelect(id)} aria-current={active === id ? 'page' : undefined} title={label}>
      <span className="rail-ic" aria-hidden>
        {icon}
      </span>
      <span className="rail-lb">{label}</span>
      {count != null && <i className="rail-n">{count}</i>}
    </button>
  );
  return (
    <nav className="rail" aria-label={t('Kategóriák')}>
      {item(null, '⌂', t('Áttekintés'))}
      <div className="rail-list">{categories.map((c) => item(c.id, c.icon, c.name, c.tiles.length))}</div>
      <div className="rail-tools">
        <button className="rail-item rail-tool" onClick={onAdd} title={t('Új kategória')}>
          <span className="rail-ic" aria-hidden>
            +
          </span>
          <span className="rail-lb">{t('Új')}</span>
        </button>
        {categories.length > 0 && (
          <button className="rail-item rail-tool" onClick={onManage} title={t('Kategóriák szerkesztése')}>
            <span className="rail-ic" aria-hidden>
              ✎
            </span>
            <span className="rail-lb">{t('Szerk.')}</span>
          </button>
        )}
      </div>
    </nav>
  );
}
