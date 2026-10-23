import { Router } from 'express';
import { getWidget, cached, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

const r = Router();

async function getJson(url, headers = {}) {
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new HttpError(502, `${new URL(url).host} ${res.status}: ${body?.message || body?.error || ''}`.trim());
  return body;
}

// ---------- Crypto watchlist (CoinGecko, no key) ----------
r.get('/widgets/:id/crypto', async (req, res) => {
  const w = await getWidget(req.params.id, 'crypto');
  const ids = String(w.config.coins || 'bitcoin,ethereum').replace(/\s+/g, '').toLowerCase();
  const vs = (w.config.currency || 'usd').toLowerCase();
  const data = await cached(`crypto:${ids}:${vs}`, 2 * 60_000, () =>
    getJson(
      `https://api.coingecko.com/api/v3/coins/markets?vs_currency=${vs}&ids=${encodeURIComponent(ids)}` +
        '&sparkline=true&price_change_percentage=24h,7d',
    ),
  );
  res.json({
    currency: vs,
    coins: data.map((c) => ({
      id: c.id,
      symbol: c.symbol.toUpperCase(),
      name: c.name,
      price: c.current_price,
      change24h: c.price_change_percentage_24h_in_currency ?? c.price_change_percentage_24h,
      change7d: c.price_change_percentage_7d_in_currency,
      // ~168 hourly points; thin out to keep the payload small
      spark: (c.sparkline_in_7d?.price ?? []).filter((_, i) => i % 4 === 0),
    })),
  });
});

// ---------- Currency converter (Frankfurter / ECB, no key) ----------
r.get('/fx', async (req, res) => {
  const base = String(req.query.base || 'EUR').toUpperCase();
  if (!/^[A-Z]{3}$/.test(base)) throw new HttpError(400, 'Invalid currency');
  res.json(await cached(`fx:${base}`, 3600_000, () => getJson(`https://api.frankfurter.app/latest?from=${base}`)));
});

// ---------- GitHub repos ----------
r.get('/widgets/:id/github', async (req, res) => {
  const w = await getWidget(req.params.id, 'github');
  const repos = String(w.config.repos || '')
    .split(/[\s,]+/)
    .filter((x) => /^[\w.-]+\/[\w.-]+$/.test(x));
  let token = '';
  try {
    token = resolveSecrets(w.config.token || (process.env.SECRET_GITHUB_TOKEN ? '{{secret:GITHUB_TOKEN}}' : ''));
  } catch {
    /* no token: unauthenticated (60 req/h) */
  }
  const headers = { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const out = await Promise.all(
    repos.map((repo) =>
      cached(`gh:${repo}:${Boolean(token)}`, 10 * 60_000, async () => {
        const [info, pulls] = await Promise.all([
          getJson(`https://api.github.com/repos/${repo}`, headers),
          getJson(`https://api.github.com/repos/${repo}/pulls?state=open&per_page=5`, headers).catch(() => []),
        ]);
        return {
          repo,
          url: info.html_url,
          description: info.description,
          stars: info.stargazers_count,
          forks: info.forks_count,
          openTotal: info.open_issues_count, // GitHub counts open issues + PRs together
          pushedAt: info.pushed_at,
          language: info.language,
          pulls: pulls.map((p) => ({ title: p.title, url: p.html_url, number: p.number, user: p.user?.login })),
        };
      }).catch((err) => ({ repo, error: err.message })),
    ),
  );
  res.json(out);
});

export default r;
