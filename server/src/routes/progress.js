import { Router } from 'express';
import { q } from '../db.js';
import { getWidget, HttpError } from '../util.js';
import { logGoal } from '../activity.js';

const r = Router();
const COLS = 'id, label, value, target, unit, color, sort';

r.get('/widgets/:id/progress', async (req, res) => {
  await getWidget(req.params.id, 'progress');
  const { rows: items } = await q(
    `SELECT ${COLS} FROM progress_items WHERE widget_id = $1 ORDER BY sort, id`,
    [req.params.id],
  );
  const { rows: hist } = await q(
    `SELECT h.item_id, h.value, h.created_at FROM progress_history h
     JOIN progress_items i ON i.id = h.item_id
     WHERE i.widget_id = $1 AND h.created_at > now() - interval '60 days'
     ORDER BY h.created_at`,
    [req.params.id],
  );
  const byItem = {};
  for (const h of hist) (byItem[h.item_id] ??= []).push({ value: h.value, at: h.created_at });
  res.json(items.map((i) => ({ ...i, history: byItem[i.id] ?? [] })));
});

r.post('/widgets/:id/progress', async (req, res) => {
  await getWidget(req.params.id, 'progress');
  const { label, value = 0, target = 100, unit = '', color = '#00f0ff' } = req.body ?? {};
  if (!label?.trim()) throw new HttpError(400, 'label is required');
  const { rows } = await q(
    `INSERT INTO progress_items (widget_id, label, value, target, unit, color, sort)
     VALUES ($1, $2, $3, $4, $5, $6,
       (SELECT COALESCE(MAX(sort), 0) + 1 FROM progress_items WHERE widget_id = $1))
     RETURNING ${COLS}`,
    [req.params.id, label.trim(), value, target, unit, color],
  );
  await q('INSERT INTO progress_history (item_id, value) VALUES ($1, $2)', [rows[0].id, value]);
  logGoal('add', req.params.id, rows[0]);
  res.status(201).json({ ...rows[0], history: [] });
});

r.patch('/progress/:pid', async (req, res) => {
  const { label, value, target, unit, color } = req.body ?? {};
  const { rows } = await q(
    `UPDATE progress_items SET
       label = COALESCE($2, label), value = COALESCE($3, value), target = COALESCE($4, target),
       unit = COALESCE($5, unit), color = COALESCE($6, color)
     WHERE id = $1 RETURNING ${COLS}`,
    [req.params.pid, label ?? null, value ?? null, target ?? null, unit ?? null, color ?? null],
  );
  if (!rows[0]) throw new HttpError(404, 'Item not found');
  if (value !== undefined) {
    logGoal('update', null, rows[0]);
    await q('INSERT INTO progress_history (item_id, value) VALUES ($1, $2)', [rows[0].id, value]);
  }
  res.json(rows[0]);
});

r.delete('/progress/:pid', async (req, res) => {
  await q('DELETE FROM progress_items WHERE id = $1', [req.params.pid]);
  res.json({ ok: true });
});

export default r;
