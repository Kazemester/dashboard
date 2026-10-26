import { Router } from 'express';
import { q } from '../db.js';
import { llmConfigured, NOT_CONFIGURED } from '../llm.js';
import { agentTurn } from '../agent.js';
import { HttpError } from '../util.js';

/*
 * The AI command bar in the header: the same dashboard agent as the AI Chat tile, without needing a tile.
 * Its short history lives in settings ('assistant'), newest last.
 */
const r = Router();
const KEY = 'assistant';
const KEEP = 40;

async function history() {
  const { rows } = await q('SELECT value FROM settings WHERE key = $1', [KEY]);
  return Array.isArray(rows[0]?.value) ? rows[0].value : [];
}
const save = (list) =>
  q(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [KEY, JSON.stringify(list.slice(-KEEP))],
  );

r.get('/assistant', async (_req, res) => res.json(await history()));

r.delete('/assistant', async (_req, res) => {
  await save([]);
  res.json({ ok: true });
});

r.post('/assistant', async (req, res) => {
  const text = String(req.body?.content ?? '').trim().slice(0, 2000);
  if (!text) throw new HttpError(400, 'content is required');
  if (!(await llmConfigured())) throw new HttpError(400, NOT_CONFIGURED);
  const past = await history();
  const catalog = req.body?.catalog && typeof req.body.catalog === 'object' ? req.body.catalog : null;
  const turn = [...past.slice(-12).map(({ role, content }) => ({ role, content })), { role: 'user', content: text }];
  let answer;
  let meta;
  try {
    ({ answer, meta } = await agentTurn({ lang: req.body?.lang, history: turn, catalog, mode: 'full' }));
  } catch (err) {
    throw new HttpError(err.status || 502, err.message);
  }
  const at = new Date().toISOString();
  await save([...past, { role: 'user', content: text, at }, { role: 'assistant', content: answer, meta, at }]);
  res.json({ answer, meta });
});

export default r;
