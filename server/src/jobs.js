import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { HttpError } from './util.js';

/*
 * Long AI turns run as background jobs: the POST answers at once with { job }, and the browser polls
 * GET /api/jobs/:id. A slow local model (Ollama on a small CPU) can take minutes, while Cloudflare cuts
 * a proxied request after 100 seconds.
 */
const jobs = new Map();
const KEEP_MS = 15 * 60_000;

export function startJob(work) {
  const now = Date.now();
  for (const [k, j] of jobs) if (now - j.at > KEEP_MS) jobs.delete(k);
  const id = randomUUID();
  const job = { state: 'running', at: now };
  jobs.set(id, job);
  Promise.resolve()
    .then(work)
    .then(
      (result) => Object.assign(job, { state: 'done', result, at: Date.now() }),
      (err) => Object.assign(job, { state: 'error', error: err.message, status: err.status || 500, at: Date.now() }),
    );
  return id;
}

export const jobRoutes = Router();
jobRoutes.get('/jobs/:id', (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) throw new HttpError(404, 'Ez a kérés már nem ismert (újraindult a szerver?). Küldd el újra.');
  if (job.state === 'running') return res.json({ state: 'running' });
  if (job.state === 'error') return res.status(job.status).json({ state: 'error', error: job.error });
  res.json({ state: 'done', result: job.result });
});
