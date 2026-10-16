import { Router } from 'express';
import { q } from '../db.js';
import { chat, llmConfigured } from '../llm.js';
import { getWidget } from '../util.js';
import { weather, wmoText } from '../services/openmeteo.js';
import { loadEvents } from './calendar.js';

// "JARVIS" daily briefing: collects what the other tiles know and lets the LLM summarise it.
const r = Router();

const fmtTime = (d) => new Date(d).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' });
const isToday = (d) => new Date(d).toDateString() === new Date().toDateString();
const dueText = (day) => {
  const diff = Math.round((new Date(`${day}T00:00:00`) - new Date(new Date().toDateString())) / 86400_000);
  if (diff < 0) return `${-diff} napja lejárt`;
  if (diff === 0) return 'ma';
  if (diff === 1) return 'holnap';
  return new Date(`${day}T00:00:00`).toLocaleDateString('hu-HU', { month: 'short', day: 'numeric' });
};

async function gather(cfg) {
  const { rows: widgets } = await q('SELECT * FROM widgets ORDER BY created_at');
  const of = (t) => widgets.filter((w) => w.type === t);
  const ctx = { now: new Date().toLocaleString('hu-HU', { dateStyle: 'full', timeStyle: 'short' }) };
  const safe = async (key, fn) => {
    try {
      const v = await fn();
      if (v !== undefined && !(Array.isArray(v) && !v.length)) ctx[key] = v;
    } catch (err) {
      ctx[`${key}_error`] = err.message;
    }
  };

  const city = cfg.city || of('weather')[0]?.config.city || 'Budapest';
  await Promise.all([
    safe('weather', async () => {
      const wx = await weather(city);
      return {
        place: wx.place,
        now: `${Math.round(wx.current.temperature_2m)}°C, ${wmoText(wx.current.weather_code)} (hőérzet ${Math.round(wx.current.apparent_temperature)}°C, szél ${Math.round(wx.current.wind_speed_10m)} km/h)`,
        today: `${wmoText(wx.daily.weather_code[0])}, ${Math.round(wx.daily.temperature_2m_min[0])}–${Math.round(wx.daily.temperature_2m_max[0])}°C, csapadék esély ${wx.daily.precipitation_probability_max[0]}%`,
        tomorrow: `${wmoText(wx.daily.weather_code[1])}, ${Math.round(wx.daily.temperature_2m_min[1])}–${Math.round(wx.daily.temperature_2m_max[1])}°C, csapadék esély ${wx.daily.precipitation_probability_max[1]}%`,
      };
    }),
    safe('calendar', async () => {
      const lists = await Promise.all(of('calendar').map((w) => loadEvents(w, 2)));
      return lists
        .flatMap((l) => l.events)
        .sort((a, b) => new Date(a.start) - new Date(b.start))
        .map((e) => `${isToday(e.start) ? 'ma' : 'holnap'} ${e.allDay ? 'egész nap' : fmtTime(e.start)}: ${e.title}${e.location ? ` @ ${e.location}` : ''}`);
    }),
    safe('todos', async () => {
      const { rows } = await q(
        `SELECT i.data FROM widget_items i JOIN widgets w ON w.id = i.widget_id
         WHERE w.type = 'todo' AND i.kind = 'todo' AND COALESCE((i.data->>'done')::boolean, false) = false
         ORDER BY i.sort LIMIT 25`,
      );
      return rows.map((x) => x.data.text + (x.data.due ? ` (határidő: ${dueText(x.data.due)})` : ''));
    }),
    safe('habits_open_today', async () => {
      const { rows } = await q(
        `SELECT h.name FROM habits h
         WHERE h.start_month <= CURRENT_DATE AND (h.end_month IS NULL OR h.end_month > CURRENT_DATE)
           AND NOT EXISTS (SELECT 1 FROM habit_checks c WHERE c.habit_id = h.id AND c.day = CURRENT_DATE)`,
      );
      return rows.map((x) => x.name);
    }),
    safe('focus_today_min', async () => {
      const { rows } = await q(
        "SELECT COALESCE(SUM(duration_sec), 0)::int AS s FROM pomodoro_sessions WHERE kind = 'focus' AND completed_at::date = CURRENT_DATE",
      );
      return Math.round(rows[0].s / 60);
    }),
    safe('mail', async () => {
      const { rows } = await q('SELECT result, created_at FROM mail_digests ORDER BY id DESC LIMIT 1');
      if (!rows[0]) return undefined;
      const m = rows[0].result;
      return { headline: m.headline, important: (m.important ?? []).map((i) => i.subject), todos: m.todos ?? [] };
    }),
    safe('countdowns', async () =>
      of('countdown')
        .flatMap((w) => w.config.events ?? [])
        .filter((e) => e?.date)
        .map((e) => ({ name: e.name, days: Math.ceil((new Date(e.date) - new Date(new Date().toDateString())) / 86400_000) }))
        .filter((e) => e.days >= 0 && e.days <= 30)
        .map((e) => `${e.name}: ${e.days} nap múlva`),
    ),
    safe('spending_this_month', async () => {
      const { rows } = await q(
        `SELECT COALESCE(SUM(value), 0) AS total FROM widget_items
         WHERE kind = 'expense' AND day >= date_trunc('month', CURRENT_DATE)`,
      );
      return Number(rows[0].total) || undefined;
    }),
  ]);
  return ctx;
}

// Plain-text fallback when no LLM is configured.
function fallback(ctx) {
  const lines = [`${ctx.now}.`];
  if (ctx.weather) lines.push(`Időjárás, ${ctx.weather.place}: most ${ctx.weather.now}.\nMa ${ctx.weather.today}.`);
  if (ctx.calendar) lines.push(`Események:\n${ctx.calendar.map((e) => `• ${e}`).join('\n')}`);
  if (ctx.todos) lines.push(`Nyitott teendők (${ctx.todos.length}):\n${ctx.todos.slice(0, 6).map((t) => `• ${t}`).join('\n')}`);
  if (ctx.habits_open_today) lines.push(`Ma még hátra: ${ctx.habits_open_today.join(', ')}.`);
  if (ctx.countdowns) lines.push(`Közelgő: ${ctx.countdowns.join('; ')}.`);
  if (ctx.mail) lines.push(`Levelek: ${ctx.mail.headline}`);
  return lines.join('\n\n');
}

r.get('/widgets/:id/brief', async (req, res) => {
  await getWidget(req.params.id, 'brief');
  const { rows } = await q('SELECT value, updated_at FROM widget_state WHERE widget_id = $1', [req.params.id]);
  res.json(rows[0]?.value?.text ? rows[0].value : null);
});

r.post('/widgets/:id/brief/run', async (req, res) => {
  const w = await getWidget(req.params.id, 'brief');
  const cfg = w.config;
  const ctx = await gather(cfg);
  let text;
  let ai = false;
  if (await llmConfigured()) {
    const persona =
      `You are J.A.R.V.I.S., a calm, dry-witted personal assistant. Address the user as "${cfg.address || 'Uram'}". ` +
      `Write a short spoken-style daily briefing in ${cfg.language || 'Hungarian'} from the JSON context: ` +
      'greeting fitting the time of day, weather and what to wear/bring, schedule, the 3 most important things to focus on, ' +
      'gentle reminders (habits, deadlines, countdowns), one closing line. Max ~150 words, no markdown headings, ' +
      'use short paragraphs. Never invent facts that are not in the context.' +
      (cfg.instructions ? `\nExtra instructions: ${cfg.instructions}` : '');
    try {
      text = await chat(
        [
          { role: 'system', content: persona },
          { role: 'user', content: JSON.stringify(ctx) },
        ],
        { model: cfg.model || undefined, temperature: 0.6 },
      );
      ai = true;
    } catch (err) {
      text = `${fallback(ctx)}\n\n(AI hiba: ${err.message})`;
    }
  } else {
    text = fallback(ctx);
  }
  const value = { text, ai, context: ctx, generatedAt: new Date().toISOString() };
  await q(
    `INSERT INTO widget_state (widget_id, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (widget_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [w.id, JSON.stringify(value)],
  );
  res.json(value);
});

export default r;
