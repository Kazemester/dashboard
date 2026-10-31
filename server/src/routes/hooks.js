import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';
import { q } from '../db.js';
import { llmConfigured, NOT_CONFIGURED } from '../llm.js';
import { agentTurn } from '../agent.js';
import { HttpError } from '../util.js';
import { gatherNotifications } from './notifications.js';
import { sendPush } from '../push.js';

/*
 * Endpoints for iPhone Shortcuts (Parancsok) and other automations:
 *   POST /api/hook/ask      { text }            → the dashboard AI answers (for Siri to read out)
 *   GET  /api/hook/summary                      → today in a few sentences, no AI (instant)
 *   POST /api/hook/health   { date?, steps, … } → Egészség tile (+ ticks a habit when the step goal is met)
 *   POST /api/hook/capture  { text, url? }      → a to-do from the share sheet
 * Every call needs the hook token (X-Nexus-Token header). Behind Cloudflare Access the Shortcut also sends a
 * service token (CF-Access-Client-Id / -Secret), see the guide in the app.
 */
const r = Router();

async function hookSettings() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'hooks'");
  let s = rows[0]?.value;
  if (!s?.token) {
    s = { token: randomBytes(24).toString('base64url') };
    await q("INSERT INTO settings (key, value) VALUES ('hooks', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(s)]);
  }
  return s;
}

const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
async function needToken(req, _res, next) {
  const given = String(req.get('x-nexus-token') ?? req.query.token ?? '');
  const { token } = await hookSettings();
  if (!given || !same(given, token)) return next(new HttpError(401, 'Hibás vagy hiányzó kulcs (X-Nexus-Token).'));
  next();
}

// Shortcuts send numbers as text, with units and Hungarian separators ("8 432 lépés", "7,5 óra")
const n = (v) => {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const s = String(v ?? '').replace(/[^\d.,\-]/g, '').replace(',', '.');
  const x = parseFloat(s);
  return Number.isFinite(x) ? x : null;
};
const tz = process.env.PUSH_TZ || 'Europe/Budapest';
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());

// ---------- settings (from the app, behind the dashboard's own login) ----------
r.get('/hooks/config', async (_req, res) => {
  const { token } = await hookSettings();
  res.json({ token });
});
r.post('/hooks/rotate', async (_req, res) => {
  const s = { token: randomBytes(24).toString('base64url') };
  await q("INSERT INTO settings (key, value) VALUES ('hooks', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(s)]);
  res.json(s);
});

// ---------- Siri: ask the dashboard ----------
const ASK_WAIT = 75_000; // Shortcuts and Cloudflare give up after ~100 s
r.post('/hook/ask', needToken, async (req, res) => {
  const text = String(req.body?.text ?? req.body?.content ?? '').trim().slice(0, 2000);
  if (!text) throw new HttpError(400, 'Üres kérdés');
  if (!(await llmConfigured())) throw new HttpError(400, NOT_CONFIGURED);
  const lang = req.body?.lang === 'en' ? 'en' : 'hu';
  const work = agentTurn({ lang, history: [{ role: 'user', content: text }], mode: 'full' }).then((x) => x.answer);
  const slow = new Promise((ok) => setTimeout(() => ok(null), ASK_WAIT));
  const answer = await Promise.race([work, slow]);
  if (answer != null) return res.type('text/plain').send(answer);
  // a slow local model: answer now, deliver the result as a notification when it is ready
  work
    .then((a) => sendPush({ title: lang === 'en' ? 'Answer' : 'Válasz', body: `${text.slice(0, 60)} — ${a}`.slice(0, 400), url: '/', tag: 'ask' }))
    .catch((err) => sendPush({ title: 'NEXUS', body: err.message.slice(0, 200), url: '/', tag: 'ask' }).catch(() => {}));
  res.type('text/plain').send(lang === 'en' ? 'Still thinking — I will send the answer as a notification.' : 'Még gondolkodom, a választ értesítésben küldöm.');
});

// ---------- today, without AI (instant, for a morning Shortcut) ----------
r.all('/hook/summary', needToken, async (req, res) => {
  const en = req.query.lang === 'en' || req.body?.lang === 'en';
  const items = (await gatherNotifications(en ? 'en' : 'hu')).filter((x) => x.kind !== 'habit').slice(0, 6);
  const { rows: habits } = await q(
    `SELECT COUNT(*)::int AS open FROM habits h
     WHERE (h.start_month IS NULL OR h.start_month <= $1) AND (h.end_month IS NULL OR h.end_month > $1)
       AND NOT EXISTS (SELECT 1 FROM habit_checks c WHERE c.habit_id = h.id AND c.day = $2)`,
    [`${todayIso().slice(0, 7)}-01`, todayIso()],
  );
  const parts = [];
  if (items.length) parts.push((en ? 'Needs attention: ' : 'Figyelmet kér: ') + items.map((x) => (x.detail ? `${x.title} (${x.detail.toLowerCase()})` : x.title)).join('; ') + '.');
  else parts.push(en ? 'Nothing urgent today.' : 'Ma nincs sürgős teendő.');
  if (habits[0]?.open) parts.push(en ? `${habits[0].open} habit(s) left today.` : `Ma még ${habits[0].open} szokás vár.`);
  res.type('text/plain').send(parts.join(' '));
});

// ---------- Apple Health via Shortcuts ----------
const HEALTH_FIELDS = { steps: 'steps', lepes: 'steps', sleep: 'sleep', alvas: 'sleep', weight: 'weight', suly: 'weight', kcal: 'kcal', activeKcal: 'kcal', energy: 'kcal', restingHr: 'hr', hr: 'hr', pulzus: 'hr', distance: 'km', km: 'km', workouts: 'workouts', edzes: 'workouts', mindful: 'mindful' };

async function healthTile() {
  const { rows } = await q("SELECT id, config FROM widgets WHERE type = 'health' ORDER BY created_at LIMIT 1");
  if (rows[0]) return rows[0];
  const { rows: made } = await q(
    "INSERT INTO widgets (id, type, title, config) VALUES ($1, 'health', 'Egészség', $2) RETURNING id, config",
    [randomUUID(), JSON.stringify({ stepsGoal: 8000 })],
  );
  return made[0];
}

r.post('/hook/health', needToken, async (req, res) => {
  const body = req.body ?? {};
  const day = /^\d{4}-\d{2}-\d{2}$/.test(String(body.date ?? '')) ? body.date : todayIso();
  const vals = {};
  for (const [k, field] of Object.entries(HEALTH_FIELDS)) {
    if (body[k] === undefined || body[k] === '') continue;
    let v = n(body[k]);
    if (v == null) continue;
    if (field === 'sleep' && v > 24) v = v / 60; // minutes → hours
    vals[field] = Math.round(v * 100) / 100;
  }
  if (!Object.keys(vals).length) throw new HttpError(400, 'Nincs adat (pl. steps, sleep, weight, kcal, hr, km, workouts).');
  const w = await healthTile();
  const { rows } = await q("SELECT id, data FROM widget_items WHERE widget_id = $1 AND kind = 'health' AND day = $2", [w.id, day]);
  const data = { ...(rows[0]?.data ?? {}), ...vals, at: new Date().toISOString() };
  if (rows[0]) await q('UPDATE widget_items SET data = $2 WHERE id = $1', [rows[0].id, JSON.stringify(data)]);
  else await q("INSERT INTO widget_items (widget_id, kind, day, value, data) VALUES ($1, 'health', $2, $3, $4)", [w.id, day, data.steps ?? null, JSON.stringify(data)]);

  // step goal met → tick the chosen habit
  let ticked = null;
  const goal = Number(w.config.stepsGoal) || 0;
  const habitName = String(w.config.stepsHabit ?? '').trim();
  if (habitName && goal && data.steps >= goal) {
    const { rows: hs } = await q('SELECT id, name FROM habits WHERE lower(name) = lower($1) LIMIT 1', [habitName]);
    if (hs[0]) {
      await q('INSERT INTO habit_checks (habit_id, day) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM habit_checks WHERE habit_id = $1 AND day = $2)', [hs[0].id, day]);
      ticked = hs[0].name;
    }
  }
  const saved = Object.entries(vals).map(([k, v]) => `${k} ${v}`).join(', ');
  res.type('text/plain').send(`Mentve (${day}): ${saved}${ticked ? ` · kipipálva: ${ticked}` : ''}`);
});

// ---------- share sheet: anything → a to-do ----------
r.post('/hook/capture', needToken, async (req, res) => {
  const text = String(req.body?.text ?? '').trim();
  const url = String(req.body?.url ?? '').trim();
  if (!text && !url) throw new HttpError(400, 'Üres');
  const { rows } = await q("SELECT id, title FROM widgets WHERE type = 'todo' ORDER BY created_at LIMIT 1");
  if (!rows[0]) throw new HttpError(404, 'Nincs Teendők csempe — tegyél ki egyet.');
  const item = { text: (text || url).slice(0, 300), done: false, ...(url && /^https?:\/\//.test(url) ? { link: url } : {}), source: 'shortcut' };
  await q(
    `INSERT INTO widget_items (widget_id, kind, data, sort)
     VALUES ($1, 'todo', $2, (SELECT COALESCE(MAX(sort), 0) + 1 FROM widget_items WHERE widget_id = $1))`,
    [rows[0].id, JSON.stringify(item)],
  );
  res.type('text/plain').send(`Felvettem: ${item.text}`);
});

// Siri reads the answer out loud: errors as plain text, not JSON
r.use((err, req, res, next) => {
  if (!req.path.startsWith('/hook/')) return next(err);
  res.status(err.status || 500).type('text/plain').send(err.message || 'Hiba');
});

export default r;
