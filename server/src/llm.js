// Minimal OpenAI-compatible chat client. Works with xAI Grok, OpenAI, Ollama, LM Studio, OpenRouter...
export function llmConfigured() {
  return Boolean(process.env.LLM_API_KEY || process.env.LLM_BASE_URL?.includes('localhost'));
}

export async function chat(messages, { model, temperature = 0.4, json = false } = {}) {
  const base = (process.env.LLM_BASE_URL || 'https://api.x.ai/v1').replace(/\/$/, '');
  const body = {
    model: model || process.env.LLM_MODEL || 'grok-4',
    messages,
    temperature,
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`LLM API ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
