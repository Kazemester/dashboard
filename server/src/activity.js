import { q } from './db.js';

/*
 * Activity log ("Aktivitás" tile). Every helper here is fire-and-forget: it never throws and never
 * delays the request that triggered it (errors only go to the console).
 * Titles are stored in Hungarian (the UI is Hungarian-first); meta.en carries the English variant.
 */

const KEEP = 5000; // newest rows kept
let sinceTrim = 0;

const short = (s, n = 70) => {
  const v = String(s ?? '').replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
};

async function insert({ kind, title, detail = null, widgetId = null, status = null, meta = null }) {
  await q(
    'INSERT INTO activity_log (kind, title, detail, widget_id, status, meta) VALUES ($1, $2, $3, $4, $5, $6)',
    [String(kind || 'other'), short(title, 200) || '—', detail == null ? null : short(detail, 400), widgetId, status, meta ? JSON.stringify(meta) : null],
  );
  if (++sinceTrim >= 50) {
    sinceTrim = 0;
    await q(
      `DELETE FROM activity_log WHERE id <= (SELECT id FROM activity_log ORDER BY id DESC OFFSET ${KEEP} LIMIT 1)`,
    );
  }
}

/** Log one event. Never throws, never awaited by callers. */
export function logActivity(entry) {
  try {
    insert(entry ?? {}).catch((err) => console.error('[activity]', err.message));
  } catch (err) {
    console.error('[activity]', err.message);
  }
}

// Run an async builder in the background (lookups) and log whatever it returns.
function later(build) {
  Promise.resolve()
    .then(build)
    .then((entry) => entry && insert(entry))
    .catch((err) => console.error('[activity]', err.message));
}

const widgetInfo = async (id) => (await q('SELECT id, type, title, config FROM widgets WHERE id = $1', [id])).rows[0];

const money = (n, cur) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return '';
  return `${v.toLocaleString('hu-HU', { maximumFractionDigits: 2 })} ${cur || 'Ft'}`.trim();
};

// ---------- tiles ----------
export function logTile(action, w) {
  if (!w) return;
  if (action === 'add') {
    logActivity({ kind: 'tile', title: `Csempe hozzáadva: ${w.title}`, detail: w.type, widgetId: w.id, status: 'done', meta: { action, type: w.type, en: { title: `Tile added: ${w.title}` } } });
  } else {
    // the tile is gone: no widget_id, so the row is not clickable
    logActivity({ kind: 'tile', title: `Csempe törölve: ${w.title}`, detail: w.type, status: 'done', meta: { action, type: w.type, removedId: w.id, en: { title: `Tile removed: ${w.title}` } } });
  }
}

// ---------- generic items (to-dos, expenses, income) ----------
const isIncome = (row) => row.kind === 'income' || row.data?.type === 'income' || row.data?.income === true;

/** action: 'add' (POST items) or 'update' (PATCH item; patch = request body). */
export function logItem(action, widgetId, row, patch) {
  if (!row) return;
  later(async () => {
    const wid = widgetId ?? (await q('SELECT widget_id FROM widget_items WHERE id = $1', [row.id])).rows[0]?.widget_id;
    if (row.kind === 'todo') {
      const text = short(row.data?.text, 80);
      if (action === 'add') {
        return { kind: 'todo', title: `Új teendő: ${text}`, detail: row.data?.due ? `Határidő: ${row.data.due}` : null, widgetId: wid, status: 'pending', meta: { itemId: row.id, en: { title: `New to-do: ${text}`, detail: row.data?.due ? `Due: ${row.data.due}` : null } } };
      }
      if (patch?.data?.done === true) {
        return { kind: 'todo', title: `Teendő kész: ${text}`, detail: null, widgetId: wid, status: 'done', meta: { itemId: row.id, en: { title: `To-do done: ${text}` } } };
      }
      return null;
    }
    if ((row.kind === 'expense' || row.kind === 'income') && action === 'add') {
      const w = wid ? await widgetInfo(wid) : null;
      const amount = money(Math.abs(row.value), w?.config?.currency);
      const inc = isIncome(row);
      const note = [row.data?.cat, row.data?.note].filter(Boolean).join(' · ');
      return {
        kind: 'money',
        title: `${inc ? 'Bevétel' : 'Kiadás'}: ${amount}`,
        detail: note || w?.title || null,
        widgetId: wid,
        status: 'done',
        meta: { itemId: row.id, amount: row.value, income: inc, day: row.day, en: { title: `${inc ? 'Income' : 'Expense'}: ${amount}` } },
      };
    }
    return null;
  });
}

// ---------- habits ----------
export function logHabit(habitId, day, checked) {
  if (!checked) return;
  later(async () => {
    const h = (await q('SELECT name, widget_id FROM habits WHERE id = $1', [habitId])).rows[0];
    if (!h) return null;
    return { kind: 'habit', title: `Szokás kipipálva: ${h.name}`, detail: day, widgetId: h.widget_id, status: 'done', meta: { habitId: Number(habitId), day, en: { title: `Habit ticked: ${h.name}` } } };
  });
}

// ---------- goals / progress ----------
export function logGoal(action, widgetId, item) {
  if (!item) return;
  later(async () => {
    const wid = widgetId ?? (await q('SELECT widget_id FROM progress_items WHERE id = $1', [item.id])).rows[0]?.widget_id;
    const pct = item.target ? Math.round((item.value / item.target) * 100) : 0;
    const unit = item.unit ? ` ${item.unit}` : '';
    const detail = `${Number(item.value).toLocaleString('hu-HU')} / ${Number(item.target).toLocaleString('hu-HU')}${unit} (${pct}%)`;
    const added = action === 'add';
    return {
      kind: 'goal',
      title: `${added ? 'Új cél' : 'Cél frissítve'}: ${item.label}`,
      detail,
      widgetId: wid,
      status: pct >= 100 ? 'done' : 'progress',
      meta: { itemId: item.id, value: item.value, target: item.target, en: { title: `${added ? 'New goal' : 'Goal updated'}: ${item.label}` } },
    };
  });
}

// ---------- pomodoro ----------
export function logFocus(widgetId, kind, durationSec) {
  if (kind !== 'focus') return;
  const min = Math.max(1, Math.round((Number(durationSec) || 0) / 60));
  logActivity({ kind: 'focus', title: 'Fókusz munkamenet befejezve', detail: `${min} perc`, widgetId, status: 'done', meta: { minutes: min, en: { title: 'Focus session finished', detail: `${min} min` } } });
}

// ---------- mail bot ----------
export function logMail(widget, result, err) {
  if (!widget) return;
  if (err) {
    logActivity({ kind: 'mail', title: `Levélbot hiba: ${widget.title}`, detail: err.message, widgetId: widget.id, status: 'error', meta: { en: { title: `Mail bot failed: ${widget.title}` } } });
    return;
  }
  const n = result?.mailCount ?? 0;
  const bad = Boolean(result?.aiError);
  logActivity({
    kind: 'mail',
    title: `Levélbot lefutott: ${widget.title}`,
    detail: bad ? result.aiError : result?.headline || `${n} levél`,
    widgetId: widget.id,
    status: bad ? 'error' : 'ok',
    meta: { mailCount: n, en: { title: `Mail bot ran: ${widget.title}`, detail: bad ? result.aiError : result?.headline || `${n} emails` } },
  });
}

// ---------- daily brief ----------
export function logBrief(widget, value) {
  if (!widget) return;
  const failed = /\(AI hiba:/.test(value?.text ?? '');
  logActivity({
    kind: 'brief',
    title: 'Napi összefoglaló elkészült',
    detail: failed ? 'AI hiba — sablon szöveg' : value?.ai ? 'AI összefoglaló' : 'Sablon (AI nélkül)',
    widgetId: widget.id,
    status: failed ? 'error' : 'ok',
    meta: { ai: Boolean(value?.ai), en: { title: 'Daily brief generated', detail: failed ? 'AI error — template text' : value?.ai ? 'AI summary' : 'Template (no AI)' } },
  });
}

// ---------- AI chat ----------
export function logAi(widget, userText, meta) {
  const actions = meta?.actions ?? [];
  const pending = meta?.pending ?? [];
  if (!widget || (!actions.length && !pending.length)) return;
  logActivity({
    kind: 'ai',
    title: short(userText, 80),
    detail: actions.length ? actions.join(' · ') : `${pending.length} jóváhagyásra vár`,
    widgetId: widget.id,
    status: actions.length ? 'done' : 'pending',
    meta: { actions, pending: pending.length, en: actions.length ? null : { detail: `${pending.length} awaiting approval` } },
  });
}
