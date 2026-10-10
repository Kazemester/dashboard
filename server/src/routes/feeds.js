import { Router } from 'express';
import Parser from 'rss-parser';
import { getWidget, cached, HttpError } from '../util.js';
import { resolveSecrets, resolveSecretsDeep } from '../secrets.js';
import { weather } from '../services/openmeteo.js';

const r = Router();
const rss = new Parser({
  timeout: 15_000,
  // some feeds (e.g. Reddit) reject the default library user agent
  headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEXUS-dashboard/0.1; +https://github.com/Kazemester/dashboard)' },
});

// ---------- Weather (Open-Meteo, no API key needed) ----------
r.get('/widgets/:id/weather', async (req, res) => {
  const w = await getWidget(req.params.id, 'weather');
  res.json(await weather(w.config.city || 'Budapest'));
});

// ---------- News / RSS ----------
r.get('/widgets/:id/news', async (req, res) => {
  const w = await getWidget(req.params.id, 'news');
  const feeds = String(w.config.feeds || '')
    .split(/\s*\n\s*/)
    .filter(Boolean);
  const limit = Number(w.config.limit) || 15;
  const all = await Promise.all(
    feeds.map((url) =>
      cached(`${w.id}:rss:${url}`, 10 * 60_000, async () => {
        const feed = await rss.parseURL(resolveSecrets(url));
        return feed.items.map((it) => ({
          title: it.title,
          link: it.link,
          date: it.isoDate || it.pubDate,
          source: feed.title,
        }));
      }).catch((err) => [{ title: `⚠ ${url}: ${err.message}`, source: 'error' }]),
    ),
  );
  const items = all
    .flat()
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, limit);
  res.json({ items });
});

// ---------- Generic API connector ----------
// Fetch any HTTP JSON API server-side (no CORS issues, secrets stay on the server).
function pick(obj, path) {
  if (!path) return obj;
  return path
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .filter(Boolean)
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

r.get('/widgets/:id/api', async (req, res) => {
  const w = await getWidget(req.params.id, 'api');
  const { url, method = 'GET', headers = '', body = '', path = '', refreshSec = 300 } = w.config;
  if (!url) throw new HttpError(400, 'Set an URL in the widget settings');
  const ttl = Math.max(10, Number(refreshSec) || 300) * 1000 - 1000;
  const data = await cached(`${w.id}:api`, ttl, async () => {
    let hdrs = {};
    if (headers.trim()) {
      try {
        hdrs = JSON.parse(headers);
      } catch {
        throw new HttpError(400, 'Headers must be valid JSON');
      }
    }
    const upstream = await fetch(resolveSecrets(url), {
      method,
      headers: resolveSecretsDeep(hdrs),
      body: method !== 'GET' && body ? resolveSecrets(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await upstream.text();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
    if (!upstream.ok) throw new HttpError(502, `Upstream ${upstream.status}: ${text.slice(0, 200)}`);
    return pick(parsed, path);
  });
  res.json({ data, fetchedAt: new Date().toISOString() });
});

export default r;
