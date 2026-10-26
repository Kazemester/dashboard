import { Router } from 'express';
import { q } from '../db.js';
import { loadEvents } from './calendar.js';

/*
 * The bell in the header: things that need attention, gathered from the tiles —
 * overdue / due to-dos, upcoming countdown events (birthdays…), today's calendar, habits still open today,
 * and spending close to a Költségkövető tile's budget.
 */
const r = Router();
const pad = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

r.get('/notifications', async (req, res) => {
  const en = req.query.lang === 'en';
  const L = (hu, eng) => (en ? eng : hu);
  const now = new Date();
  const today = isoDay(now);
  const tomorrow = isoDay(new Date(now.getTime() + 86_400_000));
  const out = [];
  const { rows: widgets } = await q('SELECT id, type, title, config FROM widgets');

  // to-dos due today / tomorrow / overdue
  const { rows: todos } = await q(
    `SELECT id, widget_id, data FROM widget_items
     WHERE kind = 'todo' AND COALESCE(data->>'done', 'false') <> 'true' AND data->>'due' IS NOT NULL AND data->>'due' <= $1`,
    [tomorrow],
  );
  for (const t of todos) {
    const due = t.data.due;
    const late = due < today;
    out.push({
      id: `todo:${t.id}:${due}`,
      kind: 'todo',
      level: late ? 'danger' : due === today ? 'warn' : 'info',
      title: t.data.text,
      detail: late ? L('Lejárt határidő', 'Overdue') : due === today ? L('Ma esedékes', 'Due today') : L('Holnap esedékes', 'Due tomorrow'),
      when: due,
      widgetId: t.widget_id,
    });
  }

  // countdown events within a week (yearly ones roll over)
  const start = new Date(now.toDateString());
  for (const w of widgets.filter((x) => x.type === 'countdown')) {
    for (const e of w.config.events ?? []) {
      if (!e?.date || !e?.name) continue;
      const d = new Date(`${e.date}T00:00:00`);
      if (Number.isNaN(d.getTime())) continue;
      if (e.yearly) {
        d.setFullYear(start.getFullYear());
        if (d < start) d.setFullYear(start.getFullYear() + 1);
      }
      const days = Math.round((d - start) / 86_400_000);
      if (days < 0 || days > 7) continue;
      out.push({
        id: `cd:${w.id}:${e.name}:${isoDay(d)}`,
        kind: 'event',
        level: days === 0 ? 'warn' : 'info',
        title: e.name,
        detail: days === 0 ? L('Ma', 'Today') : days === 1 ? L('Holnap', 'Tomorrow') : L(`${days} nap múlva`, `In ${days} days`),
        when: isoDay(d),
        widgetId: w.id,
      });
    }
  }

  // calendar: the next 24 hours
  for (const w of widgets.filter((x) => x.type === 'calendar')) {
    try {
      const { events } = await loadEvents(w, 2);
      for (const ev of events) {
        const s = new Date(ev.start);
        if (s - now > 24 * 3600_000 || (ev.end ? new Date(ev.end) < now : s < now)) continue;
        out.push({
          id: `cal:${w.id}:${ev.title}:${s.toISOString()}`,
          kind: 'calendar',
          level: s - now < 3600_000 ? 'warn' : 'info',
          title: ev.title,
          detail: ev.allDay ? L('Egész nap', 'All day') : s.toTimeString().slice(0, 5),
          when: s.toISOString(),
          widgetId: w.id,
        });
      }
    } catch {
      /* a broken feed only hides its own events */
    }
  }

  // habits still open today
  const month = `${today.slice(0, 7)}-01`;
  const { rows: habits } = await q(
    `SELECT h.widget_id, COUNT(*)::int AS open FROM habits h
     WHERE (h.start_month IS NULL OR h.start_month <= $1) AND (h.end_month IS NULL OR h.end_month > $1)
       AND NOT EXISTS (SELECT 1 FROM habit_checks c WHERE c.habit_id = h.id AND c.day = $2)
     GROUP BY h.widget_id`,
    [month, today],
  );
  for (const h of habits) {
    if (!h.open) continue;
    out.push({ id: `habit:${h.widget_id}:${today}:${h.open}`, kind: 'habit', level: 'info', title: L(`${h.open} szokás vár ma`, `${h.open} habit(s) left today`), detail: '', when: today, widgetId: h.widget_id });
  }

  // budgets
  for (const w of widgets.filter((x) => x.type === 'expenses' && Number(x.config.budget) > 0)) {
    const { rows } = await q("SELECT COALESCE(SUM(value), 0)::float AS total FROM widget_items WHERE widget_id = $1 AND kind = 'expense' AND day >= $2", [w.id, month]);
    const ratio = rows[0].total / Number(w.config.budget);
    if (ratio < 0.9) continue;
    out.push({
      id: `budget:${w.id}:${month}:${ratio >= 1 ? 'over' : 'near'}`,
      kind: 'money',
      level: ratio >= 1 ? 'danger' : 'warn',
      title: ratio >= 1 ? L('Túllépted a havi keretet', 'Monthly budget exceeded') : L('Közel a havi kerethez', 'Close to the monthly budget'),
      detail: `${Math.round(ratio * 100)}% · ${w.title}`,
      when: today,
      widgetId: w.id,
    });
  }

  const rank = { danger: 0, warn: 1, info: 2 };
  out.sort((a, b) => rank[a.level] - rank[b.level] || String(a.when).localeCompare(String(b.when)));
  res.json(out.slice(0, 50));
});

export default r;
