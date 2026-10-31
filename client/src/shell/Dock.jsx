import React from 'react';
import { t } from '../i18n.js';

/*
 * Bottom dock (thumb reach on a phone): edit / done, tidy up, the AI orb on phones, and the round "+".
 */
export default function Dock({ editing, onToggleEdit, onArrange, onAdd, onAssistant, category }) {
  return (
    <div className="dock" role="toolbar" aria-label={t('Műveletek')}>
      {category && <span className="dock-cat">{category}</span>}
      <button className={`dock-btn ${editing ? 'on' : ''}`} onClick={onToggleEdit} aria-pressed={editing}>
        {editing ? `✓ ${t('Kész')}` : `✎ ${t('Szerkesztés')}`}
      </button>
      {onArrange && (
        <button className="dock-btn" onClick={onArrange} title={t('Csempék rendezése hézag nélküli rácsba')}>
          ▦ {t('Rendezés')}
        </button>
      )}
      {onAssistant && (
        <button className="dock-btn dock-orb-btn" onClick={onAssistant} title={t('AI asszisztens')} aria-label={t('AI asszisztens')}>
          <i className="orb" />
        </button>
      )}
      <button className="dock-add" onClick={onAdd} title={t('Modul hozzáadása')} aria-label={t('Modul hozzáadása')}>
        +
      </button>
    </div>
  );
}
