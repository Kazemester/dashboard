import { Router } from 'express';
import { q } from '../db.js';
import { getWidget, HttpError } from '../util.js';

const r = Router();

r.get('/widgets/:id/habits', async (req, res) => {
  await getWidget(req.params.id, 'habits');
  const days = Math.min(Number(req.query.days) || 28, 366);
  const { rows: habits } = await q(
    'SELECT id, name, color FROM habits WHERE widget_id = $1 ORDER BY id',
    [req.params.id],
  );
  const { rows: checks } = await q(
    `SELECT c.habit_id, c.day FROM habit_checks c JOIN habits h ON h.id = c.habit_id
     WHERE h.widget_id = $1 AND c.day > CURRENT_DATE - $2::int`,
    [req.params.id, days + 400], // extra history so long streaks are counted correctly
  );
  const byHabit = {};
  for (const c of checks) (byHabit[c.habit_id] ??= []).push(c.day);
  res.json(habits.map((h) => ({ ...h, days: byHabit[h.id] ?? [] })));
});

r.post('/widgets/:id/habits', async (req, res) => {
  await getWidget(req.params.id, 'habits');
  const { name, color } = req.body ?? {};
  if (!name?.trim()) throw new HttpError(400, 'name is required');
  const { rows } = await q(
    'INSERT INTO habits (widget_id, name, color) VALUES ($1, $2, COALESCE($3, \'#00f0ff\')) RETURNING id, name, color',
    [req.params.id, name.trim(), color ?? null],
  );
  res.status(201).json({ ...rows[0], days: [] });
});

r.delete('/habits/:hid', async (req, res) => {
  await q('DELETE FROM habits WHERE id = $1', [req.params.hid]);
  res.json({ ok: true });
});

r.post('/habits/:hid/toggle', async (req, res) => {
  const day = req.body?.day;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) throw new HttpError(400, 'day must be YYYY-MM-DD');
  const del = await q('DELETE FROM habit_checks WHERE habit_id = $1 AND day = $2', [req.params.hid, day]);
  if (del.rowCount === 0) {
    await q('INSERT INTO habit_checks (habit_id, day) VALUES ($1, $2)', [req.params.hid, day]);
  }
  res.json({ checked: del.rowCount === 0 });
});

export default r;
