import { q } from './db.js';

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export async function getWidget(id, type) {
  const { rows } = await q('SELECT * FROM widgets WHERE id = $1', [id]);
  const w = rows[0];
  if (!w || (type && w.type !== type)) throw new HttpError(404, 'Widget not found');
  return w;
}

// Tiny in-memory TTL cache for upstream calls (calendar feeds, weather, RSS...).
const cache = new Map();
export async function cached(key, ttlMs, fn) {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await fn();
  cache.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}
export function invalidate(prefix) {
  for (const k of cache.keys()) if (k.startsWith(prefix)) cache.delete(k);
}
