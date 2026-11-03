import { Router } from 'express';
import webpush from 'web-push';
import { q } from './db.js';
import { HttpError } from './util.js';
import { gatherNotifications, unseenCount } from './routes/notifications.js';
import { portfolioData } from './routes/stocks.js';
import { runRules } from './rules.js';
import { makeBrief } from './routes/brief.js';
import { makeReview } from './reviews.js';
import { llmConfigured } from './llm.js';

/*
 * Web Push to the installed app (PWA; on iPhone iOS 16.4+, opened from the home screen).
 * - VAPID keys are generated once and kept in settings 'push'.
 * - A scheduler (every 5 min) sends what needs attention: to-dos due tomorrow / today / overdue, today's
 *   countdown events, calendar entries within the hour, budgets, and Portfólió price alerts. Each one once;
 *   nothing between 22:00 and 7:00 (it goes out in the morning if it still applies).
 */
const r = Router();
const TZ = process.env.PUSH_TZ || 'Europe/Budapest';
const SUBJECT = process.env.PUSH_SUBJECT || 'https://github.com/Kazemester/dashboard';

let keys = null;
async function vapid() {
  if (keys) return keys;
  const { rows } = await q("SELECT value FROM settings WHERE key = 'push'");
  keys = rows[0]?.value?.publicKey ? rows[0].value : null;
  if (!keys) {
    keys = webpush.generateVAPIDKeys();
    await q("INSERT INTO settings (key, value) VALUES ('push', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(keys)]);
  }
  webpush.setVapidDetails(SUBJECT, keys.publicKey, keys.privateKey);
  return keys;
}

async function ensureTables() {
  await q(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    endpoint   TEXT PRIMARY KEY,
    keys       JSONB NOT NULL,
    lang       TEXT NOT NULL DEFAULT 'hu',
    agent      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  await q(`CREATE TABLE IF NOT EXISTS push_sent (
    key     TEXT PRIMARY KEY,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
}

// payload: { title, body, url?, tag? } → every subscription (or one). Gone subscriptions are removed.
// Each push carries the number of unread bell items: the service worker puts it on the app icon.
export async function sendPush(payload, { endpoint } = {}) {
  await vapid();
  const badge = await unseenCount().catch(() => undefined);
  const { rows } = endpoint ? await q('SELECT * FROM push_subscriptions WHERE endpoint = $1', [endpoint]) : await q('SELECT * FROM push_subscriptions');
  let sent = 0;
  for (const s of rows) {
    const body = { badge, ...(typeof payload === 'function' ? payload(s.lang) : payload) };
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: s.keys }, JSON.stringify(body), { TTL: 6 * 3600, urgency: 'normal' });
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) await q('DELETE FROM push_subscriptions WHERE endpoint = $1', [s.endpoint]);
      else console.error('[push]', err.statusCode ?? '', err.body || err.message);
    }
  }
  return sent;
}

// ---------- routes ----------
r.get('/push/key', async (_req, res) => {
  res.json({ publicKey: (await vapid()).publicKey });
});

r.post('/push/subscribe', async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint) || !sub.keys?.p256dh || !sub.keys?.auth) throw new HttpError(400, 'Hibás feliratkozás');
  const lang = req.body.lang === 'en' ? 'en' : 'hu';
  await q(
    `INSERT INTO push_subscriptions (endpoint, keys, lang, agent) VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET keys = EXCLUDED.keys, lang = EXCLUDED.lang, agent = EXCLUDED.agent`,
    [sub.endpoint, JSON.stringify({ p256dh: sub.keys.p256dh, auth: sub.keys.auth }), lang, String(req.get('user-agent') ?? '').slice(0, 200)],
  );
  res.json({ ok: true });
});

r.post('/push/unsubscribe', async (req, res) => {
  await q('DELETE FROM push_subscriptions WHERE endpoint = $1', [String(req.body?.endpoint ?? '')]);
  res.json({ ok: true });
});

r.post('/push/status', async (req, res) => {
  const { rows } = await q('SELECT 1 FROM push_subscriptions WHERE endpoint = $1', [String(req.body?.endpoint ?? '')]);
  res.json({ subscribed: rows.length > 0 });
});

r.post('/push/test', async (req, res) => {
  const en = req.body?.lang === 'en';
  const sent = await sendPush(
    { title: 'NEXUS', body: en ? 'Notifications work ✓' : 'Az értesítések működnek ✓', url: '/', tag: 'test' },
    { endpoint: req.body?.endpoint },
  );
  if (!sent) throw new HttpError(502, 'Nem sikerült elküldeni (a feliratkozás lejárt?). Kapcsold ki és be újra.');
  res.json({ sent });
});

// ---------- scheduler ----------
const hourIn = (d) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(d));
const dayIn = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD

// which bell items are worth a push (habits would nag every day)
const PUSH_KINDS = {
  todo: () => true,
  event: (n) => n.level === 'warn', // today
  calendar: (n) => n.level === 'warn', // within the hour
  money: () => true,
};

async function once(key) {
  const { rowCount } = await q('INSERT INTO push_sent (key) VALUES ($1) ON CONFLICT DO NOTHING', [key]);
  return rowCount > 0;
}

async function bellPushes() {
  const { rows: langs } = await q('SELECT DISTINCT lang FROM push_subscriptions');
  if (!langs.length) return;
  const lists = Object.fromEntries(await Promise.all(langs.map(async ({ lang }) => [lang, await gatherNotifications(lang)])));
  const base = lists.hu ?? Object.values(lists)[0];
  let budget = 4; // at most a few per round, the rest follows 5 minutes later
  for (const n of base) {
    if (!PUSH_KINDS[n.kind]?.(n)) continue;
    if (budget <= 0) break;
    if (!(await once(`bell:${n.id}:${n.level}`))) continue;
    budget--;
    await sendPush((lang) => {
      const m = (lists[lang] ?? base).find((x) => x.id === n.id) ?? n;
      return { title: m.title, body: m.detail || '', url: m.widgetId ? `/?w=${encodeURIComponent(m.widgetId)}` : '/', tag: n.id };
    });
  }
}

async function portfolioPushes() {
  const { rows: widgets } = await q("SELECT id, type, title, config FROM widgets WHERE type = 'portfolio'");
  const today = dayIn(new Date());
  for (const w of widgets) {
    const pct = Number(w.config.alertPct);
    if (!(pct > 0)) continue;
    let data;
    try {
      data = await portfolioData(w);
    } catch {
      continue;
    }
    const moves = data.positions.filter((p) => Math.abs(p.dayChangePct ?? 0) >= pct).map((p) => ({ key: p.key, name: p.asset.symbol, change: p.dayChangePct }));
    if (Math.abs(data.totals.dayChangePct ?? 0) >= pct) moves.unshift({ key: 'total', name: null, change: data.totals.dayChangePct });
    for (const m of moves) {
      const dir = m.change > 0 ? 'up' : 'down';
      if (!(await once(`pf:${w.id}:${m.key}:${today}:${dir}`))) continue;
      const sign = m.change > 0 ? '+' : '−';
      const v = `${sign}${Math.abs(m.change).toFixed(1)}%`;
      await sendPush((lang) => ({
        title: m.name ? `${m.name} ${v}` : lang === 'en' ? `Portfolio ${v} today` : `Portfólió ${v} ma`,
        body: m.name ? (lang === 'en' ? `Today's move in ${w.title}` : `Mai elmozdulás · ${w.title}`) : `${w.title}`,
        url: `/?w=${encodeURIComponent(w.id)}`,
        tag: `pf:${w.id}:${m.key}`,
      }));
    }
  }
}

// ---------- morning summary ----------
// iOS updates the icon badge only when a push arrives (no silent pushes for web apps), and habits or already
// pushed to-dos never send one: a daily summary keeps the badge right and starts the day.
// daily: the morning push; ai: written by the AI (a JARVIS-style brief); weekly: the weekly review (day 0 = Sunday)
const DEFAULT_PREFS = { daily: true, hour: 8, ai: true, weekly: true, weeklyDay: 0, weeklyHour: 19 };
export async function pushPrefs() {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'push_prefs'");
  return { ...DEFAULT_PREFS, ...(rows[0]?.value ?? {}) };
}

async function dailySummary(now) {
  const prefs = await pushPrefs();
  if (!prefs.daily || hourIn(now) < Number(prefs.hour)) return;
  const today = dayIn(now);
  const { rows } = await q("SELECT value FROM settings WHERE key = 'bell_seen'");
  const seen = new Set(Array.isArray(rows[0]?.value) ? rows[0].value : []);
  const lists = { hu: await gatherNotifications('hu'), en: await gatherNotifications('en') };
  const ai = prefs.ai && (await llmConfigured());
  if (!ai && !lists.hu.some((n) => !seen.has(n.id))) return; // nothing to tell (the badge is already clear)
  if (!(await once(`daily:${today}`))) return;
  if (ai) {
    try {
      await morningBrief();
      return;
    } catch (err) {
      console.error('[push] morning brief', err.message);
    }
  }
  await sendPush((lang) => {
    const en = lang === 'en';
    const items = (lists[lang] ?? lists.hu).filter((n) => !seen.has(n.id));
    const todos = items.filter((n) => n.kind === 'todo').length;
    const habit = items.find((n) => n.kind === 'habit');
    const parts = [];
    if (todos) parts.push(en ? `${todos} to-do(s) due` : `${todos} teendő esedékes`);
    for (const n of items.filter((x) => x.kind === 'event' || x.kind === 'calendar').slice(0, 2)) parts.push(`${n.title} (${n.detail.toLowerCase()})`);
    if (items.some((n) => n.kind === 'money')) parts.push(en ? 'budget alert' : 'keret-figyelmeztetés');
    if (habit) parts.push(habit.title.toLowerCase());
    return { title: en ? 'Today' : 'Mai nap', body: parts.join(' · ') || (en ? `${items.length} item(s) in the bell` : `${items.length} tétel a csengőben`), url: '/', tag: 'daily' };
  });
}

// The AI morning brief: written from the tiles (routes/brief.js), shown on the Brief tiles too, pushed in short.
async function morningBrief() {
  const { rows: tiles } = await q("SELECT id, config FROM widgets WHERE type = 'brief' ORDER BY created_at");
  const { rows: prof } = await q("SELECT value FROM settings WHERE key = 'profile'");
  const name = prof[0]?.value?.name?.trim();
  const cfg = tiles[0]?.config ?? { address: name || 'Uram' };
  const value = await makeBrief(cfg);
  for (const t of tiles)
    await q(
      `INSERT INTO widget_state (widget_id, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (widget_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [t.id, JSON.stringify(value)],
    );
  await q("INSERT INTO settings (key, value) VALUES ('morning_brief', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(value)]);
  await sendPush({ title: 'Jó reggelt', body: short(value.text, 300), url: tiles[0] ? `/?w=${encodeURIComponent(tiles[0].id)}` : '/', tag: 'daily' });
}
// the first sentences that fit (a notification shows a few lines)
const short = (text, max) => {
  const t = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  return end > max / 3 ? cut.slice(0, end + 1) : `${cut.replace(/\s+\S*$/, '')}…`;
};

async function weeklyReview(now) {
  const prefs = await pushPrefs();
  if (!prefs.weekly) return;
  const dow = new Date(`${dayIn(now)}T12:00:00Z`).getUTCDay();
  if (dow !== Number(prefs.weeklyDay) || hourIn(now) < Number(prefs.weeklyHour)) return;
  if (!(await once(`weekly:${dayIn(now)}`))) return;
  const { rows } = await q("SELECT id FROM widgets WHERE type = 'review' ORDER BY created_at LIMIT 1");
  const review = await makeReview();
  await sendPush({ title: 'Heti áttekintés', body: short(review.text, 300), url: rows[0] ? `/?w=${encodeURIComponent(rows[0].id)}` : '/', tag: 'weekly' });
}

r.get('/push/prefs', async (_req, res) => res.json(await pushPrefs()));
r.put('/push/prefs', async (req, res) => {
  const next = { ...(await pushPrefs()) };
  if (req.body?.daily !== undefined) next.daily = Boolean(req.body.daily);
  if (req.body?.hour !== undefined) next.hour = Math.min(12, Math.max(7, Math.round(Number(req.body.hour)) || 8));
  if (req.body?.ai !== undefined) next.ai = Boolean(req.body.ai);
  if (req.body?.weekly !== undefined) next.weekly = Boolean(req.body.weekly);
  if (req.body?.weeklyDay !== undefined) next.weeklyDay = Math.min(6, Math.max(0, Math.round(Number(req.body.weeklyDay)) || 0));
  if (req.body?.weeklyHour !== undefined) next.weeklyHour = Math.min(21, Math.max(7, Math.round(Number(req.body.weeklyHour)) || 19));
  await q("INSERT INTO settings (key, value) VALUES ('push_prefs', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(next)]);
  res.json(next);
});

let running = false;
export async function pushTick(now = new Date()) {
  if (running) return;
  running = true;
  try {
    const { rows } = await q('SELECT COUNT(*)::int AS n FROM push_subscriptions');
    if (!rows[0].n) return;
    const h = hourIn(now);
    if (h >= 22 || h < 7) return; // quiet hours: still-relevant items go out at 7:00
    await bellPushes();
    await portfolioPushes();
    await runRules({ send: (p) => sendPush(p), once });
    await dailySummary(now);
    await weeklyReview(now).catch((err) => console.error('[push] weekly review', err.message));
    await q("DELETE FROM push_sent WHERE sent_at < now() - interval '30 days'");
  } catch (err) {
    console.error('[push scheduler]', err.message);
  } finally {
    running = false;
  }
}

export async function initPush() {
  await ensureTables();
  await vapid();
  setTimeout(pushTick, 30_000);
  setInterval(pushTick, 5 * 60_000);
}

export default r;
