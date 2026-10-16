import { Router } from 'express';
import { q } from '../db.js';
import { getWidget, HttpError } from '../util.js';

// Architectural visualisation: sketch / screenshot → photoreal render through a local ComfyUI.
// The image is sent as img2img and, when a ControlNet model is available, its edges (Canny) are
// used to keep the geometry and perspective of the input.
const r = Router();

export const DEFAULT_URL = 'http://host.docker.internal:8188';
const KEEP = 40; // renders kept per tile
const MAX_INPUT = 12 * 1024 * 1024;
const TIMEOUT = 20 * 60_000; // CPU / big models can be slow

const base = (w) => String(w.config.comfyUrl || process.env.COMFYUI_URL || DEFAULT_URL).trim().replace(/\/+$/, '');

function explain(err, url) {
  const code = err.cause?.code || err.code;
  if (['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ECONNRESET'].includes(code) || /fetch failed/i.test(err.message)) {
    return new HttpError(
      502,
      `Nem érem el a ComfyUI-t itt: ${url}. Fut a ComfyUI? A ComfyUI Desktop alkalmazás a 8000-es, a kézi telepítés a 8188-as porton figyel; ` +
        'Dockerből a saját gépedet a host.docker.internal név éri el (pl. http://host.docker.internal:8000). A címet a csempe ⚙ beállításaiban adhatod meg.',
    );
  }
  if (err.name === 'TimeoutError') return new HttpError(504, `A ComfyUI nem válaszolt időben (${url}).`);
  return err instanceof HttpError ? err : new HttpError(502, `ComfyUI hiba: ${err.message}`);
}

async function comfy(url, path, init = {}) {
  let res;
  try {
    res = await fetch(`${url}${path}`, { ...init, signal: AbortSignal.timeout(init.timeout ?? 30_000) });
  } catch (err) {
    throw explain(err, url);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new HttpError(502, `ComfyUI hiba (${res.status}): ${describeError(body)}`);
  }
  return res;
}

// ComfyUI answers a rejected workflow with { error, node_errors: { id: { errors: [{ message, details }] } } }.
function describeError(body) {
  try {
    const j = JSON.parse(body);
    const nodeMsgs = Object.values(j.node_errors ?? {}).flatMap((n) => (n.errors ?? []).map((e) => `${n.class_type}: ${e.message}${e.details ? ` (${e.details})` : ''}`));
    return [j.error?.message, ...nodeMsgs].filter(Boolean).join(' · ') || body.slice(0, 400);
  } catch {
    return body.slice(0, 400);
  }
}

// /object_info lists combo values as [[...]] (older) or ["COMBO", { options: [...] }] (newer).
function comboValues(info, node, input) {
  const spec = info?.[node]?.input?.required?.[input];
  if (!spec) return [];
  if (Array.isArray(spec[0])) return spec[0];
  return spec[1]?.options ?? [];
}

async function listModels(url) {
  const [ck, cn] = await Promise.all([
    comfy(url, '/object_info/CheckpointLoaderSimple').then((r) => r.json()),
    comfy(url, '/object_info/ControlNetLoader').then((r) => r.json()),
  ]);
  return { checkpoints: comboValues(ck, 'CheckpointLoaderSimple', 'ckpt_name'), controlnets: comboValues(cn, 'ControlNetLoader', 'control_net_name') };
}

const isXL = (name) => /xl|pony|illustrious/i.test(name);

// A ControlNet must match the checkpoint's family (SD1.5 vs SDXL) and should understand edge maps.
export function pickControlnet(ckpt, controlnets) {
  const score = (n) => (/canny|lineart|mlsd|scribble|union|edge/i.test(n) ? 2 : 0) + (isXL(ckpt) === isXL(n) ? 3 : 0);
  const best = [...controlnets].sort((a, b) => score(b) - score(a))[0];
  return best && score(best) >= 3 ? best : null;
}

async function resolveModels(w, url) {
  const { checkpoints, controlnets } = await listModels(url);
  if (!checkpoints.length) {
    throw new HttpError(400, 'A ComfyUI-ban nincs egy modell (checkpoint) sem. Tölts le egyet (pl. egy SDXL modellt) a ComfyUI models/checkpoints mappájába.');
  }
  const ckpt = checkpoints.includes(w.config.checkpoint) ? w.config.checkpoint : checkpoints[0];
  let controlnet = null;
  if (w.config.controlnet !== 'none') {
    controlnet = controlnets.includes(w.config.controlnet) ? w.config.controlnet : pickControlnet(ckpt, controlnets);
  }
  return { ckpt, controlnet, checkpoints, controlnets };
}

const NEGATIVE = 'blurry, lowres, distorted, deformed, warped lines, bent walls, extra windows, text, watermark, logo, cartoon, oversaturated';

// ComfyUI API-format workflow. Node ids are arbitrary strings; inputs reference [nodeId, outputIndex].
export function buildWorkflow({ ckpt, controlnet, image, prompt, negative, denoise, lines, steps, cfg, megapixels, seed }) {
  const g = {
    ckpt: { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    pos: { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['ckpt', 1] } },
    neg: { class_type: 'CLIPTextEncode', inputs: { text: negative, clip: ['ckpt', 1] } },
    load: { class_type: 'LoadImage', inputs: { image } },
    scale: { class_type: 'ImageScaleToTotalPixels', inputs: { image: ['load', 0], upscale_method: 'lanczos', megapixels, resolution_steps: 8 } },
    enc: { class_type: 'VAEEncode', inputs: { pixels: ['scale', 0], vae: ['ckpt', 2] } },
  };
  let positive = ['pos', 0];
  let negativeRef = ['neg', 0];
  if (controlnet && lines > 0) {
    g.cnload = { class_type: 'ControlNetLoader', inputs: { control_net_name: controlnet } };
    g.edges = { class_type: 'Canny', inputs: { image: ['scale', 0], low_threshold: 0.2, high_threshold: 0.5 } };
    g.cn = {
      class_type: 'ControlNetApplyAdvanced',
      inputs: { positive, negative: negativeRef, control_net: ['cnload', 0], image: ['edges', 0], strength: lines, start_percent: 0, end_percent: 0.85, vae: ['ckpt', 2] },
    };
    positive = ['cn', 0];
    negativeRef = ['cn', 1];
  }
  g.sample = {
    class_type: 'KSampler',
    inputs: { model: ['ckpt', 0], seed, steps, cfg, sampler_name: 'dpmpp_2m', scheduler: 'karras', positive, negative: negativeRef, latent_image: ['enc', 0], denoise },
  };
  g.dec = { class_type: 'VAEDecode', inputs: { samples: ['sample', 0], vae: ['ckpt', 2] } };
  g.save = { class_type: 'SaveImage', inputs: { images: ['dec', 0], filename_prefix: 'nexus/render' } };
  return g;
}

const clamp = (v, lo, hi, dflt) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
};

function parseImage(dataUrl) {
  const m = /^data:(image\/(png|jpeg|webp));base64,(.+)$/s.exec(String(dataUrl ?? ''));
  if (!m) throw new HttpError(400, 'Tölts fel egy képet (PNG, JPG vagy WebP).');
  const buf = Buffer.from(m[3], 'base64');
  if (buf.length > MAX_INPUT) throw new HttpError(413, 'A kép túl nagy (max. 12 MB).');
  return { buf, type: m[1], ext: m[2] === 'jpeg' ? 'jpg' : m[2] };
}

async function generate(id, w, url, params, input) {
  const form = new FormData();
  form.append('image', new Blob([input.buf], { type: input.type }), `nexus-${id}.${input.ext}`);
  form.append('overwrite', 'true');
  const up = await (await comfy(url, '/upload/image', { method: 'POST', body: form, timeout: 60_000 })).json();
  const image = up.subfolder ? `${up.subfolder}/${up.name}` : up.name;

  const workflow = buildWorkflow({ ...params, image });
  const { prompt_id } = await (
    await comfy(url, '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: workflow, client_id: 'nexus-dashboard' }) })
  ).json();

  const started = Date.now();
  for (;;) {
    await new Promise((res) => setTimeout(res, 1500));
    if (Date.now() - started > TIMEOUT) throw new HttpError(504, 'A render 20 perc alatt sem készült el.');
    const h = (await (await comfy(url, `/history/${prompt_id}`)).json())[prompt_id];
    if (!h) continue; // still queued / running
    if (h.status?.status_str === 'error') {
      const msg = h.status.messages?.find(([kind]) => kind === 'execution_error')?.[1];
      throw new HttpError(502, `A ComfyUI hibára futott${msg ? ` (${msg.node_type}): ${msg.exception_message}` : '.'}`);
    }
    const out = Object.values(h.outputs ?? {}).flatMap((o) => o.images ?? []).find((i) => i.type === 'output');
    if (!out) {
      if (h.status?.completed) throw new HttpError(502, 'A ComfyUI nem adott vissza képet.');
      continue;
    }
    const qs = new URLSearchParams({ filename: out.filename, subfolder: out.subfolder ?? '', type: out.type });
    const img = Buffer.from(await (await comfy(url, `/view?${qs}`, { timeout: 60_000 })).arrayBuffer());
    return img;
  }
}

async function runJob(id, w, url, params, input) {
  try {
    const output = await generate(id, w, url, params, input);
    await q("UPDATE renders SET status = 'done', output = $2, finished_at = now() WHERE id = $1", [id, output]);
  } catch (err) {
    const e = explain(err, url);
    await q("UPDATE renders SET status = 'error', error = $2, finished_at = now() WHERE id = $1", [id, e.message]).catch(() => {});
  }
}

// Jobs live in this process; after a restart, unfinished ones can't be picked up again.
export async function recoverRenders() {
  await q("UPDATE renders SET status = 'error', error = 'A szerver újraindult a render közben.', finished_at = now() WHERE status = 'running'");
}

const columns = 'id, prompt, params, status, error, created_at, finished_at';

r.get('/widgets/:id/renders', async (req, res) => {
  await getWidget(req.params.id, 'render');
  const { rows } = await q(`SELECT ${columns} FROM renders WHERE widget_id = $1 ORDER BY id DESC LIMIT ${KEEP}`, [req.params.id]);
  res.json(rows);
});

r.get('/widgets/:id/render/models', async (req, res) => {
  const w = await getWidget(req.params.id, 'render');
  const url = base(w);
  try {
    const m = await resolveModels(w, url);
    res.json({ url, checkpoint: m.ckpt, controlnet: m.controlnet, checkpoints: m.checkpoints, controlnets: m.controlnets });
  } catch (err) {
    throw explain(err, url);
  }
});

r.post('/widgets/:id/render', async (req, res) => {
  const w = await getWidget(req.params.id, 'render');
  const prompt = String(req.body?.prompt ?? '').trim();
  if (!prompt) throw new HttpError(400, 'Írd le, milyen látványt szeretnél (prompt).');
  const input = parseImage(req.body?.image);
  const url = base(w);
  let models;
  try {
    models = await resolveModels(w, url);
  } catch (err) {
    throw explain(err, url);
  }
  const params = {
    ckpt: models.ckpt,
    controlnet: models.controlnet,
    prompt,
    negative: String(w.config.negative || NEGATIVE),
    denoise: clamp(req.body?.denoise, 0.2, 1, 0.6),
    lines: models.controlnet ? clamp(req.body?.lines, 0, 1.5, 0.8) : 0,
    steps: clamp(w.config.steps, 4, 60, 25),
    cfg: clamp(w.config.cfg, 1, 15, 6),
    megapixels: clamp(w.config.megapixels, 0.25, 2, 1),
    seed: Math.floor(Math.random() * 2 ** 31),
  };
  const { rows } = await q(
    `INSERT INTO renders (widget_id, prompt, params, status, input, input_type) VALUES ($1, $2, $3, 'running', $4, $5) RETURNING ${columns}`,
    [w.id, prompt, params, input.buf, input.type],
  );
  await q(`DELETE FROM renders WHERE widget_id = $1 AND id NOT IN (SELECT id FROM renders WHERE widget_id = $1 ORDER BY id DESC LIMIT ${KEEP})`, [w.id]);
  runJob(rows[0].id, w, url, params, input); // runs in the background; the tile polls the list
  res.status(202).json(rows[0]);
});

r.get('/renders/:rid/:kind', async (req, res) => {
  if (!['input', 'output'].includes(req.params.kind)) throw new HttpError(404, 'Nincs ilyen kép.');
  const col = req.params.kind === 'input' ? 'input, input_type AS type' : "output, 'image/png' AS type";
  const { rows } = await q(`SELECT ${col} FROM renders WHERE id = $1`, [Number(req.params.rid) || 0]);
  const img = rows[0]?.[req.params.kind];
  if (!img) throw new HttpError(404, 'Nincs ilyen kép.');
  res.set('Content-Type', rows[0].type).set('Cache-Control', 'private, max-age=31536000, immutable').send(img);
});

r.delete('/renders/:rid', async (req, res) => {
  await q('DELETE FROM renders WHERE id = $1', [Number(req.params.rid) || 0]);
  res.json({ ok: true });
});

export default r;
