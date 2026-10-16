import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import useBackdropClose from '../components/useBackdropClose.js';

// Prompt snippets: Stable Diffusion / FLUX understand English best.
const PRESETS = [
  ['Nappal', 'bright daylight, clear blue sky, soft shadows'],
  ['Naplemente', 'golden hour, warm sunset light, long shadows'],
  ['Este', 'blue hour, dusk, warm interior lights glowing through windows'],
  ['Belső tér', 'interior design photography, natural light from windows, high-end furniture'],
  ['Tél', 'winter, light snow on the ground, overcast sky'],
  ['Makett', 'white architectural scale model, clean studio lighting, minimal'],
];
const QUALITY = 'professional architectural visualization, photorealistic, realistic materials, highly detailed, sharp focus';
const MAX_SIDE = 1600;

// A line drawing has nothing to keep but its lines: redraw everything and let ControlNet hold the geometry.
// A screenshot / clay render already has light and volumes worth keeping, so it is only partly redrawn.
const SOURCES = {
  sketch: { label: 'Vázlat', denoise: 1, lines: 1 },
  photo: { label: 'Képernyőkép / fotó', denoise: 0.6, lines: 0.7 },
};

// Shrink big photos / screenshots in the browser so uploads stay small (the render is ~1 MP anyway).
function loadImage(file) {
  return new Promise((resolve, reject) => {
    if (!file?.type?.startsWith('image/')) return reject(new Error('Ez nem kép.'));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; // transparent PNG exports → white paper, not black
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('A képet nem sikerült beolvasni.'));
    };
    img.src = url;
  });
}

const blobToDataUrl = (blob) =>
  new Promise((resolve) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(blob);
  });

const short = (name) => (name ? name.replace(/\.(safetensors|ckpt|pth|bin)$/i, '').split(/[\\/]/).pop() : '—');
const seconds = (a, b) => Math.max(0, Math.round((new Date(b ?? Date.now()) - new Date(a)) / 1000));

function Viewer({ item, onClose, onReuse, onDelete }) {
  const [before, setBefore] = useState(false);
  const backdrop = useBackdropClose(onClose);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  const src = `/api/renders/${item.id}/${before || item.status !== 'done' ? 'input' : 'output'}`;
  // portal: the canvas is CSS-transformed, which would make position: fixed relative to the tile
  return createPortal(
    <div className="overlay center render-viewer" {...backdrop}>
      <div className="modal render-modal">
        <img src={src} alt={item.prompt} />
        {item.error && <div className="w-error sm">{item.error}</div>}
        {item.status === 'running' && <div className="sm muted">Készül… ({seconds(item.created_at)} mp)</div>}
        <div className="sm muted render-meta">{item.prompt}</div>
        <div className="sm muted mono">
          {short(item.params?.ckpt)}
          {item.params?.controlnet ? ` · ${short(item.params.controlnet)}` : ''} · szabadság {item.params?.denoise}
          {item.params?.lines ? ` · vonalak ${item.params.lines}` : ''} · {seconds(item.created_at, item.finished_at)} mp
        </div>
        <div className="modal-foot">
          {item.status === 'done' && (
            <button className="btn btn-ghost" onMouseDown={() => setBefore(true)} onMouseUp={() => setBefore(false)} onMouseLeave={() => setBefore(false)}>
              Eredeti (nyomva tartva)
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => onReuse(item)}>
            Újra ezzel
          </button>
          {item.status === 'done' && (
            <a className="btn btn-ghost" href={`/api/renders/${item.id}/output`} download={`latvanyterv-${item.id}.png`}>
              Letöltés
            </a>
          )}
          <button className="btn btn-ghost danger" onClick={() => onDelete(item)}>
            Törlés
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Bezár
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default function Render({ widget, onUpdateConfig }) {
  const models = useWidgetData(`/widgets/${widget.id}/render/models`, { deps: [widget.config.comfyUrl, widget.config.checkpoint, widget.config.controlnet] });
  const [poll, setPoll] = useState(0);
  const renders = useWidgetData(`/widgets/${widget.id}/renders`, { interval: poll });
  const [image, setImage] = useState(null);
  const [prompt, setPrompt] = useState('');
  const [presets, setPresets] = useState(['Nappal']);
  const [source, setSource] = useState('sketch');
  const [denoise, setDenoise] = useState(SOURCES.sketch.denoise);
  const [lines, setLines] = useState(SOURCES.sketch.lines);
  const [err, setErr] = useState(null);
  const [sending, setSending] = useState(false);
  const [open, setOpen] = useState(null);
  const [showModels, setShowModels] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef(null);
  const [, tick] = useState(0);

  const list = renders.data ?? [];
  const running = list.some((x) => x.status === 'running');
  useEffect(() => setPoll(running ? 2000 : 0), [running]);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => tick((n) => n + 1), 1000); // elapsed seconds on the running card
    return () => clearInterval(t);
  }, [running]);

  const m = models.data;
  const hasCn = Boolean(m?.controlnet);

  const pick = async (file) => {
    setErr(null);
    try {
      setImage(await loadImage(file));
    } catch (e) {
      setErr(e.message);
    }
  };

  const onPaste = (e) => {
    const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
    if (file) {
      e.preventDefault();
      pick(file);
    }
  };

  const fullPrompt = [prompt.trim(), ...PRESETS.filter(([k]) => presets.includes(k)).map(([, v]) => v), QUALITY].filter(Boolean).join(', ');

  const run = async () => {
    setErr(null);
    setSending(true);
    try {
      const job = await api.post(`/widgets/${widget.id}/render`, { image, prompt: fullPrompt, denoise, lines: hasCn ? lines : 0 });
      renders.setData((l) => [job, ...(l ?? [])]);
      setPoll(2000);
    } catch (e) {
      setErr(e.message);
    } finally {
      setSending(false);
    }
  };

  const reuse = async (item) => {
    setOpen(null);
    const blob = await (await fetch(`/api/renders/${item.id}/input`)).blob();
    setImage(await blobToDataUrl(blob));
    // the stored prompt includes the presets and quality words — strip them back out
    let text = item.prompt.replace(`, ${QUALITY}`, '').replace(QUALITY, '');
    const used = PRESETS.filter(([, v]) => text.includes(v)).map(([k]) => k);
    for (const [, v] of PRESETS) text = text.replace(`, ${v}`, '').replace(v, '');
    setPrompt(text.replace(/^,\s*/, '').trim());
    setPresets(used);
    setSource(item.params?.denoise >= 0.95 ? 'sketch' : 'photo');
    if (item.params?.denoise) setDenoise(item.params.denoise);
    if (item.params?.lines) setLines(item.params.lines);
  };

  const remove = async (item) => {
    await api.del(`/renders/${item.id}`);
    setOpen(null);
    renders.setData((l) => l.filter((x) => x.id !== item.id));
  };

  const chooseSource = (k) => {
    setSource(k);
    setDenoise(SOURCES[k].denoise);
    setLines(SOURCES[k].lines);
  };

  const setModel = (key, value) => onUpdateConfig({ [key]: value });

  return (
    <div className="render" onPaste={onPaste}>
      <div className="row gap between">
        <button className="render-status mono sm" onClick={() => setShowModels((s) => !s)} title="Modellek">
          <span className={`dot ${m ? 'ok' : models.error ? 'bad' : ''}`} />
          {m ? `${short(m.checkpoint)}${m.controlnet ? ' + vonalvezetés' : ''}` : models.error ? (/^Nem érem el|nem válaszolt/.test(models.error) ? 'ComfyUI nem elérhető' : /nincs egy modell/i.test(models.error) ? 'ComfyUI fut · nincs modell' : 'ComfyUI hiba') : 'ComfyUI…'}
        </button>
        {models.error && (
          <button className="btn btn-ghost sm" onClick={models.reload}>
            Újra
          </button>
        )}
      </div>
      {models.error && <div className="w-error sm">{models.error}</div>}
      {showModels && m && (
        <div className="render-models">
          <label className="form-row">
            <span className="label">Modell (checkpoint)</span>
            <select className="input sm" value={m.checkpoint} onChange={(e) => setModel('checkpoint', e.target.value)}>
              {m.checkpoints.map((c) => (
                <option key={c} value={c}>
                  {short(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="form-row">
            <span className="label">ControlNet (vonalak megtartása)</span>
            <select className="input sm" value={widget.config.controlnet === 'none' ? 'none' : m.controlnet ?? ''} onChange={(e) => setModel('controlnet', e.target.value)}>
              <option value="">{m.controlnets.length ? 'automatikus' : 'nincs letöltve'}</option>
              <option value="none">kikapcsolva</option>
              {m.controlnets.map((c) => (
                <option key={c} value={c}>
                  {short(c)}
                </option>
              ))}
            </select>
          </label>
          {!m.controlnet && widget.config.controlnet !== 'none' && (
            <div className="help">
              Nincs a modellhez illő ControlNet, ezért csak img2img fut (a geometria kevésbé marad pontos). SDXL modellhez tölts le egy SDXL canny/union
              ControlNetet a ComfyUI models/controlnet mappájába.
            </div>
          )}
        </div>
      )}

      <div
        className={`render-drop ${drag ? 'drag' : ''} ${image ? 'has' : ''}`}
        onClick={() => fileRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          pick(e.dataTransfer.files?.[0]);
        }}
      >
        {image ? <img src={image} alt="" /> : <span className="muted sm">Húzd ide a vázlatot / képernyőképet, kattints, vagy illeszd be (⌘V)</span>}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      <div className="seg">
        {Object.entries(SOURCES).map(([k, x]) => (
          <button key={k} className={`seg-btn ${source === k ? 'on' : ''}`} onClick={() => chooseSource(k)}>
            {x.label.toUpperCase()}
          </button>
        ))}
      </div>
      {source === 'sketch' && !hasCn && m && (
        <div className="help">Vázlathoz ControlNet kell, nélküle a modell nem tudja követni a vonalakat. Lásd a modellek listáját fent.</div>
      )}
      <textarea
        className="input sm"
        rows={2}
        placeholder="Mit látsz a képen? Angolul a legjobb, pl. modern family house, white plaster and larch wood cladding, garden, trees"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <div className="chips">
        {PRESETS.map(([k]) => (
          <button key={k} className={`chip ${presets.includes(k) ? 'chip-on' : ''}`} onClick={() => setPresets((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]))}>
            {k}
          </button>
        ))}
      </div>
      <label className="render-slider" title="Mennyire térhet el a modell az eredeti képtől">
        <span className="label">Szabadság</span>
        <input type="range" min={0.3} max={1} step={0.05} value={denoise} onChange={(e) => setDenoise(Number(e.target.value))} />
        <span className="mono sm">{Math.round(denoise * 100)}%</span>
      </label>
      {hasCn && (
        <label className="render-slider" title="Mennyire kövesse a vázlat vonalait (ControlNet)">
          <span className="label">Vonalak</span>
          <input type="range" min={0} max={1.5} step={0.05} value={lines} onChange={(e) => setLines(Number(e.target.value))} />
          <span className="mono sm">{Math.round(lines * 100)}%</span>
        </label>
      )}
      {err && <div className="w-error sm">{err}</div>}
      <button className="btn btn-primary" disabled={!image || sending || !m} onClick={run}>
        {sending ? 'Küldés…' : running ? '▶ Render (sorba áll)' : '▶ Render'}
      </button>

      {list.length > 0 && (
        <div className="render-gallery">
          {list.map((x) => (
            <button key={x.id} className={`render-thumb ${x.status}`} onClick={() => setOpen(x)} title={x.error || x.prompt}>
              <img src={`/api/renders/${x.id}/${x.status === 'done' ? 'output' : 'input'}`} alt="" loading="lazy" />
              {x.status === 'running' && <span className="render-badge mono">◌ {seconds(x.created_at)} mp</span>}
              {x.status === 'error' && <span className="render-badge bad mono">hiba</span>}
            </button>
          ))}
        </div>
      )}
      {open && (
        <Viewer
          item={list.find((x) => x.id === open.id) ?? open}
          onClose={() => setOpen(null)}
          onReuse={reuse}
          onDelete={remove}
        />
      )}
    </div>
  );
}
