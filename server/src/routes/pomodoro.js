import { Router } from 'express';
import { q } from '../db.js';
import { getWidget } from '../util.js';
import { logFocus } from '../activity.js';

const r = Router();

async function stats(widgetId) {
  const { rows } = await q(
    `SELECT d::date AS day,
            COALESCE(SUM(s.duration_sec) FILTER (WHERE s.kind = 'focus'), 0)::int AS focus_sec,
            COUNT(s.id) FILTER (WHERE s.kind = 'focus')::int AS sessions
     FROM generate_series(CURRENT_DATE - 6, CURRENT_DATE, interval '1 day') d
     LEFT JOIN pomodoro_sessions s
       ON s.widget_id = $1 AND s.completed_at::date = d::date
     GROUP BY d ORDER BY d`,
    [widgetId],
  );
  return { week: rows, today: rows[rows.length - 1] };
}

r.get('/widgets/:id/pomodoro', async (req, res) => {
  await getWidget(req.params.id, 'pomodoro');
  res.json(await stats(req.params.id));
});

r.post('/widgets/:id/pomodoro', async (req, res) => {
  await getWidget(req.params.id, 'pomodoro');
  const { kind = 'focus', duration_sec = 0 } = req.body ?? {};
  await q('INSERT INTO pomodoro_sessions (widget_id, kind, duration_sec) VALUES ($1, $2, $3)', [
    req.params.id,
    kind,
    Math.max(0, Math.round(duration_sec)),
  ]);
  logFocus(req.params.id, kind, duration_sec);
  res.status(201).json(await stats(req.params.id));
});

export default r;
