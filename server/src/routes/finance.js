import { Router } from 'express';
import { q } from '../db.js';
import { cached, getWidget, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

// Finance tiles (kpi, balance, budget, cashflow). They read the Költségkövető ("expenses") tiles'
// items: kind 'expense' and kind 'income', value = amount, day = YYYY-MM-DD.
const r = Router();

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const daysIn = (y, m0) => new Date(y, m0 + 1, 0).getDate();
const pct = (v, prev) => (prev == null || !isFinite(prev) || prev === 0 || v == null ? null : ((v - prev) / Math.abs(prev)) * 100);
const round2 = (n) => Math.round(n * 100) / 100;
// "Ft" / "HUF" / "ft" → ISO code for the expense tiles' free-text currency field
export const isoCur = (c) => {
  const s = String(c || 'HUF').trim().toUpperCase();
  return { FT: 'HUF', '€': 'EUR', $: 'USD', '£': 'GBP' }[s] ?? (/^[A-Z]{3}$/.test(s) ? s : 'HUF');
};

// Today, overridable in tests via ?today=YYYY-MM-DD (only honoured outside production).
function today(req) {
  const t = req.query.today;
  if (t && process.env.NODE_ENV !== 'production' && /^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date();
}

async function expenseTiles() {
  const { rows } = await q("SELECT id, title, config FROM widgets WHERE type = 'expenses' ORDER BY created_at");
  return rows;
}
// the first Költségkövető, or the one whose title matches `name` (case-insensitive)
async function pickTile(name) {
  const tiles = await expenseTiles();
  const n = String(name ?? '').trim().toLowerCase();
  if (!n) return tiles[0] ?? null;
  return tiles.find((t) => String(t.title).trim().toLowerCase() === n) ?? null;
}
const tileInfo = (t) =>
  t && { id: t.id, title: t.title, currency: t.config?.currency || 'Ft', budget: Number(t.config?.budget) || 0, categories: t.config?.categories ?? null };

async function sum(ids, kind, from, to) {
  if (!ids.length) return 0;
  const { rows } = await q(
    'SELECT COALESCE(SUM(value), 0)::float AS s FROM widget_items WHERE widget_id = ANY($1) AND kind = $2 AND day >= $3 AND day <= $4',
    [ids, kind, from, to],
  );
  return rows[0].s;
}

// This month (1st..today) vs the same days of last month.
async function monthToDate(ids, kind, now) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  const cur = await sum(ids, kind, ymd(new Date(y, m, 1)), ymd(now));
  const pd = Math.min(d, daysIn(y, m - 1));
  const prev = await sum(ids, kind, ymd(new Date(y, m - 1, 1)), ymd(new Date(y, m - 1, pd)));
  return { value: cur, previous: prev };
}

const getPath = (obj, path) =>
  String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((o, k) => (o == null ? undefined : Array.isArray(o) && /^\d+$/.test(k) ? o[Number(k)] : o[k]), obj);

async function fetchJson(url) {
  const res = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new HttpError(502, `HTTP ${res.status}`);
  return res.json();
}

// ---------- KPI ----------
async function kpiMetric(widgetId, m, i, now) {
  const source = m.source || 'manual';
  const base = { label: m.label || '', source, unit: m.unit ?? '', icon: m.icon || '', decimals: m.decimals === '' || m.decimals == null ? null : Number(m.decimals) };
  if (source === 'manual') {
    const v = m.value === '' || m.value == null ? null : Number(m.value);
    const p = m.previous === '' || m.previous == null ? null : Number(m.previous);
    return { ...base, value: v, previous: p, change: pct(v, p) };
  }
  if (source === 'expenses' || source === 'income') {
    const tile = await pickTile(m.tile);
    if (!tile) return { ...base, value: null, error: m.tile ? 'tile' : 'notile' };
    const { value, previous } = await monthToDate([tile.id], source === 'income' ? 'income' : 'expense', now);
    return { ...base, unit: m.unit || tile.config?.currency || 'Ft', value, previous, change: pct(value, previous), lowerIsBetter: source === 'expenses' };
  }
  if (source === 'api') {
    if (!m.url) return { ...base, value: null, error: 'nourl' };
    const url = resolveSecrets(String(m.url));
    let value;
    try {
      const json = await cached(`fin:api:${url}`, 5 * 60_000, () => fetchJson(url));
      value = Number(getPath(json, m.path));
    } catch (e) {
      return { ...base, value: null, error: e.message };
    }
    if (!isFinite(value)) return { ...base, value: null, error: 'path' };
    // one value per metric per day; the change is against the latest earlier day ("yesterday")
    const key = `${m.url}|${m.path || ''}`;
    const day = ymd(now);
    const upd = await q("UPDATE widget_items SET value = $3 WHERE widget_id = $1 AND kind = 'kpi' AND day = $2 AND data->>'key' = $4 RETURNING id", [widgetId, day, value, key]);
    if (!upd.rows[0]) await q("INSERT INTO widget_items (widget_id, kind, day, value, data) VALUES ($1, 'kpi', $2, $3, $4)", [widgetId, day, value, JSON.stringify({ key })]);
    const { rows } = await q("SELECT value FROM widget_items WHERE widget_id = $1 AND kind = 'kpi' AND data->>'key' = $2 AND day < $3 ORDER BY day DESC LIMIT 1", [widgetId, key, day]);
    const previous = rows[0]?.value ?? null;
    return { ...base, value, previous, change: pct(value, previous), period: 'day' };
  }
  return { ...base, value: null, error: 'source' };
}

r.get('/widgets/:id/kpi', async (req, res) => {
  const w = await getWidget(req.params.id, 'kpi');
  const now = today(req);
  const metrics = Array.isArray(w.config?.metrics) ? w.config.metrics : [];
  const out = await Promise.all(metrics.map((m, i) => kpiMetric(w.id, m ?? {}, i, now)));
  res.json({ metrics: out });
});

// ---------- Balance ----------
export async function fxRates() {
  return cached('fin:fx', 6 * 3600_000, async () => {
    const j = await fetchJson('https://open.er-api.com/v6/latest/USD');
    if (!j?.rates) throw new HttpError(502, 'no rates');
    return { USD: 1, ...j.rates };
  });
}

r.get('/widgets/:id/balance', async (req, res) => {
  const w = await getWidget(req.params.id, 'balance');
  const now = today(req);
  const base = String(w.config?.base || 'HUF').toUpperCase();
  const accounts = (Array.isArray(w.config?.accounts) ? w.config.accounts : []).map((a) => ({
    name: a?.name || '',
    currency: String(a?.currency || base).toUpperCase().trim(),
    amount: Number(a?.amount) || 0,
    limit: a?.limit === '' || a?.limit == null ? null : Number(a.limit),
    active: a?.active !== false,
  }));
  const needFx = accounts.some((a) => a.currency !== base);
  let rates = null;
  let fxError = null;
  if (needFx) {
    try {
      rates = await fxRates();
    } catch (e) {
      fxError = e.message;
    }
  }
  const conv = (amount, cur) => {
    if (cur === base) return amount;
    if (!rates?.[cur] || !rates?.[base]) return null;
    return (amount / rates[cur]) * rates[base];
  };
  let total = 0;
  let missing = false;
  for (const a of accounts) {
    a.inBase = conv(a.amount, a.currency);
    if (a.inBase == null) missing = true;
    else total += a.inBase;
  }
  total = round2(total);
  let previous = null;
  if (!missing && accounts.length) {
    // one snapshot per month (day = 1st), kept current; last month's row is that month's last total
    const first = ymd(new Date(now.getFullYear(), now.getMonth(), 1));
    const upd = await q("UPDATE widget_items SET value = $3 WHERE widget_id = $1 AND kind = 'snap' AND day = $2 RETURNING id", [w.id, first, total]);
    if (!upd.rows[0]) await q("INSERT INTO widget_items (widget_id, kind, day, value, data) VALUES ($1, 'snap', $2, $3, '{}')", [w.id, first, total]);
    const prevDay = ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1));
    const { rows } = await q("SELECT value FROM widget_items WHERE widget_id = $1 AND kind = 'snap' AND day = $2", [w.id, prevDay]);
    previous = rows[0]?.value ?? null;
  }
  const tile = await pickTile(w.config?.expenseTile);
  res.json({ base, total, previous, change: pct(total, previous), accounts, missing, fxError, expenseTile: tileInfo(tile) });
});

// ---------- Budget ----------
r.get('/widgets/:id/budget', async (req, res) => {
  const w = await getWidget(req.params.id, 'budget');
  const now = today(req);
  const tile = await pickTile(w.config?.source);
  if (!tile) return res.json({ tile: null, missing: w.config?.source ? 'tile' : 'notile' });
  const y = now.getFullYear();
  const m = now.getMonth();
  const dim = daysIn(y, m);
  const spent = await sum([tile.id], 'expense', ymd(new Date(y, m, 1)), ymd(new Date(y, m, dim)));
  const limit = Number(w.config?.limit) || Number(tile.config?.budget) || 0;
  const daysLeft = dim - now.getDate() + 1; // today included
  const left = limit - spent;
  res.json({
    tile: tileInfo(tile),
    spent,
    limit,
    left,
    ratio: limit ? spent / limit : null,
    daysLeft,
    daysInMonth: dim,
    daily: limit ? Math.max(0, left) / daysLeft : null,
    // where spending "should" be today at an even pace
    pace: limit ? (now.getDate() / dim) * limit : null,
  });
});

// ---------- Cashflow ----------
r.get('/widgets/:id/cashflow', async (req, res) => {
  const w = await getWidget(req.params.id, 'cashflow');
  const now = today(req);
  const n = Math.min(12, Math.max(3, Number(w.config?.months) || 8));
  const tiles = await expenseTiles();
  const start = new Date(now.getFullYear(), now.getMonth() - n + 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const months = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    months.push({ ym: `${d.getFullYear()}-${pad(d.getMonth() + 1)}`, income: 0, expense: 0 });
  }
  if (tiles.length) {
    const { rows } = await q(
      `SELECT to_char(day, 'YYYY-MM') AS ym, kind, SUM(value)::float AS s FROM widget_items
       WHERE widget_id = ANY($1) AND kind IN ('expense', 'income') AND day >= $2 AND day <= $3 GROUP BY 1, 2`,
      [tiles.map((t) => t.id), ymd(start), ymd(end)],
    );
    for (const row of rows) {
      const mo = months.find((x) => x.ym === row.ym);
      if (mo) mo[row.kind] = row.s;
    }
  }
  const cur = months[months.length - 1];
  res.json({ months, currency: tiles[0]?.config?.currency || 'Ft', tiles: tiles.length, net: cur.income - cur.expense });
});

export default r;
