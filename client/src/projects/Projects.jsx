import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { isoDay } from '../hooks.js';
import { locale, t } from '../i18n.js';
import useBackdropClose from '../components/useBackdropClose.js';
import './projects.css';

/*
 * Projektek: the overview of every project and one project's Kanban board (columns of cards). On a desktop the
 * cards are dragged between columns; on a phone the card's editor (tap) moves them, and the ‹ › buttons step.
 */
const ICONS = ['◆', '▲', '●', '■', '★', '⌂', '⚙', '✎', '◎', '✉', '$', '♥'];
const PRIO = [
  ['', 'Nincs'],
  ['low', 'Alacsony'],
  ['normal', 'Normál'],
  ['high', 'Magas'],
  ['urgent', 'Sürgős'],
];
const today = () => isoDay(new Date());
const tomorrow = () => isoDay(new Date(Date.now() + 86_400_000));
const fmtDay = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(locale(), { month: 'short', day: 'numeric' }) : '');
const dueClass = (d, done) => (!d || done ? '' : d < today() ? 'late' : d <= tomorrow() ? 'soon' : '');

function Modal({ title, onClose, children, foot }) {
  const backdrop = useBackdropClose(onClose);
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);
  return (
    <div className="overlay center" {...backdrop}>
      <div className="modal pj-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label={t('Bezárás')}>
            ✕
          </button>
        </div>
        <div className="form">{children}</div>
        {foot && <div className="modal-foot">{foot}</div>}
      </div>
    </div>
  );
}

// ---------- project settings (new / edit) ----------
export function ProjectEditor({ project, onClose, onSaved, onDeleted }) {
  const isNew = !project?.id;
  const [f, setF] = useState(() => ({ name: '', icon: '◆', client: '', due: '', status: 'active', notes: '', keywords: '', ...(project ?? {}), due: project?.due ?? '' }));
  const [cols, setCols] = useState(project?.columns ?? null);
  const [err, setErr] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const body = { name: f.name, icon: f.icon, client: f.client, due: f.due || null, status: f.status, notes: f.notes, keywords: f.keywords, ...(cols ? { columns: cols } : {}) };
      const saved = isNew ? await api.post('/projects', body) : await api.patch(`/projects/${project.id}`, body);
      onSaved(saved);
    } catch (e) {
      setErr(e.message);
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!confirm(t('Törlöd a(z) „{name}” projektet az összes kártyájával?', { name: project.name }))) return;
    await api.del(`/projects/${project.id}`);
    onDeleted?.();
  };
  const moveCol = (i, d) => setCols((cs) => {
    const next = [...cs];
    const j = i + d;
    if (j < 0 || j >= next.length) return cs;
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  return (
    <Modal
      title={isNew ? t('Új projekt') : t('Projekt beállításai')}
      onClose={onClose}
      foot={
        <>
          {!isNew && (
            <button className="btn btn-ghost danger-text" onClick={remove} style={{ marginRight: 'auto' }}>
              {t('Projekt törlése')}
            </button>
          )}
          <button className="btn btn-primary" onClick={save} disabled={busy || !f.name.trim()}>
            {busy ? t('Mentés…') : isNew ? t('Létrehozás') : t('Mentés')}
          </button>
        </>
      }
    >
      <label className="form-row">
        <span className="label">{t('Név')}</span>
        <input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('pl. Miskolc statika')} autoFocus />
      </label>
      <div className="form-row">
        <span className="label">{t('Ikon')}</span>
        <div className="chips">
          {ICONS.map((i) => (
            <button key={i} type="button" className={`chip pj-icon ${f.icon === i ? 'chip-on' : ''}`} onClick={() => set({ icon: i })}>
              {i}
            </button>
          ))}
        </div>
      </div>
      <div className="pj-two">
        <label className="form-row">
          <span className="label">{t('Ügyfél / partner')}</span>
          <input className="input" value={f.client ?? ''} onChange={(e) => set({ client: e.target.value })} placeholder={t('pl. Omniber Kft.')} />
        </label>
        <label className="form-row">
          <span className="label">{t('Határidő')}</span>
          <input className="input" type="date" value={f.due ?? ''} onChange={(e) => set({ due: e.target.value })} />
        </label>
      </div>
      {!isNew && (
        <label className="form-row">
          <span className="label">{t('Állapot')}</span>
          <select className="input" value={f.status} onChange={(e) => set({ status: e.target.value })}>
            <option value="active">{t('Aktív')}</option>
            <option value="paused">{t('Szünetel')}</option>
            <option value="done">{t('Lezárva (a menüből kikerül)')}</option>
          </select>
        </label>
      )}
      <label className="form-row">
        <span className="label">{t('Jegyzet')}</span>
        <textarea className="input" rows={3} value={f.notes ?? ''} onChange={(e) => set({ notes: e.target.value })} placeholder={t('Elérhetőségek, linkek, fontos tudnivalók…')} />
      </label>
      <label className="form-row">
        <span className="label">{t('Kulcsszavak a levelekhez')}</span>
        <input className="input" value={f.keywords ?? ''} onChange={(e) => set({ keywords: e.target.value })} placeholder={t('pl. Omniber, Miskolc, statika')} />
        <span className="help">{t('Vesszővel elválasztva. Ezekből ismeri fel később, melyik levél tartozik a projekthez.')}</span>
      </label>
      {cols && (
        <div className="form-row">
          <span className="label">{t('Oszlopok')}</span>
          {cols.map((c, i) => (
            <div key={c.id} className="pj-col-edit">
              <input className="input sm" value={c.name} onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
              <label className="small pj-done-check" title={t('Az ide tett kártyák késznek számítanak')}>
                <input type="checkbox" checked={Boolean(c.done)} onChange={(e) => setCols((cs) => cs.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} /> {t('kész')}
              </label>
              <button type="button" className="icon-btn" onClick={() => moveCol(i, -1)} aria-label={t('Fel')}>
                ↑
              </button>
              <button type="button" className="icon-btn" onClick={() => moveCol(i, 1)} aria-label={t('Le')}>
                ↓
              </button>
              <button type="button" className="icon-btn danger" onClick={() => cols.length > 1 && setCols((cs) => cs.filter((_, j) => j !== i))} aria-label={t('Törlés')}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost sm" onClick={() => setCols((cs) => [...cs, { id: `c${Date.now().toString(36)}`, name: t('Új oszlop') }])}>
            + {t('Oszlop')}
          </button>
        </div>
      )}
      {err && <div className="w-error sm">{err}</div>}
    </Modal>
  );
}

// ---------- card editor ----------
function CardEditor({ card, project, onClose, onSaved }) {
  const [f, setF] = useState({ title: card.title, body: card.body ?? '', due: card.due ?? '', assignee: card.assignee ?? '', priority: card.priority ?? '', col: card.col });
  const [err, setErr] = useState(null);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const save = async () => {
    try {
      await api.patch(`/cards/${card.id}`, { ...f, due: f.due || null, priority: f.priority || null });
      onSaved();
    } catch (e) {
      setErr(e.message);
    }
  };
  const remove = async () => {
    if (!confirm(t('Törlöd ezt a kártyát?'))) return;
    await api.del(`/cards/${card.id}`);
    onSaved();
  };
  return (
    <Modal
      title={t('Kártya')}
      onClose={onClose}
      foot={
        <>
          <button className="btn btn-ghost danger-text" onClick={remove} style={{ marginRight: 'auto' }}>
            {t('Törlés')}
          </button>
          <button className="btn btn-primary" onClick={save} disabled={!f.title.trim()}>
            {t('Mentés')}
          </button>
        </>
      }
    >
      <label className="form-row">
        <span className="label">{t('Cím')}</span>
        <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} />
      </label>
      <div className="form-row">
        <span className="label">{t('Oszlop')}</span>
        <div className="chips">
          {project.columns.map((c) => (
            <button key={c.id} type="button" className={`chip ${f.col === c.id ? 'chip-on' : ''}`} onClick={() => set({ col: c.id })}>
              {c.name}
            </button>
          ))}
        </div>
      </div>
      <div className="pj-two">
        <label className="form-row">
          <span className="label">{t('Határidő')}</span>
          <input className="input" type="date" value={f.due} onChange={(e) => set({ due: e.target.value })} />
        </label>
        <label className="form-row">
          <span className="label">{t('Felelős')}</span>
          <input className="input" value={f.assignee} onChange={(e) => set({ assignee: e.target.value })} placeholder={t('pl. én, Péter, statikus')} />
        </label>
      </div>
      <label className="form-row">
        <span className="label">{t('Prioritás')}</span>
        <select className="input" value={f.priority} onChange={(e) => set({ priority: e.target.value })}>
          {PRIO.map(([k, l]) => (
            <option key={k} value={k}>
              {t(l)}
            </option>
          ))}
        </select>
      </label>
      <label className="form-row">
        <span className="label">{t('Leírás')}</span>
        <textarea className="input" rows={4} value={f.body} onChange={(e) => set({ body: e.target.value })} />
      </label>
      {err && <div className="w-error sm">{err}</div>}
    </Modal>
  );
}

// ---------- one project's board ----------
function Board({ project, onEdit, onChanged, addSignal }) {
  const [cards, setCards] = useState(null);
  const [editing, setEditing] = useState(null);
  const [adding, setAdding] = useState(null); // column id with an open "new card" field
  const [draft, setDraft] = useState('');
  const [drag, setDrag] = useState(null); // { id, over: colId, before: cardId|null }
  const load = useCallback(() => api.get(`/projects/${project.id}/cards`).then(setCards).catch(() => setCards([])), [project.id]);
  useEffect(() => {
    setCards(null);
    load();
  }, [load]);
  // the dock's + adds a card to the first column
  useEffect(() => {
    if (addSignal) setAdding(project.columns[0]?.id);
  }, [addSignal]); // eslint-disable-line react-hooks/exhaustive-deps

  const changed = () => (load(), onChanged());
  const byCol = useMemo(() => {
    const m = Object.fromEntries(project.columns.map((c) => [c.id, []]));
    for (const c of cards ?? []) (m[c.col] ?? m[project.columns[0].id]).push(c);
    for (const k in m) m[k].sort((a, b) => a.sort - b.sort || a.id - b.id);
    return m;
  }, [cards, project.columns]);
  const total = cards?.length ?? 0;
  const doneIds = new Set(project.columns.filter((c) => c.done).map((c) => c.id));
  const doneN = (cards ?? []).filter((c) => doneIds.has(c.col)).length;

  const add = async (col) => {
    const title = draft.trim();
    if (!title) return setAdding(null);
    await api.post(`/projects/${project.id}/cards`, { title, col });
    setDraft('');
    changed();
  };
  const move = async (card, col, before = null) => {
    const list = byCol[col].filter((c) => c.id !== card.id);
    let sort;
    if (before != null) {
      const i = list.findIndex((c) => c.id === before);
      const next = list[i]?.sort ?? 1;
      const prev = i > 0 ? list[i - 1].sort : next - 2;
      sort = (prev + next) / 2;
    } else sort = (list.at(-1)?.sort ?? 0) + 1;
    setCards((cs) => cs.map((c) => (c.id === card.id ? { ...c, col, sort } : c))); // at once, the server follows
    await api.patch(`/cards/${card.id}`, { col, sort });
    changed();
  };
  const step = (card, d) => {
    const i = project.columns.findIndex((c) => c.id === card.col);
    const to = project.columns[i + d];
    if (to) move(card, to.id);
  };

  return (
    <div className="pj-board">
      <header className="pj-head">
        <div className="pj-title">
          <span className="pj-big-icon">{project.icon}</span>
          <div>
            <h2>{project.name}</h2>
            <span className="muted small">
              {[project.client, project.due && `${t('határidő')}: ${fmtDay(project.due)}`, total ? t('{done}/{total} kész', { done: doneN, total }) : null].filter(Boolean).join(' · ')}
            </span>
          </div>
        </div>
        <div className="pj-head-actions">
          <button className="btn btn-primary sm" onClick={() => setAdding(project.columns[0]?.id)}>
            + {t('Kártya')}
          </button>
          <button className="btn btn-ghost sm" onClick={onEdit}>
            ⚙ {t('Projekt')}
          </button>
        </div>
      </header>
      {total > 0 && (
        <div className="pj-progress" aria-hidden>
          <i style={{ width: `${(doneN / total) * 100}%` }} />
        </div>
      )}
      {project.notes && <p className="pj-notes small">{project.notes}</p>}
      {!cards ? (
        <div className="loading">{t('BETÖLTÉS…')}</div>
      ) : (
        <div className="pj-cols">
          {project.columns.map((col, ci) => (
            <section
              key={col.id}
              className={`pj-col ${drag?.over === col.id ? 'over' : ''} ${col.done ? 'done' : ''}`}
              onDragOver={(e) => (e.preventDefault(), drag && drag.over !== col.id && setDrag({ ...drag, over: col.id, before: null }))}
              onDrop={(e) => {
                e.preventDefault();
                const card = cards.find((c) => c.id === drag?.id);
                if (card) move(card, col.id, drag.before);
                setDrag(null);
              }}
            >
              <div className="pj-col-head">
                <b>{col.name}</b>
                <span className="muted small">{byCol[col.id].length}</span>
              </div>
              <div className="pj-cards">
                {byCol[col.id].map((c) => (
                  <article
                    key={c.id}
                    className={`pj-card prio-${c.priority || 'none'} ${drag?.id === c.id ? 'dragging' : ''} ${drag?.before === c.id ? 'drop-before' : ''}`}
                    draggable
                    onDragStart={(e) => (e.dataTransfer.setData('text/plain', String(c.id)), setDrag({ id: c.id, over: col.id, before: null }))}
                    onDragEnd={() => setDrag(null)}
                    onDragOver={(e) => (e.preventDefault(), e.stopPropagation(), drag && drag.id !== c.id && (drag.before !== c.id || drag.over !== col.id) && setDrag({ ...drag, over: col.id, before: c.id }))}
                    onClick={() => setEditing(c)}
                  >
                    <div className="pj-card-title">{c.title}</div>
                    <div className="pj-card-meta">
                      {c.due && <span className={`pj-due ${dueClass(c.due, col.done)}`}>◷ {fmtDay(c.due)}</span>}
                      {c.assignee && <span className="pj-who">@{c.assignee}</span>}
                      {c.priority && c.priority !== 'normal' && <span className={`pj-prio ${c.priority}`}>{t(PRIO.find((p) => p[0] === c.priority)?.[1])}</span>}
                      {c.body && <span className="muted" title={c.body}>≡</span>}
                      <span className="pj-step">
                        {ci > 0 && (
                          <button type="button" className="icon-btn" onClick={(e) => (e.stopPropagation(), step(c, -1))} aria-label={t('Előző oszlop')}>
                            ‹
                          </button>
                        )}
                        {ci < project.columns.length - 1 && (
                          <button type="button" className="icon-btn" onClick={(e) => (e.stopPropagation(), step(c, 1))} aria-label={t('Következő oszlop')}>
                            ›
                          </button>
                        )}
                      </span>
                    </div>
                  </article>
                ))}
              </div>
              {adding === col.id ? (
                <form className="pj-add" onSubmit={(e) => (e.preventDefault(), add(col.id))}>
                  <input className="input sm" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('Kártya címe…')} autoFocus onBlur={() => !draft.trim() && setAdding(null)} />
                  <button className="btn btn-primary sm">{t('Hozzáadás')}</button>
                </form>
              ) : (
                <button type="button" className="btn btn-ghost sm pj-add-btn" onClick={() => (setAdding(col.id), setDraft(''))}>
                  + {t('Kártya')}
                </button>
              )}
            </section>
          ))}
        </div>
      )}
      {editing && <CardEditor card={editing} project={project} onClose={() => setEditing(null)} onSaved={() => (setEditing(null), changed())} />}
    </div>
  );
}

// ---------- every project ----------
function Overview({ projects, onOpen, onNew }) {
  const list = projects ?? [];
  const active = list.filter((p) => p.status !== 'done');
  const closed = list.filter((p) => p.status === 'done');
  if (!list.length)
    return (
      <div className="pj-empty">
        <h2>{t('Projektek')}</h2>
        <p className="muted">{t('Egy projekt egy Kanban tábla: oszlopok (Teendő → Folyamatban → Vár valakire → Kész) és kártyák határidővel, felelőssel. A határidős kártyákról értesítés jön, és az asszisztens is látja őket.')}</p>
        <button className="btn btn-primary" onClick={onNew}>
          + {t('Első projekt')}
        </button>
      </div>
    );
  const card = (p) => {
    const pct = p.counts.total ? Math.round((p.counts.done / p.counts.total) * 100) : 0;
    return (
      <button key={p.id} type="button" className={`pj-tile ${p.status}`} onClick={() => onOpen(p.id)}>
        <span className="pj-tile-head">
          <span className="pj-big-icon">{p.icon}</span>
          <span className="pj-tile-name">
            <b>{p.name}</b>
            {p.client && <span className="muted small">{p.client}</span>}
          </span>
        </span>
        <span className="pj-progress">
          <i style={{ width: `${pct}%` }} />
        </span>
        <span className="pj-tile-stats small">
          <span>{t('{n} nyitott', { n: p.counts.open })}</span>
          {p.counts.overdue > 0 && <span className="pj-due late">{t('{n} lejárt', { n: p.counts.overdue })}</span>}
          {p.nextDue && <span className={`pj-due ${dueClass(p.nextDue)}`}>◷ {fmtDay(p.nextDue)}</span>}
          {p.status === 'paused' && <span className="muted">{t('szünetel')}</span>}
        </span>
      </button>
    );
  };
  return (
    <div className="pj-overview">
      <header className="pj-head">
        <h2>{t('Projektek')}</h2>
        <button className="btn btn-primary sm" onClick={onNew}>
          + {t('Új projekt')}
        </button>
      </header>
      <div className="pj-grid">{active.map(card)}</div>
      {closed.length > 0 && (
        <details className="pj-closed">
          <summary className="muted small">{t('Lezárt projektek ({n})', { n: closed.length })}</summary>
          <div className="pj-grid">{closed.map(card)}</div>
        </details>
      )}
    </div>
  );
}

export default function ProjectsView({ projects, active, onOpen, onChanged, onNew, addSignal }) {
  const [edit, setEdit] = useState(null);
  const project = active ? projects?.find((p) => p.id === active) : null;
  return (
    <main className="pj-main">
      {project ? <Board project={project} onEdit={() => setEdit(project)} onChanged={onChanged} addSignal={addSignal} /> : <Overview projects={projects} onOpen={onOpen} onNew={onNew} />}
      {edit && (
        <ProjectEditor
          project={edit}
          onClose={() => setEdit(null)}
          onSaved={() => (setEdit(null), onChanged())}
          onDeleted={() => (setEdit(null), onOpen(null), onChanged())}
        />
      )}
    </main>
  );
}
