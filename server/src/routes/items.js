import { Router } from 'express';
import { q } from '../db.js';
import { getWidget, HttpError } from '../util.js';
import { logItem } from '../activity.js';

// Generic storage used by simple widgets (todo, counter, mood, expenses, metric log, notes).
const r = Router();
const COLS = 'id, kind, day, value, data, sort, created_at';
const DAY = /^\d{4}-\d{2}-\d{2}$/;

r.get('/widgets/:id/items', async (req, res) => {
  await getWidget(req.params.id);
  const { kind, from, to, limit } = req.query;
  const params = [req.params.id];
  let where = 'widget_id = $1';
  if (kind) where += ` AND kind = $${params.push(kind)}`;
  if (from) where += ` AND day >= $${params.push(from)}`;
  if (to) where += ` AND day <= $${params.push(to)}`;
  const lim = Math.min(Number(limit) || 2000, 5000);
  const { rows } = await q(
    `SELECT ${COLS} FROM widget_items WHERE ${where} ORDER BY sort, day NULLS LAST, id LIMIT ${lim}`,
    params,
  );
  res.json(rows);
});

r.post('/widgets/:id/items', async (req, res) => {
  await getWidget(req.params.id);
  const { kind = 'item', day = null, value = null, data = {}, sort } = req.body ?? {};
  if (day !== null && !DAY.test(day)) throw new HttpError(400, 'day must be YYYY-MM-DD');
  const { rows } = await q(
    `INSERT INTO widget_items (widget_id, kind, day, value, data, sort)
     VALUES ($1, $2, $3, $4, $5,
       COALESCE($6, (SELECT COALESCE(MAX(sort), 0) + 1 FROM widget_items WHERE widget_id = $1)))
     RETURNING ${COLS}`,
    [req.params.id, kind, day, value, JSON.stringify(data), sort ?? null],
  );
  logItem('add', req.params.id, rows[0]);
  res.status(201).json(rows[0]);
});

// Upsert one value per (widget, kind, day) — counters, mood, daily metrics.
r.put('/widgets/:id/items/day/:day', async (req, res) => {
  await getWidget(req.params.id);
  const { kind = 'item', value = null, data = {} } = req.body ?? {};
  if (!DAY.test(req.params.day)) throw new HttpError(400, 'day must be YYYY-MM-DD');
  const upd = await q(
    `UPDATE widget_items SET value = $4, data = $5 WHERE widget_id = $1 AND kind = $2 AND day = $3 RETURNING ${COLS}`,
    [req.params.id, kind, req.params.day, value, JSON.stringify(data)],
  );
  if (upd.rows[0]) return res.json(upd.rows[0]);
  const { rows } = await q(
    `INSERT INTO widget_items (widget_id, kind, day, value, data) VALUES ($1, $2, $3, $4, $5) RETURNING ${COLS}`,
    [req.params.id, kind, req.params.day, value, JSON.stringify(data)],
  );
  res.json(rows[0]);
});

r.patch('/items/:iid', async (req, res) => {
  const { day, value, data, sort } = req.body ?? {};
  if (day && !DAY.test(day)) throw new HttpError(400, 'day must be YYYY-MM-DD');
  const { rows } = await q(
    `UPDATE widget_items SET
       day = COALESCE($2, day), value = COALESCE($3, value),
       data = CASE WHEN $4::jsonb IS NULL THEN data ELSE data || $4::jsonb END,
       sort = COALESCE($5, sort)
     WHERE id = $1 RETURNING ${COLS}`,
    [req.params.iid, day ?? null, value ?? null, data ? JSON.stringify(data) : null, sort ?? null],
  );
  if (!rows[0]) throw new HttpError(404, 'Item not found');
  logItem('update', null, rows[0], req.body);
  res.json(rows[0]);
});

r.delete('/items/:iid', async (req, res) => {
  await q('DELETE FROM widget_items WHERE id = $1', [req.params.iid]);
  res.json({ ok: true });
});

r.post('/widgets/:id/items/delete', async (req, res) => {
  const ids = (req.body?.ids ?? []).map(Number).filter(Boolean);
  await q('DELETE FROM widget_items WHERE widget_id = $1 AND id = ANY($2)', [req.params.id, ids]);
  res.json({ ok: true });
});

r.get('/widgets/:id/state', async (req, res) => {
  await getWidget(req.params.id);
  const { rows } = await q('SELECT value, updated_at FROM widget_state WHERE widget_id = $1', [req.params.id]);
  res.json(rows[0] ?? { value: {}, updated_at: null });
});

r.put('/widgets/:id/state', async (req, res) => {
  await getWidget(req.params.id);
  const { rows } = await q(
    `INSERT INTO widget_state (widget_id, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (widget_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
     RETURNING value, updated_at`,
    [req.params.id, JSON.stringify(req.body ?? {})],
  );
  res.json(rows[0]);
});

export default r;
