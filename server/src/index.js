import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { timingSafeEqual } from 'node:crypto';
import { migrate } from './db.js';
import { llmConfigured } from './llm.js';
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

const app = express();
app.use(express.json({ limit: '1mb' }));

// Optional HTTP Basic auth — set DASHBOARD_PASSWORD before exposing the app on a VM.
const PASSWORD = process.env.DASHBOARD_PASSWORD;
if (PASSWORD) {
  app.use((req, res, next) => {
    if (req.path === '/api/health') return next();
    const [, b64 = ''] = (req.headers.authorization || '').split(' ');
    const pass = Buffer.from(b64, 'base64').toString().split(':').slice(1).join(':');
    const a = Buffer.from(pass);
    const b = Buffer.from(PASSWORD);
    if (a.length === b.length && timingSafeEqual(a, b)) return next();
    res.set('WWW-Authenticate', 'Basic realm="NEXUS"').status(401).send('Authentication required');
  });
}

app.get('/api/health', (_req, res) => res.json({ ok: true }));
app.get('/api/status', (_req, res) => res.json({ llm: llmConfigured(), model: process.env.LLM_MODEL || 'grok-4' }));

for (const router of [dashboard, habits, progress, pomodoro, calendar, feeds, chatRoutes, mail, items, system, markets, env, homeassistant, brief]) {
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
startMailScheduler();
app.listen(port, () => console.log(`NEXUS dashboard listening on :${port}`));
