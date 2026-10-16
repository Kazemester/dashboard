import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { q } from '../db.js';
import { HttpError, invalidate } from '../util.js';

const r = Router();

r.get('/dashboard', async (_req, res) => {
  const [{ rows: widgets }, { rows: s }] = await Promise.all([
    q('SELECT id, type, title, config FROM widgets ORDER BY created_at'),
    q("SELECT key, value FROM settings WHERE key IN ('layouts', 'appearance', 'canvas')"),
  ]);
  const setting = (k) => s.find((x) => x.key === k)?.value;
  res.json({ widgets, layouts: setting('layouts') ?? {}, appearance: setting('appearance') ?? null, canvas: setting('canvas') ?? null });
});

// Tile positions on the desktop infinite canvas (grid cells; the world grows as needed).
const int = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
r.put('/settings/canvas', async (req, res) => {
  const items = req.body;
  if (!Array.isArray(items) || items.length > 2000) throw new HttpError(400, 'canvas must be an array');
  const clean = items.map((l) => {
    if (typeof l?.i !== 'string' || !int(l.x, 0, 100000) || !int(l.y, 0, 100000) || !int(l.w, 1, 100) || !int(l.h, 1, 200)) {
      throw new HttpError(400, 'invalid canvas item');
    }
    return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, ...(int(l.minW, 1, 100) ? { minW: l.minW } : {}), ...(int(l.minH, 1, 200) ? { minH: l.minH } : {}) };
  });
  await q(
    `INSERT INTO settings (key, value) VALUES ('canvas', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(clean)],
  );
  res.json({ ok: true });
});

// Theme + custom colours chosen in the header.
const HEX = /^#[0-9a-f]{6}$/i;
r.put('/settings/appearance', async (req, res) => {
  const { theme, bg = null, accent = null } = req.body ?? {};
  if (typeof theme !== 'string' || !/^[a-z]{1,30}$/.test(theme)) throw new HttpError(400, 'invalid theme');
  for (const c of [bg, accent]) if (c !== null && !HEX.test(c)) throw new HttpError(400, 'colours must be #rrggbb');
  const value = { theme, bg, accent };
  await q(
    `INSERT INTO settings (key, value) VALUES ('appearance', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(value)],
  );
  res.json(value);
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
