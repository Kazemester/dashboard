import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { q } from '../db.js';
import { HttpError } from '../util.js';

/*
 * Projects (the right rail's "Projektek" mode). Each has a Kanban board: its own columns (the one marked
 * done counts as finished) and cards with a due date, assignee and priority. Cards due soon show in the bell.
 */
const r = Router();
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const DEFAULT_COLUMNS = [
  { id: 'todo', name: 'Teendő' },
  { id: 'doing', name: 'Folyamatban' },
  { id: 'waiting', name: 'Vár valakire' },
  { id: 'done', name: 'Kész', done: true },
];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];
const str = (v, max) => (v == null || v === '' ? null : String(v).trim().slice(0, max) || null);
const day = (v) => (v == null || v === '' ? null : DAY.test(String(v)) ? String(v) : undefined);

const cols = (p) => (Array.isArray(p.columns) && p.columns.length ? p.columns : DEFAULT_COLUMNS);
const doneCols = (p) => new Set(cols(p).filter((c) => c.done).map((c) => c.id));

async function project(id) {
  const { rows } = await q('SELECT * FROM projects WHERE id = $1', [id]);
  if (!rows[0]) throw new HttpError(404, 'Nincs ilyen projekt');
  return rows[0];
}

// project + its numbers for the rail and the overview
export async function listProjects() {
  const { rows: ps } = await q('SELECT * FROM projects ORDER BY sort, created_at');
  const { rows: cards } = await q('SELECT project_id, col, due FROM project_cards');
  const today = new Date().toISOString().slice(0, 10);
  return ps.map((p) => {
    const done = doneCols(p);
    const mine = cards.filter((c) => c.project_id === p.id);
    const open = mine.filter((c) => !done.has(c.col));
    const dues = open.map((c) => c.due).filter(Boolean).sort();
    return { ...p, columns: cols(p), counts: { total: mine.length, open: open.length, done: mine.length - open.length, overdue: dues.filter((d) => d < today).length }, nextDue: dues[0] ?? null };
  });
}

r.get('/projects', async (_req, res) => res.json(await listProjects()));

r.post('/projects', async (req, res) => {
  const b = req.body ?? {};
  const name = str(b.name, 80);
  if (!name) throw new HttpError(400, 'Adj nevet a projektnek.');
  const { rows: m } = await q('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM projects');
  const { rows } = await q(
    'INSERT INTO projects (id, name, icon, color, client, due, notes, keywords, columns, sort) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *',
    [randomUUID(), name, str(b.icon, 4) ?? '◆', str(b.color, 20), str(b.client, 120), day(b.due) ?? null, str(b.notes, 4000), str(b.keywords, 300), JSON.stringify(DEFAULT_COLUMNS), m[0].s],
  );
  res.status(201).json(rows[0]);
});

r.patch('/projects/:id', async (req, res) => {
  const p = await project(req.params.id);
  const b = req.body ?? {};
  const next = { ...p };
  for (const [k, max] of [['name', 80], ['icon', 4], ['color', 20], ['client', 120], ['notes', 4000], ['keywords', 300]]) if (b[k] !== undefined) next[k] = str(b[k], max);
  if (!next.name) throw new HttpError(400, 'A név nem lehet üres.');
  if (b.due !== undefined) {
    if (day(b.due) === undefined) throw new HttpError(400, 'A határidő ÉÉÉÉ-HH-NN legyen');
    next.due = day(b.due);
  }
  if (b.status !== undefined) next.status = ['active', 'paused', 'done'].includes(b.status) ? b.status : 'active';
  if (b.sort !== undefined) next.sort = Number(b.sort) || 0;
  if (Array.isArray(b.columns)) {
    const seen = new Set();
    const list = b.columns
      .map((c) => ({ id: str(c.id, 40) ?? randomUUID().slice(0, 8), name: str(c.name, 40) ?? '?', ...(c.done ? { done: true } : {}) }))
      .filter((c) => !seen.has(c.id) && seen.add(c.id));
    if (!list.length) throw new HttpError(400, 'Legalább egy oszlop kell.');
    // cards of a removed column move to the first one
    const keep = new Set(list.map((c) => c.id));
    await q('UPDATE project_cards SET col = $2 WHERE project_id = $1 AND NOT (col = ANY($3))', [p.id, list[0].id, [...keep]]);
    next.columns = list;
  }
  const { rows } = await q(
    'UPDATE projects SET name=$2, icon=$3, color=$4, client=$5, due=$6, notes=$7, keywords=$8, status=$9, sort=$10, columns=$11 WHERE id=$1 RETURNING *',
    [p.id, next.name, next.icon ?? '◆', next.color, next.client, next.due, next.notes, next.keywords, next.status, next.sort, JSON.stringify(cols(next))],
  );
  res.json(rows[0]);
});

r.delete('/projects/:id', async (req, res) => {
  await q('DELETE FROM projects WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
});

// ---------- cards ----------
r.get('/projects/:id/cards', async (req, res) => {
  await project(req.params.id);
  const { rows } = await q('SELECT * FROM project_cards WHERE project_id = $1 ORDER BY col, sort, id', [req.params.id]);
  res.json(rows);
});

export async function addCard(projectId, b) {
  const p = await project(projectId);
  const title = str(b.title, 200);
  if (!title) throw new HttpError(400, 'A kártyának kell cím.');
  const col = cols(p).some((c) => c.id === b.col) ? b.col : cols(p)[0].id;
  if (day(b.due) === undefined) throw new HttpError(400, 'A határidő ÉÉÉÉ-HH-NN legyen');
  const { rows: m } = await q('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM project_cards WHERE project_id = $1 AND col = $2', [p.id, col]);
  const { rows } = await q(
    'INSERT INTO project_cards (project_id, col, title, body, due, assignee, priority, sort, done_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *',
    [p.id, col, title, str(b.body, 4000), day(b.due), str(b.assignee, 60), PRIORITIES.includes(b.priority) ? b.priority : null, m[0].s, doneCols(p).has(col) ? new Date() : null],
  );
  return rows[0];
}
r.post('/projects/:id/cards', async (req, res) => res.status(201).json(await addCard(req.params.id, req.body ?? {})));

r.patch('/cards/:cid', async (req, res) => {
  const { rows: found } = await q('SELECT * FROM project_cards WHERE id = $1', [req.params.cid]);
  const c = found[0];
  if (!c) throw new HttpError(404, 'Nincs ilyen kártya');
  const p = await project(c.project_id);
  const b = req.body ?? {};
  const next = { ...c };
  if (b.title !== undefined) next.title = str(b.title, 200) ?? c.title;
  if (b.body !== undefined) next.body = str(b.body, 4000);
  if (b.assignee !== undefined) next.assignee = str(b.assignee, 60);
  if (b.priority !== undefined) next.priority = PRIORITIES.includes(b.priority) ? b.priority : null;
  if (b.due !== undefined) {
    if (day(b.due) === undefined) throw new HttpError(400, 'A határidő ÉÉÉÉ-HH-NN legyen');
    next.due = day(b.due);
  }
  if (b.col !== undefined && cols(p).some((x) => x.id === b.col) && b.col !== c.col) {
    next.col = b.col;
    // dropped without a position: to the end of the column
    if (b.sort === undefined) next.sort = Number((await q('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM project_cards WHERE project_id = $1 AND col = $2', [p.id, b.col])).rows[0].s);
  }
  if (b.sort !== undefined && Number.isFinite(Number(b.sort))) next.sort = Number(b.sort);
  const done = doneCols(p).has(next.col);
  next.done_at = done ? c.done_at ?? new Date() : null;
  const { rows } = await q(
    'UPDATE project_cards SET col=$2, title=$3, body=$4, due=$5, assignee=$6, priority=$7, sort=$8, done_at=$9, updated_at=now() WHERE id=$1 RETURNING *',
    [c.id, next.col, next.title, next.body, next.due, next.assignee, next.priority, next.sort, next.done_at],
  );
  res.json(rows[0]);
});

r.delete('/cards/:cid', async (req, res) => {
  await q('DELETE FROM project_cards WHERE id = $1', [req.params.cid]);
  res.json({ ok: true });
});

export default r;
