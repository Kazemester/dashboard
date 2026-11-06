import { HttpError } from './util.js';

// Widget configs may reference secrets as {{secret:NAME}}; the value is read from the
// SECRET_NAME environment variable on the server, so API keys never reach the browser.
export function resolveSecrets(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{\s*secret:([A-Z0-9_]+)\s*\}\}/gi, (_, name) => {
    const v = process.env[`SECRET_${name.toUpperCase()}`];
    // a missing secret is a configuration problem, not a server error
    if (v === undefined) throw new HttpError(400, `Hiányzó beállítás: SECRET_${name.toUpperCase()} (.env)`);
    return v;
  });
}

export function resolveSecretsDeep(obj) {
  if (typeof obj === 'string') return resolveSecrets(obj);
  if (Array.isArray(obj)) return obj.map(resolveSecretsDeep);
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, resolveSecretsDeep(v)]));
  }
  return obj;
}
