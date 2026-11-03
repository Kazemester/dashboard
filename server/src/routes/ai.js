import { Router } from 'express';
import { q } from '../db.js';
import { aiConfig, chat, invalidateAiConfig, listModels, strongConfig } from '../llm.js';
import { HttpError } from '../util.js';

// AI provider settings edited in the header ("AI" button). The key is write-only from the UI.
const r = Router();

const publicView = async () => {
  const c = await aiConfig();
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    visionModel: c.visionModel,
    configured: c.configured,
    hasKey: Boolean(c.apiKey),
    keyHint: c.apiKey ? `…${c.apiKey.slice(-4)}` : null,
    keySource: c.keySource, // 'db' | 'env' | null
    strong: await strongView(),
  };
};

// the external / strong model (optional), key never sent back
async function strongView() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'ai'");
  const s = rows[0]?.value?.strong ?? {};
  return {
    baseUrl: s.baseUrl ?? '',
    model: s.model ?? '',
    hasKey: Boolean(s.apiKey),
    keyHint: s.apiKey ? `…${s.apiKey.slice(-4)}` : null,
    route: { command: Boolean(s.route?.command), background: Boolean(s.route?.background) },
    configured: Boolean((await strongConfig())?.configured),
  };
}
const cleanModel = (m) => String(m).trim().replace(/^ollama\s+(pull|run)\s+/i, '').replace(/\s+/g, '').slice(0, 100) || undefined;

r.get('/settings/ai', async (_req, res) => res.json(await publicView()));

r.put('/settings/ai', async (req, res) => {
  const { baseUrl, model, apiKey, visionModel } = req.body ?? {};
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
  if (visionModel !== undefined) next.visionModel = String(visionModel).trim().replace(/^ollama\s+(pull|run)\s+/i, '').replace(/\s+/g, '').slice(0, 100) || undefined;
  // apiKey: omitted = keep, '' / null = remove, string = replace
  if (apiKey !== undefined) next.apiKey = apiKey ? String(apiKey).trim() : undefined;
  const st = req.body?.strong;
  if (st && typeof st === 'object') {
    const cur2 = { ...(cur.strong ?? {}) };
    if (st.baseUrl !== undefined) {
      if (st.baseUrl && !/^https?:\/\/[^\s]+$/i.test(st.baseUrl)) throw new HttpError(400, 'A külső modell API címe http(s):// kezdetű legyen');
      cur2.baseUrl = st.baseUrl || undefined;
    }
    if (st.model !== undefined) cur2.model = cleanModel(st.model);
    if (st.apiKey !== undefined) cur2.apiKey = st.apiKey ? String(st.apiKey).trim() : undefined;
    if (st.route && typeof st.route === 'object') cur2.route = { command: Boolean(st.route.command), background: Boolean(st.route.background) };
    next.strong = cur2;
  }
  await q(
    `INSERT INTO settings (key, value) VALUES ('ai', $1)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [JSON.stringify(next)],
  );
  invalidateAiConfig();
  res.json(await publicView());
});

// Models the saved provider offers — for the model picker in the dialog.
r.get('/settings/ai/models', async (req, res) => {
  if (req.query.which === 'strong') {
    const c = await strongConfig();
    if (!c) throw new HttpError(400, 'Előbb mentsd el a külső modell címét és kulcsát.');
    return res.json(await listModels(c));
  }
  res.json(await listModels());
});

// Send a tiny prompt with the saved settings so the user sees right away whether they work.
r.post('/settings/ai/test', async (req, res) => {
  const started = Date.now();
  const config = req.query.which === 'strong' ? await strongConfig() : undefined;
  if (req.query.which === 'strong' && !config) throw new HttpError(400, 'Nincs beállítva külső modell.');
  const answer = await chat([{ role: 'user', content: 'Reply with the single word: OK' }], { temperature: 0, config });
  res.json({ ok: true, answer: answer.slice(0, 80), ms: Date.now() - started });
});

export default r;
