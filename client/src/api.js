import { t } from './i18n.js';

// A failed fetch (no HTTP answer at all). Behind Cloudflare Access an expired login looks the same: the
// request is redirected to the login page on another domain, which the browser refuses — so check for that.
async function networkError() {
  try {
    const probe = await fetch('/api/health', { redirect: 'manual', cache: 'no-store' });
    if (probe.type === 'opaqueredirect' || probe.status === 0) return new Error(t('A belépésed lejárt: töltsd újra az oldalt, és lépj be újra.'));
  } catch {
    /* the server is not reachable at all */
  }
  return new Error(t('Nem érem el a szervert (hálózati hiba). Ellenőrizd a kapcsolatot, és próbáld újra.'));
}

const PROXY_STATUS = {
  502: 'A szerver épp nem válaszol (újraindul?). Próbáld újra pár másodperc múlva.',
  524: 'A kérés túl sokáig tartott, a Cloudflare megszakította. Próbáld újra.',
  530: 'A szerver nem érhető el (a tunnel nem fut?).',
};

async function request(method, url, body) {
  let res;
  try {
    res = await fetch(`/api${url}`, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw await networkError();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || (PROXY_STATUS[res.status] ? t(PROXY_STATUS[res.status]) : `HTTP ${res.status}`));
  return data;
}

const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));

// POST that may answer with { job }: the work runs on the server in the background, poll until it is done.
async function postJob(url, body, { every = 1500, timeout = 15 * 60_000 } = {}) {
  const first = await request('POST', url, body);
  if (!first?.job) return first;
  const until = Date.now() + timeout;
  let misses = 0;
  while (Date.now() < until) {
    await sleep(every);
    let r;
    try {
      r = await request('GET', `/jobs/${first.job}`);
      misses = 0;
    } catch (err) {
      // a phone that sleeps or switches networks drops a poll or two: keep trying for a while
      if (++misses >= 8) throw err;
      continue;
    }
    if (r.state === 'done') return r.result;
  }
  throw new Error(t('Az AI nem válaszolt időben. Próbáld újra, vagy válassz kisebb modellt.'));
}

export const api = {
  get: (url) => request('GET', url),
  post: (url, body = {}) => request('POST', url, body),
  postJob: (url, body = {}) => postJob(url, body),
  patch: (url, body) => request('PATCH', url, body),
  put: (url, body) => request('PUT', url, body),
  del: (url) => request('DELETE', url),
};
