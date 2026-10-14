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
const isLocal = (url) => /\/\/(localhost|127\.0\.0\.1|host\.docker\.internal|ollama)(:|\/)/i.test(url);

export async function aiConfig() {
  const s = await saved();
  const baseUrl = (s.baseUrl || process.env.LLM_BASE_URL || DEFAULT_BASE).replace(/\/$/, '');
  const apiKey = s.apiKey || process.env.LLM_API_KEY || '';
  const model = s.model || process.env.LLM_MODEL || DEFAULT_MODEL;
  return {
    baseUrl,
    apiKey,
    model,
    configured: Boolean(apiKey) || isLocal(baseUrl),
    keySource: s.apiKey ? 'db' : process.env.LLM_API_KEY ? 'env' : null,
  };
}

export async function llmConfigured() {
  return (await aiConfig()).configured;
}

export const NOT_CONFIGURED = 'Nincs AI kulcs beállítva. Fejléc → AI gomb → add meg a szolgáltatót és az API kulcsot.';

export async function chat(messages, { model, temperature = 0.4, json = false, config } = {}) {
  const c = config ?? (await aiConfig());
  if (!c.configured) throw new HttpError(400, NOT_CONFIGURED);
  const body = { model: model || c.model, messages, temperature };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${c.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(c.apiKey ? { Authorization: `Bearer ${c.apiKey}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new HttpError(502, `AI szolgáltató hiba (${res.status}): ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
