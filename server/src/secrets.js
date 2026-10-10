// Widget configs may reference secrets as {{secret:NAME}}; the value is read from the
// SECRET_NAME environment variable on the server, so API keys never reach the browser.
export function resolveSecrets(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/\{\{\s*secret:([A-Z0-9_]+)\s*\}\}/gi, (_, name) => {
    const v = process.env[`SECRET_${name.toUpperCase()}`];
    if (v === undefined) throw new Error(`Missing env var SECRET_${name.toUpperCase()}`);
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
