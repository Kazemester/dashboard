import { Router } from 'express';
import { q } from '../db.js';
import { getWidget } from '../util.js';

const r = Router();
const COLS = 'id, at, kind, title, detail, widget_id, status, meta';

const kindList = (v) =>
  String(v ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);

// Recent activities: ?q= (title/detail search) &kind=a,b &limit= &before=<id> (older page)
r.get('/widgets/:id/activity', async (req, res) => {
  await getWidget(req.params.id, 'activity');
  const params = [];
  const where = [];
  const search = String(req.query.q ?? '').trim();
  if (search) {
    const like = `%${search.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    where.push(`(title ILIKE $${params.push(like)} OR detail ILIKE $${params.length})`);
  }
  const kinds = kindList(req.query.kind);
  if (kinds.length) where.push(`kind = ANY($${params.push(kinds)})`);
  const before = Number(req.query.before);
  if (Number.isInteger(before) && before > 0) where.push(`id < $${params.push(before)}`);
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
  const { rows } = await q(
    `SELECT ${COLS} FROM activity_log ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY id DESC LIMIT ${limit + 1}`,
    params,
  );
  const more = rows.length > limit;
  res.json({ items: rows.slice(0, limit), more });
});

r.get('/widgets/:id/activity/kinds', async (req, res) => {
  await getWidget(req.params.id, 'activity');
  const { rows } = await q('SELECT kind, COUNT(*)::int AS count FROM activity_log GROUP BY kind ORDER BY count DESC');
  res.json(rows);
});

export default r;
