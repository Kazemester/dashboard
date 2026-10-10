import { Router } from 'express';
import { q } from '../db.js';
import { getWidget, HttpError } from '../util.js';

const r = Router();

// 'YYYY-MM' → 'YYYY-MM-01' (defaults to the current month)
function monthStart(m) {
  if (m === undefined) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(m)) throw new HttpError(400, 'month must be YYYY-MM');
  return `${m}-01`;
}

// Habits visible in a month, with that month's check-ins and the current streak.
r.get('/widgets/:id/habits', async (req, res) => {
  await getWidget(req.params.id, 'habits');
  const month = monthStart(req.query.month);
  const { rows: habits } = await q(
    `SELECT id, name, color, start_month FROM habits
     WHERE widget_id = $1 AND start_month <= $2::date AND (end_month IS NULL OR end_month > $2::date)
     ORDER BY id`,
    [req.params.id, month],
  );
  const ids = habits.map((h) => h.id);
  const { rows: checks } = await q(
    `SELECT habit_id, day FROM habit_checks
     WHERE habit_id = ANY($1) AND day >= $2::date AND day < ($2::date + interval '1 month')`,
    [ids, month],
  );
  // Current streak: consecutive checked days ending today (or yesterday if today isn't done yet).
  const { rows: streaks } = await q(
    `WITH d AS (
       SELECT habit_id, day, day - (ROW_NUMBER() OVER (PARTITION BY habit_id ORDER BY day))::int AS grp
       FROM habit_checks WHERE habit_id = ANY($1) AND day <= CURRENT_DATE
     )
     SELECT habit_id, COUNT(*)::int AS streak FROM d
     GROUP BY habit_id, grp
     HAVING MAX(day) >= CURRENT_DATE - 1`,
    [ids],
  );
  const byHabit = {};
  for (const c of checks) (byHabit[c.habit_id] ??= []).push(c.day);
  const streakOf = Object.fromEntries(streaks.map((s) => [s.habit_id, s.streak]));
  res.json({
    month: month.slice(0, 7),
    habits: habits.map((h) => ({
      id: h.id,
      name: h.name,
      color: h.color,
      startMonth: h.start_month.slice(0, 7),
      days: byHabit[h.id] ?? [],
      streak: streakOf[h.id] ?? 0,
    })),
  });
});

r.post('/widgets/:id/habits', async (req, res) => {
  await getWidget(req.params.id, 'habits');
  const { name, color, month } = req.body ?? {};
  if (!name?.trim()) throw new HttpError(400, 'name is required');
  const { rows } = await q(
    `INSERT INTO habits (widget_id, name, color, start_month)
     VALUES ($1, $2, COALESCE($3, '#67e8f9'), $4) RETURNING id, name, color, start_month`,
    [req.params.id, name.trim(), color ?? null, monthStart(month)],
  );
  const h = rows[0];
  res.status(201).json({ id: h.id, name: h.name, color: h.color, startMonth: h.start_month.slice(0, 7), days: [], streak: 0 });
});

// Remove a habit from `month` onwards. History of earlier months is kept;
// if it is removed in the month it was added, it is deleted completely.
r.delete('/habits/:hid', async (req, res) => {
  const month = monthStart(req.query.month);
  const { rows } = await q('SELECT start_month FROM habits WHERE id = $1', [req.params.hid]);
  if (!rows[0]) throw new HttpError(404, 'Habit not found');
  if (rows[0].start_month >= month) {
    await q('DELETE FROM habits WHERE id = $1', [req.params.hid]);
  } else {
    await q('UPDATE habits SET end_month = $2 WHERE id = $1', [req.params.hid, month]);
    await q('DELETE FROM habit_checks WHERE habit_id = $1 AND day >= $2', [req.params.hid, month]);
  }
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
