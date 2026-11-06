import React from 'react';
import { t } from '../i18n.js';

/*
 * The right rail in "Projektek" mode: every project with its open card count, "Összes" for the overview,
 * and + for a new project. RailMode switches between this and the categories.
 */
export function RailMode({ mode, onMode }) {
  return (
    <div className="rail-mode" role="tablist" aria-label={t('Menü')}>
      <button type="button" role="tab" aria-selected={mode !== 'projects'} className={mode !== 'projects' ? 'on' : ''} onClick={() => onMode('cats')} title={t('Kategóriák')}>
        ▦
      </button>
      <button type="button" role="tab" aria-selected={mode === 'projects'} className={mode === 'projects' ? 'on' : ''} onClick={() => onMode('projects')} title={t('Projektek')}>
        ◧
      </button>
    </div>
  );
}

export default function ProjectRail({ projects, active, onSelect, onAdd, mode, onMode }) {
  const item = (id, icon, label, count, warn) => (
    <button key={id ?? 'all'} className={`rail-item ${active === id ? 'on' : ''}`} onClick={() => onSelect(id)} aria-current={active === id ? 'page' : undefined} title={label}>
      <span className="rail-ic" aria-hidden>
        {icon}
      </span>
      <span className="rail-lb">{label}</span>
      {count != null && <i className={`rail-n ${warn ? 'warn' : ''}`}>{count}</i>}
    </button>
  );
  return (
    <nav className="rail rail-projects" aria-label={t('Projektek')}>
      <RailMode mode={mode} onMode={onMode} />
      {item(null, '▤', t('Összes'))}
      <div className="rail-list">{(projects ?? []).filter((p) => p.status !== 'done').map((p) => item(p.id, p.icon || '◆', p.name, p.counts.open, p.counts.overdue > 0))}</div>
      <div className="rail-tools">
        <button className="rail-item rail-tool" onClick={onAdd} title={t('Új projekt')}>
          <span className="rail-ic" aria-hidden>
            +
          </span>
          <span className="rail-lb">{t('Projekt')}</span>
        </button>
      </div>
    </nav>
  );
}
