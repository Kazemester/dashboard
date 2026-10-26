import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { q } from '../db.js';
import { HttpError, invalidate } from '../util.js';
import { logTile } from '../activity.js';

const r = Router();

r.get('/dashboard', async (_req, res) => {
  const [{ rows: widgets }, { rows: s }] = await Promise.all([
    q('SELECT id, type, title, config FROM widgets ORDER BY created_at'),
    q("SELECT key, value FROM settings WHERE key IN ('layouts', 'appearance', 'canvas', 'categories', 'profile')"),
  ]);
  const setting = (k) => s.find((x) => x.key === k)?.value;
  res.json({
    widgets,
    layouts: setting('layouts') ?? {},
    appearance: setting('appearance') ?? null,
    canvas: setting('canvas') ?? null,
    categories: setting('categories') ?? [],
    profile: setting('profile') ?? {},
  });
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

const saveSetting = (key, value) =>
  q(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, JSON.stringify(value)],
  );

// One canvas / phone-grid item: grid cells, as on the main canvas.
function cleanItem(l) {
  if (typeof l?.i !== 'string' || !int(l.x, 0, 100000) || !int(l.y, 0, 100000) || !int(l.w, 1, 100) || !int(l.h, 1, 200)) {
    throw new HttpError(400, 'invalid layout item');
  }
  return { i: l.i, x: l.x, y: l.y, w: l.w, h: l.h, ...(int(l.minW, 1, 100) ? { minW: l.minW } : {}), ...(int(l.minH, 1, 200) ? { minH: l.minH } : {}) };
}

// User-made categories (right-hand rail): which tiles they hold, and their own canvas / phone layout.
r.put('/settings/categories', async (req, res) => {
  const list = req.body;
  if (!Array.isArray(list) || list.length > 50) throw new HttpError(400, 'categories must be an array (max 50)');
  const ids = new Set();
  const clean = list.map((c) => {
    if (typeof c?.id !== 'string' || !/^[a-z0-9-]{1,40}$/.test(c.id) || ids.has(c.id)) throw new HttpError(400, 'invalid category id');
    ids.add(c.id);
    const name = String(c.name ?? '').trim().slice(0, 40);
    if (!name) throw new HttpError(400, 'category name is required');
    const tiles = Array.isArray(c.tiles) ? [...new Set(c.tiles.filter((x) => typeof x === 'string'))].slice(0, 500) : [];
    const canvas = Array.isArray(c.canvas) ? c.canvas.slice(0, 500).map(cleanItem) : [];
    const layout = Array.isArray(c.layout) ? c.layout.slice(0, 500).map(cleanItem) : [];
    return { id: c.id, name, icon: String(c.icon ?? '◆').slice(0, 4), tiles, canvas, layout };
  });
  await saveSetting('categories', clean);
  res.json(clean);
});

// Who the dashboard greets.
r.put('/settings/profile', async (req, res) => {
  const name = String(req.body?.name ?? '').trim().slice(0, 40);
  await saveSetting('profile', { name });
  res.json({ name });
});

// Theme + custom colours chosen in the header.
const HEX = /^#[0-9a-f]{6}$/i;
r.put('/settings/appearance', async (req, res) => {
  const { theme, bg = null, accent = null, anim } = req.body ?? {};
  if (typeof theme !== 'string' || !/^[a-z]{1,30}$/.test(theme)) throw new HttpError(400, 'invalid theme');
  for (const c of [bg, accent]) if (c !== null && !HEX.test(c)) throw new HttpError(400, 'colours must be #rrggbb');
  if (anim !== undefined && typeof anim !== 'boolean') throw new HttpError(400, 'anim must be true or false');
  const value = { theme, bg, accent, ...(anim === undefined ? {} : { anim }) };
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
  logTile('add', rows[0]);
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
  const { rows: gone } = await q('DELETE FROM widgets WHERE id = $1 RETURNING id, type, title', [req.params.id]);
  logTile('remove', gone[0]);
  invalidate(`${req.params.id}:`);
  res.json({ ok: true });
});

export default r;
