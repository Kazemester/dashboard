// Minimal OpenAI-compatible chat client. Works with xAI Grok, OpenAI, OpenRouter, Ollama, LM Studio...
// Settings come from the dashboard UI (settings 'ai' in the DB); the LLM_* env vars are the fallback.
import { q } from './db.js';
import { HttpError } from './util.js';

export const DEFAULT_BASE = 'https://api.x.ai/v1';
export const DEFAULT_MODEL = 'grok-4';

let cache = { at: 0, value: null };
export const invalidateAiConfig = () => (cache = { at: 0, value: null });

async function saved() {
  if (Date.now() - cache.at < 5000) return cache.value;
  const { rows } = await q("SELECT value FROM settings WHERE key = 'ai'");
  cache = { at: Date.now(), value: rows[0]?.value ?? {} };
  return cache.value;
}

// Local servers (Ollama, LM Studio) don't need a key.
export const isLocal = (url) => /\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|ollama)(:|\/)/i.test(url);

export async function aiConfig() {
  const s = await saved();
  const baseUrl = (s.baseUrl || process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = s.apiKey || process.env.LLM_API_KEY || '';
  const model = s.model || process.env.LLM_MODEL || DEFAULT_MODEL;
  return {
    baseUrl,
    apiKey,
    model,
    // model that can read images (screenshot import); empty = the main model
    visionModel: s.visionModel || process.env.LLM_VISION_MODEL || '',
    isLocal: isLocal(baseUrl),
    configured: Boolean(apiKey) || isLocal(baseUrl),
    keySource: s.apiKey ? 'db' : process.env.LLM_API_KEY ? 'env' : null,
  };
}

export async function llmConfigured() {
  return (await aiConfig()).configured;
}

export const NOT_CONFIGURED = 'Nincs AI kulcs beállítva. Fejléc → AI gomb → add meg a szolgáltatót és az API kulcsot.';

export async function chat(messages, opts = {}) {
  return (await complete(messages, opts)).content ?? '';
}

// Full assistant message, including tool_calls when `tools` (OpenAI function-calling format) are given.
export async function complete(messages, { model, temperature = 0.4, json = false, config, tools } = {}) {
  const c = config ?? (await aiConfig());
  if (!c.configured) throw new HttpError(400, NOT_CONFIGURED);
  const body = { model: model || c.model, messages, temperature };
  if (json) body.response_format = { type: 'json_object' };
  if (tools?.length) body.tools = tools;

  let res;
  try {
    res = await fetch(`${c.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}),
      },
      body: JSON.stringify(body),
      // local models on a laptop can need a few minutes for a long prompt
      signal: AbortSignal.timeout(isLocal(c.baseUrl) ? 600_000 : 120_000),
    });
  } catch (err) {
    // Node's fetch also gives up after 5 min without response headers (slow local models)
    if (err.name === 'TimeoutError' || err.cause?.code === 'UND_ERR_HEADERS_TIMEOUT') throw new HttpError(504, `Az AI nem válaszolt időben (${c.baseUrl}). Helyi modellnél próbálj kisebb modellt, vagy várj, amíg betölt.`);
    const local = isLocal(c.baseUrl);
    throw new HttpError(
      502,
      `Nem érem el az AI szolgáltatót: ${c.baseUrl}.${local ? ' Fut az Ollama? (Indítsd el az Ollama alkalmazást, vagy: ollama serve)' : ' Ellenőrizd a címet a fejléc AI beállításaiban.'}`,
    );
  }
  if (!res.ok) {
    const text = (await res.text()).slice(0, 300);
    let hint = '';
    // wrong model name → list what the provider actually offers
    if (tools?.length && /tool|function/i.test(text) && [400, 404, 422, 500].includes(res.status)) {
      throw Object.assign(new HttpError(502, `AI szolgáltató hiba (${res.status}): ${text}`), { toolsUnsupported: true });
    }
    if (/model/i.test(text) && [400, 404].includes(res.status)) {
      const available = await listModels(c).catch(() => []);
      hint = available.length
        ? ` — A(z) "${body.model}" modell nem elérhető. Elérhető modellek: ${available.slice(0, 15).join(', ')}`
        : ` — A(z) "${body.model}" modell nem elérhető ennél a szolgáltatónál.`;
    }
    throw new HttpError(502, `AI szolgáltató hiba (${res.status}): ${text}${hint}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message ?? { role: 'assistant', content: '' };
}

// Model ids offered by the provider (OpenAI-compatible GET /models — Ollama lists the pulled models).
export async function listModels(config) {
  const c = config ?? (await aiConfig());
  const res = await fetch(`${c.baseUrl}/models`, {
    headers: c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {},
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new HttpError(502, `A modell-lista nem kérhető le (${res.status})`);
  const data = await res.json();
  return (data.data ?? data.models ?? []).map((m) => m.id ?? m.name).filter(Boolean).sort();
}
