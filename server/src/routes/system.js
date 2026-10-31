import { Router } from 'express';
import os from 'node:os';
import fs from 'node:fs/promises';
import { q } from '../db.js';
import { getWidget, cached } from '../util.js';
import { resolveSecrets } from '../secrets.js';

const r = Router();

// ---------- Server monitor ----------
let lastCpu = null;
function cpuPercent() {
  const t = os.cpus().reduce(
    (a, c) => {
      const total = Object.values(c.times).reduce((x, y) => x + y, 0);
      return { idle: a.idle + c.times.idle, total: a.total + total };
    },
    { idle: 0, total: 0 },
  );
  const prev = lastCpu;
  lastCpu = t;
  if (!prev || t.total === prev.total) return null;
  return Math.round((1 - (t.idle - prev.idle) / (t.total - prev.total)) * 100);
}
cpuPercent();

async function memory() {
  // MemAvailable is a better "free" figure than os.freemem() on Linux.
  try {
    const info = await fs.readFile('/proc/meminfo', 'utf8');
    const kb = (k) => Number(info.match(new RegExp(`^${k}:\\s+(\\d+)`, 'm'))?.[1]) * 1024;
    return { total: kb('MemTotal'), available: kb('MemAvailable') };
  } catch {
    return { total: os.totalmem(), available: os.freemem() };
  }
}

r.get('/system', async (_req, res) => {
  const [mem, disk, db] = await Promise.all([
    memory(),
    fs.statfs('/').then((s) => ({ total: s.blocks * s.bsize, free: s.bavail * s.bsize })).catch(() => null),
    q('SELECT pg_database_size(current_database())::bigint AS size').then((x) => Number(x.rows[0].size)).catch(() => null),
  ]);
  res.json({
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model?.trim(),
    cpu: cpuPercent(),
    load: os.loadavg(),
    mem,
    disk,
    dbSize: db,
    uptime: os.uptime(),
    appUptime: process.uptime(),
    node: process.version,
  });
});

// ---------- Service / uptime monitor ----------
const history = new Map(); // `${widgetId}|${url}` → [{ ok, ms, t }]

async function probe(url) {
  const started = performance.now();
  try {
    const res = await fetch(resolveSecrets(url), { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(8000) });
    res.body?.cancel().catch(() => {});
    return { ok: res.status < 400, status: res.status, ms: Math.round(performance.now() - started) };
  } catch (err) {
    return { ok: false, status: null, ms: null, error: err.cause?.code || err.name || err.message };
  }
}

r.get('/widgets/:id/uptime', async (req, res) => {
  const w = await getWidget(req.params.id, 'uptime');
  const targets = (w.config.targets ?? []).filter((t) => t?.url);
  const ttl = Math.max(15, Number(w.config.intervalSec) || 60) * 1000 - 1000;
  const results = await cached(`${w.id}:uptime`, ttl, () =>
    Promise.all(
      targets.map(async (t) => {
        const result = await probe(t.url);
        const key = `${w.id}|${t.url}`;
        const h = [...(history.get(key) ?? []), { ok: result.ok, ms: result.ms, t: Date.now() }].slice(-40);
        history.set(key, h);
        return { name: t.name || new URL(t.url.replace(/\{\{.*?\}\}/g, 'x')).host, url: t.url, ...result };
      }),
    ),
  );
  res.json(
    results.map((x) => {
      const h = history.get(`${w.id}|${x.url}`) ?? [];
      return { ...x, history: h, uptime: h.length ? Math.round((h.filter((p) => p.ok).length / h.length) * 100) : null };
    }),
  );
});

export default r;
