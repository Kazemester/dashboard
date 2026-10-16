import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { migrate } from './db.js';
import { aiConfig } from './llm.js';
import dashboard from './routes/dashboard.js';
import habits from './routes/habits.js';
import progress from './routes/progress.js';
import pomodoro from './routes/pomodoro.js';
import calendar from './routes/calendar.js';
import feeds from './routes/feeds.js';
import chatRoutes from './routes/chat.js';
import mail, { startMailScheduler } from './routes/mail.js';
import items from './routes/items.js';
import system from './routes/system.js';
import markets from './routes/markets.js';
import env from './routes/env.js';
import homeassistant from './routes/homeassistant.js';
import brief from './routes/brief.js';
import stocks from './routes/stocks.js';
import ai from './routes/ai.js';
import render, { recoverRenders } from './routes/render.js';

const app = express();
// Render uploads carry a whole image; everything else stays small.
app.use('/api/widgets/:id/render', express.json({ limit: '17mb' }));
app.use(express.json({ limit: '1mb' }));

// Optional HTTP Basic auth — set DASHBOARD_PASSWORD before exposing the app on a VM.
const PASSWORD = process.env.DASHBOARD_PASSWORD;
const DOMAIN = process.env.DOMAIN; // set when Caddy publishes the dashboard on the internet
if (DOMAIN && (!PASSWORD || PASSWORD.length < 12 || PASSWORD === 'change-me')) {
  console.error('DOMAIN is set, so the dashboard is public: set a DASHBOARD_PASSWORD of at least 12 characters in .env.');
  process.exit(1);
}
// Behind Caddy (same Docker network) the client IP comes from X-Forwarded-For.
app.set('trust proxy', 'loopback, uniquelocal');

// Brute-force brake: too many wrong passwords from one IP → locked out for a while.
const FAIL_LIMIT = 10;
const FAIL_WINDOW = 15 * 60_000;
const failures = new Map(); // ip → { count, until }
function tooManyFailures(ip) {
  const f = failures.get(ip);
  if (!f) return false;
  if (Date.now() > f.until) {
    failures.delete(ip);
    return false;
  }
  return f.count >= FAIL_LIMIT;
}
function recordFailure(ip) {
  const f = failures.get(ip);
  if (!f || Date.now() > f.until) failures.set(ip, { count: 1, until: Date.now() + FAIL_WINDOW });
  else f.count++;
  if (failures.size > 10_000) failures.clear(); // don't let a flood of IPs grow memory
}

if (PASSWORD) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    if (tooManyFailures(req.ip)) return res.status(429).send('Too many failed logins, try again in 15 minutes.');
    const [, b64 = ''] = (req.headers.authorization || '').split(' ');
    const pass = Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':');
    const a = Buffer.from(pass);
    const b = Buffer.from(PASSWORD);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      failures.delete(req.ip);
      return next();
    }
    if (req.headers.authorization) recordFailure(req.ip); // the first, credential-less request is not a failure
    res.set('WWW-Authenticate', 'Basic realm="NEXUS"').status(401).send('Authentication required');
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/status', async (_req, res) => {
  const ai = await aiConfig();
  res.json({ llm: ai.configured, model: ai.model });
});

for (const router of [dashboard, habits, progress, pomodoro, calendar, feeds, chatRoutes, mail, items, system, markets, env, homeassistant, brief, stocks, ai, render]) {
  app.use('/api', router);
}
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

// Serve the built frontend (production / Docker).
const staticDir = process.env.STATIC_DIR || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
app.use(express.static(staticDir));
app.get('/{*splat}', (_req, res, next) => res.sendFile(path.join(staticDir, 'index.html'), (err) => err && next()));

app.use((err, _req, res, _next) => {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: err.message || 'Internal error' });
});

const port = Number(process.env.PORT) || 3000;
await migrate();
await recoverRenders();
startMailScheduler();
app.listen(port, () => console.log(`NEXUS dashboard listening on :${port}`));
