import { Router } from 'express';
import { q } from './db.js';
import { complete, llmConfigured } from './llm.js';
import { startJob } from './jobs.js';

/*
 * Weekly review (Sunday evening by default, see push.js): the week's habits, mood, spending, health, focus and
 * portfolio in numbers, and an AI-written look at them — patterns, a comparison with last week, one suggestion.
 * Kept in settings 'weekly_reviews' (the last 12), shown by the Heti áttekintés tile.
 */
const r = Router();
const TZ = process.env.PUSH_TZ || 'Europe/Budapest';
const dayIn = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const round = (n, d = 0) => (n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** d) / 10 ** d);
const avg = (xs) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null);

// the 7 days ending today (Mon–Sun on a Sunday) and the 7 before
export async function gatherWeek(now = new Date()) {
  const to = dayIn(now);
  const from = addDays(to, -6);
  const prevFrom = addDays(from, -7);
  const prevTo = addDays(from, -1);
  const out = { from, to };

  const { rows: habits } = await q(
    `SELECT h.name, COUNT(c.day)::int AS done FROM habits h
     LEFT JOIN habit_checks c ON c.habit_id = h.id AND c.day BETWEEN $1 AND $2
     WHERE (h.end_month IS NULL OR h.end_month > $1) GROUP BY h.id, h.name ORDER BY h.name`,
    [from, to],
  );
  if (habits.length) out.habits = habits.map((h) => `${h.name}: ${h.done}/7 nap`);

  const { rows: moods } = await q("SELECT day, value FROM widget_items WHERE kind = 'mood' AND day BETWEEN $1 AND $2 ORDER BY day", [prevFrom, to]);
  const moodNow = moods.filter((m) => String(m.day) >= from).map((m) => Number(m.value));
  const moodPrev = moods.filter((m) => String(m.day) < from).map((m) => Number(m.value));
  if (moodNow.length) out.mood = { average: round(avg(moodNow), 1), last_week: round(avg(moodPrev), 1), by_day: moods.filter((m) => String(m.day) >= from).map((m) => `${m.day}: ${m.value}/5`) };

  const { rows: spend } = await q("SELECT day, value, data FROM widget_items WHERE kind = 'expense' AND day BETWEEN $1 AND $2", [prevFrom, to]);
  const sNow = spend.filter((x) => String(x.day) >= from);
  const sPrev = spend.filter((x) => String(x.day) < from);
  if (sNow.length || sPrev.length) {
    const byCat = {};
    for (const x of sNow) byCat[x.data?.cat || 'Egyéb'] = (byCat[x.data?.cat || 'Egyéb'] ?? 0) + Number(x.value);
    out.spending = {
      total: round(sNow.reduce((s, x) => s + Number(x.value), 0)),
      last_week: round(sPrev.reduce((s, x) => s + Number(x.value), 0)),
      top_categories: Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `${c}: ${round(v)}`),
    };
  }

  const { rows: health } = await q("SELECT day, data FROM widget_items WHERE kind = 'health' AND day BETWEEN $1 AND $2 ORDER BY day", [prevFrom, to]);
  const hNow = health.filter((x) => String(x.day) >= from);
  const hPrev = health.filter((x) => String(x.day) < from);
  const hv = (rows, k) => rows.map((x) => Number(x.data?.[k])).filter(Number.isFinite);
  if (hNow.length)
    out.health = {
      steps_avg: round(avg(hv(hNow, 'steps'))),
      steps_avg_last_week: round(avg(hv(hPrev, 'steps'))),
      sleep_avg_hours: round(avg(hv(hNow, 'sleep')), 1),
      weight_change_kg: hv(hNow, 'weight').length > 1 ? round(hv(hNow, 'weight').at(-1) - hv(hNow, 'weight')[0], 1) : null,
      steps_by_day: hNow.filter((x) => x.data?.steps != null).map((x) => `${x.day}: ${x.data.steps}`),
    };

  const { rows: focus } = await q("SELECT COALESCE(SUM(duration_sec), 0)::int AS s FROM pomodoro_sessions WHERE kind = 'focus' AND completed_at::date BETWEEN $1 AND $2", [from, to]).catch(() => ({ rows: [] }));
  if (focus[0]?.s) out.focus_minutes = Math.round(focus[0].s / 60);

  const { rows: snaps } = await q("SELECT widget_id, day, value FROM widget_items WHERE kind = 'snap' AND day BETWEEN $1 AND $2 ORDER BY day", [addDays(from, -1), to]);
  const byTile = {};
  for (const s of snaps) (byTile[s.widget_id] ??= []).push(Number(s.value));
  const pf = Object.values(byTile).filter((v) => v.length > 1);
  if (pf.length) {
    const first = pf.reduce((s, v) => s + v[0], 0);
    const last = pf.reduce((s, v) => s + v.at(-1), 0);
    out.portfolio = { change_pct: round(((last - first) / first) * 100, 1), value_now: round(last) };
  }

  const { rows: todos } = await q("SELECT COUNT(*) FILTER (WHERE COALESCE(data->>'done','false') <> 'true')::int AS open, COUNT(*) FILTER (WHERE COALESCE(data->>'done','false') <> 'true' AND data->>'due' < $1)::int AS overdue FROM widget_items WHERE kind = 'todo'", [to]);
  out.todos = { open: todos[0].open, overdue: todos[0].overdue };
  return out;
}

function plain(d) {
  const lines = [`${d.from} – ${d.to}`];
  if (d.habits) lines.push(`Szokások: ${d.habits.join(', ')}.`);
  if (d.mood) lines.push(`Hangulat átlag: ${d.mood.average}/5${d.mood.last_week ? ` (múlt héten ${d.mood.last_week})` : ''}.`);
  if (d.spending) lines.push(`Kiadás: ${d.spending.total} (múlt héten ${d.spending.last_week}). ${d.spending.top_categories.join(', ')}.`);
  if (d.health) lines.push(`Lépés átlag: ${d.health.steps_avg ?? '–'}, alvás: ${d.health.sleep_avg_hours ?? '–'} óra.`);
  if (d.portfolio) lines.push(`Portfólió a héten: ${d.portfolio.change_pct}%.`);
  lines.push(`Nyitott teendők: ${d.todos.open}${d.todos.overdue ? `, ebből lejárt: ${d.todos.overdue}` : ''}.`);
  return lines.join('\n');
}

export async function makeReview() {
  const data = await gatherWeek();
  let text = plain(data);
  let ai = false;
  if (await llmConfigured()) {
    try {
      const msg = await complete(
        [
          {
            role: 'system',
            content:
              'You write a short weekly review for the user from the JSON data of their week (habits, mood, spending, health, focus, portfolio, to-dos). ' +
              'In Hungarian, friendly and concrete, max ~140 words, plain text with short paragraphs, no headings. ' +
              'Mention 2–3 notable facts with numbers, compare with last week where the data has it, point out one pattern if the data shows it ' +
              '(e.g. mood vs. steps or habits on the same days), and end with ONE practical suggestion for next week. Never invent numbers.',
          },
          { role: 'user', content: `${JSON.stringify(data)}\n\nÍrd meg MAGYARUL.` },
        ],
        { temperature: 0.5, purpose: 'background', timeoutMs: 10 * 60_000 },
      );
      if (msg.content?.trim()) (text = msg.content.trim()), (ai = true);
    } catch (err) {
      text = `${text}\n\n(AI hiba: ${err.message})`;
    }
  }
  const review = { from: data.from, to: data.to, text, ai, data, at: new Date().toISOString() };
  const { rows } = await q("SELECT value FROM settings WHERE key = 'weekly_reviews'");
  const list = [review, ...(Array.isArray(rows[0]?.value) ? rows[0].value : []).filter((x) => x.to !== review.to)].slice(0, 12);
  await q("INSERT INTO settings (key, value) VALUES ('weekly_reviews', $1) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", [JSON.stringify(list)]);
  return review;
}

r.get('/reviews', async (_req, res) => {
  const { rows } = await q("SELECT value FROM settings WHERE key = 'weekly_reviews'");
  res.json(Array.isArray(rows[0]?.value) ? rows[0].value : []);
});
r.post('/reviews/run', async (_req, res) => {
  res.status(202).json({ job: startJob(() => makeReview()) });
});

export default r;
