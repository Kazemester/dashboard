import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { q } from '../db.js';
import { HttpError, invalidate } from '../util.js';

const r = Router();

r.get('/dashboard', async (_req, res) => {
  const [{ rows: widgets }, { rows: s }] = await Promise.all([
    q('SELECT id, type, title, config FROM widgets ORDER BY created_at'),
    q("SELECT value FROM settings WHERE key = 'layouts'"),
  ]);
  res.json({ widgets, layouts: s[0]?.value ?? {} });
});

r.put('/layouts', async (req, res) => {
  await q(
    `INSERT INTO settings (key, value) VALUES ('layouts', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(req.body ?? {})],
  );
  res.json({ ok: true });
});

r.post('/widgets', async (req, res) => {
  const { type, title, config = {} } = req.body ?? {};
  if (!type || !title) throw new HttpError(400, 'type and title are required');
  const id = randomUUID();
  const { rows } = await q(
    'INSERT INTO widgets (id, type, title, config) VALUES ($1, $2, $3, $4) RETURNING id, type, title, config',
    [id, type, title, JSON.stringify(config)],
  );
  res.status(201).json(rows[0]);
});

r.patch('/widgets/:id', async (req, res) => {
  const { title, config } = req.body ?? {};
  const { rows } = await q(
    `UPDATE widgets SET title = COALESCE($2, title), config = COALESCE($3, config)
     WHERE id = $1 RETURNING id, type, title, config`,
    [req.params.id, title ?? null, config ? JSON.stringify(config) : null],
  );
  if (!rows[0]) throw new HttpError(404, 'Widget not found');
  invalidate(`${req.params.id}:`);
  res.json(rows[0]);
});

r.delete('/widgets/:id', async (req, res) => {
  await q('DELETE FROM widgets WHERE id = $1', [req.params.id]);
  invalidate(`${req.params.id}:`);
  res.json({ ok: true });
});

export default r;
