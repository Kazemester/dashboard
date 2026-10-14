import { Router } from 'express';
import { q } from '../db.js';
import { chat, llmConfigured, NOT_CONFIGURED } from '../llm.js';
import { getWidget, HttpError } from '../util.js';

const r = Router();

r.get('/widgets/:id/chat', async (req, res) => {
  await getWidget(req.params.id, 'chat');
  const { rows } = await q(
    'SELECT id, role, content, created_at FROM chat_messages WHERE widget_id = $1 ORDER BY id',
    [req.params.id],
  );
  res.json(rows);
});

r.post('/widgets/:id/chat', async (req, res) => {
  const w = await getWidget(req.params.id, 'chat');
  const text = req.body?.content?.trim();
  if (!text) throw new HttpError(400, 'content is required');
  if (!(await llmConfigured())) throw new HttpError(400, NOT_CONFIGURED);

  const { rows: [userMsg] } = await q(
    "INSERT INTO chat_messages (widget_id, role, content) VALUES ($1, 'user', $2) RETURNING id",
    [w.id, text],
  );
  const { rows: history } = await q(
    'SELECT role, content FROM chat_messages WHERE widget_id = $1 ORDER BY id DESC LIMIT 30',
    [w.id],
  );
  const system = w.config.systemPrompt || 'You are NEXUS, a concise, helpful assistant living in a sci-fi dashboard.';
  let answer;
  try {
    answer = await chat([{ role: 'system', content: system }, ...history.reverse()], {
      model: w.config.model || undefined,
    });
  } catch (err) {
    // Don't leave an unanswered question in the history.
    await q('DELETE FROM chat_messages WHERE id = $1', [userMsg.id]);
    throw new HttpError(err.status || 502, err.message);
  }
  const { rows } = await q(
    "INSERT INTO chat_messages (widget_id, role, content) VALUES ($1, 'assistant', $2) RETURNING id, role, content, created_at",
    [w.id, answer],
  );
  res.json(rows[0]);
});

r.delete('/widgets/:id/chat', async (req, res) => {
  await q('DELETE FROM chat_messages WHERE widget_id = $1', [req.params.id]);
  res.json({ ok: true });
});

export default r;
