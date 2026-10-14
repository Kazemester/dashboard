import { Router } from 'express';
import { q } from '../db.js';
import { aiConfig, chat, invalidateAiConfig, listModels } from '../llm.js';
import { HttpError } from '../util.js';

// AI provider settings edited in the header ("AI" button). The key is write-only from the UI.
const r = Router();

const publicView = async () => {
  const c = await aiConfig();
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    configured: c.configured,
    hasKey: Boolean(c.apiKey),
    keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : null,
    keySource: c.keySource, // 'db' | 'env' | null
  };
};

r.get('/settings/ai', async (_req, res) => res.json(await publicView()));

r.put('/settings/ai', async (req, res) => {
  const { baseUrl, model, apiKey } = req.body ?? {};
  const { rows } = await q("SELECT value FROM settings WHERE key = 'ai'");
  const cur = rows[0]?.value ?? {};
  const next = { ...cur };
  if (baseUrl !== undefined) {
    if (baseUrl && !/^https?:\/\/[^\s]+$/i.test(baseUrl)) throw new HttpError(400, 'Az API cím http(s):// kezdetű legyen');
    next.baseUrl = baseUrl || undefined;
  }
  if (model !== undefined) {
    // people paste "ollama pull qwen2.5:7b" — keep just the model name
    next.model = String(model).trim().replace(/^ollama\s+(pull|run)\s+/i, '').replace(/\s+/g, '').slice(0, 100) || undefined;
  }
  // apiKey: omitted = keep, '' / null = remove, string = replace
  if (apiKey !== undefined) next.apiKey = apiKey ? String(apiKey).trim() : undefined;
  await q(
    `INSERT INTO settings (key, value) VALUES ('ai', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(next)],
  );
  invalidateAiConfig();
  res.json(await publicView());
});

// Models the saved provider offers — for the model picker in the dialog.
r.get('/settings/ai/models', async (_req, res) => {
  res.json(await listModels());
});

// Send a tiny prompt with the saved settings so the user sees right away whether they work.
r.post('/settings/ai/test', async (_req, res) => {
  const started = Date.now();
  const answer = await chat([{ role: 'user', content: 'Reply with the single word: OK' }], { temperature: 0 });
  res.json({ ok: true, answer: answer.slice(0, 80), ms: Date.now() - started });
});

export default r;
