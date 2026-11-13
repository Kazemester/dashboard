import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { q } from './db.js';
import { complete, llmConfigured } from './llm.js';
import { startJob } from './jobs.js';
import { HttpError } from './util.js';

/*
 * Quick capture: one sentence from anywhere (the ⚡ button, Siri, the share sheet) goes where it belongs —
 * "tej, kenyér" → the shopping list, "5000 Ft benzin" → an expense, "holnap 10-kor fogorvos" → a to-do with a
 * date, "jó napom volt" → the mood log, "edzés kész" → a habit tick, anything else → a note or a to-do.
 * The AI only sorts the sentence (one small JSON); the writing is done here.
 */
const r = Router();
const TZ = process.env.PUSH_TZ || 'Europe/Budapest';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
const fold = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const PROMPT = () => `Sort the user's quick note into ONE JSON object. Today is ${today()}. Reply with JSON only.
{"target":"todo|shopping|expense|income|note|mood|habit","items":["..."],"due":"YYYY-MM-DD or null","amount":<number or null>,"category":"<expense category or null>","mood":<1-5 or null>,"habit":"<habit name or null>","text":"<the note, cleaned>"}
- shopping: things to buy (groceries…) → items, one per thing.
- expense / income: money spent / received → amount (number), category (e.g. Étel, Közlekedés, Lakás, Szórakozás, Egészség), text = what for.
- todo: something to do → items (usually one), due if a day is mentioned (holnap = tomorrow, péntek = next Friday).
- mood: how the user feels → mood 1 (very bad) … 5 (very good).
- habit: a habit done today (edzés, olvasás, futás…) → habit.
- note: an idea / information to keep.
Examples: "tej, kenyér, tojás" → {"target":"shopping","items":["tej","kenyér","tojás"]}
"5000 Ft benzin" → {"target":"expense","amount":5000,"category":"Közlekedés","text":"benzin"}
"holnap 10-kor fogorvos" → {"target":"todo","items":["10:00 fogorvos"],"due":"<tomorrow>"}
"fáradt vagyok, rossz nap" → {"target":"mood","mood":2,"text":"fáradt vagyok, rossz nap"}
"ma lefutottam az 5 km-t" → {"target":"habit","habit":"futás","text":"ma lefutottam az 5 km-t"}`;

// without AI: money → expense, a short list → shopping, otherwise a to-do
function guess(text) {
  const m = text.match(/(\d[\d\s.]*)\s*(ft|huf|forint|€|eur|\$|usd)/i);
  if (m) return { target: /kaptam|fizetés|jóváír|bevétel/i.test(text) ? 'income' : 'expense', amount: Number(m[1].replace(/[\s.]/g, '')), text: text.replace(m[0], '').trim() || text };
  if (/^(venni|vásárol|bevásárl|vegyél(?! fel)|vegyünk(?! fel))/i.test(text) || (text.includes(',') && text.split(',').every((x) => x.trim().split(/\s+/).length <= 3))) return { target: 'shopping', items: text.replace(/^(venni|vegyél|vegyünk|vásárolni|bevásárlás)\s*:?\s*/i, '').split(/,|\n| és /) };
  return { target: 'todo', items: [text] };
}

async function sort(text) {
  if (await llmConfigured()) {
    try {
      const msg = await complete([{ role: 'system', content: PROMPT() }, { role: 'user', content: text }], { json: true, temperature: 0, purpose: 'background', timeoutMs: 3 * 60_000 });
      const s = String(msg.content ?? '');
      const o = JSON.parse(s.slice(s.indexOf('{'), s.lastIndexOf('}') + 1));
      if (o?.target) return o;
    } catch {
      /* fall through */
    }
  }
  return guess(text);
}

async function widgetsOf(type) {
  const { rows } = await q('SELECT id, title, config FROM widgets WHERE type = $1 ORDER BY created_at', [type]);
  return rows;
}
async function newWidget(type, title, config = {}) {
  const { rows } = await q('INSERT INTO widgets (id, type, title, config) VALUES ($1, $2, $3, $4) RETURNING id, title, config', [randomUUID(), type, title, JSON.stringify(config)]);
  return rows[0];
}
const addItem = (widgetId, kind, data, day = null, value = null) =>
  q(
    `INSERT INTO widget_items (widget_id, kind, day, value, data, sort)
     VALUES ($1, $2, $3, $4, $5, (SELECT COALESCE(MAX(sort), 0) + 1 FROM widget_items WHERE widget_id = $1))`,
    [widgetId, kind, day, value, JSON.stringify(data)],
  );
const cleanItems = (o, text) => (Array.isArray(o.items) && o.items.length ? o.items : [o.text || text]).map((x) => String(x).trim()).filter(Boolean).slice(0, 30);

// → { target, message, widgetId }
export async function capture(text, { source = 'capture' } = {}) {
  const clean = String(text ?? '').trim().slice(0, 600);
  if (!clean) throw new HttpError(400, 'Üres.');
  const o = await sort(clean);
  const day = today();
  const due = /^\d{4}-\d{2}-\d{2}$/.test(o.due ?? '') ? o.due : null;

  if (o.target === 'shopping') {
    const todos = await widgetsOf('todo');
    const w = todos.find((x) => /v[aá]s[aá]rl|bev[aá]s|shop|piac|lista/i.test(x.title)) ?? (await newWidget('todo', 'Bevásárlás'));
    const items = cleanItems(o, clean);
    for (const t of items) await addItem(w.id, 'todo', { text: t, done: false, source });
    return { target: 'shopping', message: `${w.title}: ${items.join(', ')}`, widgetId: w.id };
  }
  if (o.target === 'expense' || o.target === 'income') {
    const amount = Math.abs(Number(String(o.amount ?? '').replace(/[^\d.]/g, '')));
    if (!(amount > 0)) o.target = 'note'; // no amount found: keep the sentence as a note
  }
  if (o.target === 'expense' || o.target === 'income') {
    const amount = Math.abs(Number(String(o.amount ?? '').replace(/[^\d.]/g, '')));
    const tiles = await widgetsOf('expenses');
    const w = tiles[0] ?? (await newWidget('expenses', 'Költségek', { currency: 'Ft', categories: 'Étel, Lakás, Közlekedés, Szórakozás, Egészség, Egyéb' }));
    const cats = String(w.config.categories || 'Étel, Lakás, Közlekedés, Szórakozás, Egyéb').split(',').map((c) => c.trim()).filter(Boolean);
    const want = fold(o.category);
    const cat = cats.find((c) => want && (fold(c) === want || fold(c).includes(want) || want.includes(fold(c)))) ?? cats.find((c) => /egy[eé]b/i.test(c)) ?? cats[0];
    const note = String(o.text ?? '').slice(0, 120);
    await addItem(w.id, o.target, o.target === 'income' ? { note } : { cat, note }, day, amount);
    return { target: o.target, message: `${o.target === 'income' ? 'Bevétel' : 'Kiadás'}: ${amount.toLocaleString('hu-HU')} ${w.config.currency || 'Ft'}${o.target === 'expense' ? ` · ${cat}` : ''}${note ? ` · ${note}` : ''}`, widgetId: w.id };
  }
  if (o.target === 'mood') {
    const v = Math.min(5, Math.max(1, Math.round(Number(o.mood) || 3)));
    const w = (await widgetsOf('mood'))[0] ?? (await newWidget('mood', 'Hangulatnapló'));
    const { rowCount } = await q("UPDATE widget_items SET value = $3, data = $4 WHERE widget_id = $1 AND kind = 'mood' AND day = $2", [w.id, day, v, JSON.stringify({ note: o.text || clean })]);
    if (!rowCount) await addItem(w.id, 'mood', { note: o.text || clean }, day, v);
    return { target: 'mood', message: `Hangulat ma: ${v}/5`, widgetId: w.id };
  }
  if (o.target === 'habit' && o.habit) {
    const { rows } = await q('SELECT id, name, widget_id FROM habits WHERE end_month IS NULL OR end_month > $1', [day]);
    const f = fold(o.habit);
    const h = rows.find((x) => fold(x.name) === f) ?? rows.find((x) => fold(x.name).includes(f) || f.includes(fold(x.name)));
    if (h) {
      await q('INSERT INTO habit_checks (habit_id, day) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM habit_checks WHERE habit_id = $1 AND day = $2)', [h.id, day]);
      return { target: 'habit', message: `Kipipálva: ${h.name}`, widgetId: h.widget_id };
    }
    // no such habit: keep it as a note rather than lose it
  }
  if (o.target === 'note' || o.target === 'habit') {
    const w = (await widgetsOf('notes'))[0] ?? (await newWidget('notes', 'Jegyzet'));
    const { rows } = await q('SELECT value FROM widget_state WHERE widget_id = $1', [w.id]);
    const cur = rows[0]?.value?.text ?? '';
    const line = `• ${o.text || clean}`;
    await q(
      `INSERT INTO widget_state (widget_id, value, updated_at) VALUES ($1, $2, now())
       ON CONFLICT (widget_id) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
      [w.id, JSON.stringify({ ...(rows[0]?.value ?? {}), text: cur ? `${cur.replace(/\s+$/, '')}\n${line}` : line })],
    );
    return { target: 'note', message: `Jegyzet: ${o.text || clean}`, widgetId: w.id };
  }
  // to-do (default)
  const todos = await widgetsOf('todo');
  const w = todos.find((x) => /^(teend|to-?do|feladat)/i.test(x.title)) ?? todos.find((x) => !/v[aá]s[aá]rl|bev[aá]s|shop|piac/i.test(x.title)) ?? (await newWidget('todo', 'Teendők'));
  const items = cleanItems(o, clean);
  for (const t of items) await addItem(w.id, 'todo', { text: t, done: false, ...(due ? { due } : {}), source });
  return { target: 'todo', message: `${w.title}: ${items.join(', ')}${due ? ` (${due})` : ''}`, widgetId: w.id };
}

r.post('/capture', async (req, res) => {
  const text = req.body?.text;
  res.status(202).json({ job: startJob(() => capture(text)) });
});

export default r;
