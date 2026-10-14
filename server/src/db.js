import pg from 'pg';

// DATE columns come back as plain 'YYYY-MM-DD' strings instead of JS Dates (no TZ shifting).
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://nexus:nexus@localhost:5432/nexus',
});

export const q = (text, params) => pool.query(text, params);

const SCHEMA = `
CREATE TABLE IF NOT EXISTS widgets (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  config     JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS habits (
  id         SERIAL PRIMARY KEY,
  widget_id  TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#00f0ff',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS habit_checks (
  habit_id INTEGER NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  day      DATE NOT NULL,
  PRIMARY KEY (habit_id, day)
);

-- Monthly habit view: a habit is shown from start_month until (excluding) end_month.
ALTER TABLE habits ADD COLUMN IF NOT EXISTS start_month DATE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS end_month DATE;
UPDATE habits h SET start_month = date_trunc('month', LEAST(
    h.created_at::date,
    COALESCE((SELECT MIN(day) FROM habit_checks c WHERE c.habit_id = h.id), h.created_at::date)
  ))::date
WHERE start_month IS NULL;

-- Generic per-widget records (todos, counters, mood, expenses, metric logs...).
CREATE TABLE IF NOT EXISTS widget_items (
  id         SERIAL PRIMARY KEY,
  widget_id  TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL DEFAULT 'item',
  day        DATE,
  value      DOUBLE PRECISION,
  data       JSONB NOT NULL DEFAULT '{}',
  sort       INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS widget_items_lookup ON widget_items (widget_id, kind, day);

-- Free-form per-widget state (notes text, cached AI briefings...).
CREATE TABLE IF NOT EXISTS widget_state (
  widget_id  TEXT PRIMARY KEY REFERENCES widgets(id) ON DELETE CASCADE,
  value      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS progress_items (
  id        SERIAL PRIMARY KEY,
  widget_id TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  label     TEXT NOT NULL,
  value     DOUBLE PRECISION NOT NULL DEFAULT 0,
  target    DOUBLE PRECISION NOT NULL DEFAULT 100,
  unit      TEXT NOT NULL DEFAULT '',
  color     TEXT NOT NULL DEFAULT '#00f0ff',
  sort      INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS progress_history (
  id         SERIAL PRIMARY KEY,
  item_id    INTEGER NOT NULL REFERENCES progress_items(id) ON DELETE CASCADE,
  value      DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pomodoro_sessions (
  id           SERIAL PRIMARY KEY,
  widget_id    TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,
  duration_sec INTEGER NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  widget_id  TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mail_digests (
  id         SERIAL PRIMARY KEY,
  widget_id  TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  result     JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS renders (
  id          SERIAL PRIMARY KEY,
  widget_id   TEXT NOT NULL REFERENCES widgets(id) ON DELETE CASCADE,
  prompt      TEXT NOT NULL,
  params      JSONB NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL,
  error       TEXT,
  input       BYTEA NOT NULL,
  input_type  TEXT NOT NULL,
  output      BYTEA,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS renders_widget ON renders (widget_id, id);
`;

export async function migrate(retries = 30) {
  for (let i = 1; ; i++) {
    try {
      await q(SCHEMA);
      return;
    } catch (err) {
      if (i >= retries) throw err;
      console.log(`[db] not ready (${err.code || err.message}), retry ${i}/${retries}...`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}
