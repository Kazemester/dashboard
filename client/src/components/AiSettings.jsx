import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import useBackdropClose from './useBackdropClose.js';
import { t } from '../i18n.js';

// OpenAI-compatible providers. Model names are suggestions — every provider lists its current models.
const PRESETS = [
  { id: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4', keyUrl: 'https://console.x.ai', needsKey: true },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', needsKey: true },
  { id: 'gemini', name: 'Google Gemini', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', keyUrl: 'https://aistudio.google.com/apikey', needsKey: true, free: true },
  { id: 'anthropic', name: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com/v1', model: 'claude-haiku-5-5', keyUrl: 'https://console.anthropic.com/settings/keys', needsKey: true },
  { id: 'groq', name: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', keyUrl: 'https://console.groq.com/keys', needsKey: true, free: true },
  { id: 'mistral', name: 'Mistral', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest', keyUrl: 'https://console.mistral.ai/api-keys', needsKey: true },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat', keyUrl: 'https://platform.deepseek.com/api_keys', needsKey: true },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'x-ai/grok-4', keyUrl: 'https://openrouter.ai/keys', needsKey: true },
  { id: 'ollama', name: 'Ollama (helyi, ingyenes)', baseUrl: 'http://host.docker.internal:11434/v1', model: 'llama3.1', needsKey: false },
  { id: 'ollama-server', name: 'Ollama (a szerveren)', baseUrl: 'http://ollama:11434/v1', model: 'qwen2.5:3b', needsKey: false },
  { id: 'custom', name: 'Egyéni', baseUrl: '', model: '', needsKey: true },
];
const presetOf = (url) => PRESETS.find((p) => p.baseUrl && url?.startsWith(p.baseUrl))?.id ?? 'custom';
const CLOUD = PRESETS.filter((p) => p.needsKey);

/*
 * The external / strong model: an API-key provider used for commands (the assistant changing the dashboard) and
 * background work (rules, quick capture, morning brief, weekly review, mail summary); questions stay on the main
 * model. Consumer subscriptions (ChatGPT Plus, Claude Pro, X Premium…) give no API access, so a key is needed.
 */
function StrongModel({ cur, onSaved }) {
  const [preset, setPreset] = useState(presetOf(cur.baseUrl) === 'custom' && !cur.baseUrl ? 'gemini' : presetOf(cur.baseUrl));
  const first = PRESETS.find((x) => x.id === 'gemini');
  const [baseUrl, setBaseUrl] = useState(cur.baseUrl || first.baseUrl);
  const [model, setModel] = useState(cur.model || (cur.baseUrl ? '' : first.model));
  const [key, setKey] = useState('');
  const [route, setRoute] = useState(cur.route ?? { command: true, background: true });
  const [models, setModels] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const p = PRESETS.find((x) => x.id === preset);
  useEffect(() => {
    if (cur.configured) api.get('/settings/ai/models?which=strong').then(setModels).catch(() => {});
  }, [cur.configured]);
  const pick = (id) => {
    const x = PRESETS.find((y) => y.id === id);
    setPreset(id);
    if (x.baseUrl) setBaseUrl(x.baseUrl);
    if (x.model) setModel(x.model);
    setModels(null);
  };
  const save = async (test, patch = {}) => {
    setBusy(true);
    setMsg(null);
    try {
      const saved = await api.put('/settings/ai', { strong: { baseUrl, model, route, ...(key ? { apiKey: key } : {}), ...patch } });
      setKey('');
      onSaved(saved);
      if (saved.strong.configured) api.get('/settings/ai/models?which=strong').then(setModels).catch(() => {});
      if (test) {
        const res = await api.post('/settings/ai/test?which=strong');
        setMsg({ ok: true, text: t('Működik ✓ ({ms} ms) — válasz: „{answer}”', { ms: res.ms, answer: res.answer }) });
      } else setMsg({ ok: true, text: t('Mentve.') });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    }
    setBusy(false);
  };
  const off = () => save(false, { baseUrl: '', model: '', apiKey: null, route: { command: false, background: false } });
  return (
    <section className="ai-strong">
      <div className="ai-strong-head">
        <b>{t('Külső / erős modell')}</b> <span className="muted small">{t('(nem kötelező)')}</span>
      </div>
      <p className="help">{t('Egy felhős modell API-kulccsal a nehezebb munkára, a kérdések maradhatnak a fenti (pl. helyi) modellen. Az előfizetések (ChatGPT Plus, Claude Pro, X Premium) nem adnak API-hozzáférést, ide API-kulcs kell — a Gemini és a Groq kulcsa ingyenes kerettel is jár.')}</p>
      <div className="chips">
        {CLOUD.map((x) => (
          <button key={x.id} type="button" className={`chip ${preset === x.id ? 'chip-on' : ''}`} onClick={() => pick(x.id)}>
            {t(x.name)}
            {x.free ? ' ★' : ''}
          </button>
        ))}
      </div>
      <label className="form-row">
        <span className="label">{t('API cím')}</span>
        <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" />
      </label>
      <label className="form-row">
        <span className="label">{t('API kulcs')}</span>
        <input className="input" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} placeholder={cur.hasKey ? t('elmentve ({hint}) — írd be az újat a cseréhez', { hint: cur.keyHint }) : t('a szolgáltató API-kulcsa')} />
        {p?.keyUrl && (
          <span className="help">
            {t('Kulcs létrehozása:')}{' '}
            <a href={p.keyUrl} target="_blank" rel="noreferrer" className="accent-text">
              {p.keyUrl.replace('https://', '')} ↗
            </a>
            {p.free ? ` · ${t('ingyenes kerettel')}` : ''}
          </span>
        )}
      </label>
      <label className="form-row">
        <span className="label">{t('Modell')}</span>
        <input className="input" list="ai-strong-models" value={model} onChange={(e) => setModel(e.target.value)} />
        <datalist id="ai-strong-models">{(models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
        {models?.length > 0 && (
          <div className="chips ai-models">
            {models.slice(0, 18).map((m) => (
              <button key={m} type="button" className={`chip ${m === model ? 'chip-on' : ''}`} onClick={() => setModel(m)}>
                {m}
              </button>
            ))}
          </div>
        )}
      </label>
      <div className="form-row">
        <span className="label">{t('Mire használja')}</span>
        <label className="ai-check">
          <input type="checkbox" checked={route.command} onChange={(e) => setRoute({ ...route, command: e.target.checked })} /> {t('Parancsok: az asszisztens módosítja a dashboardot')}
        </label>
        <label className="ai-check">
          <input type="checkbox" checked={route.background} onChange={(e) => setRoute({ ...route, background: e.target.checked })} /> {t('Háttérmunka: szabályok, gyors rögzítés, reggeli és heti összefoglaló, levelek')}
        </label>
        <span className="help">{t('A kérdések mindig a fenti modellhez mennek. Ami ide megy, az a szolgáltatóhoz kerül (pl. levelek tartalma).')}</span>
      </div>
      {msg && <div className={msg.ok ? 'ai-msg ok' : 'w-error'}>{msg.text}</div>}
      <div className="row gap">
        {cur.baseUrl && (
          <button type="button" className="btn btn-ghost sm" onClick={off} disabled={busy}>
            {t('Kikapcsolás')}
          </button>
        )}
        <button type="button" className="btn btn-primary sm" onClick={() => save(true)} disabled={busy}>
          {busy ? t('Mentés…') : t('Külső modell mentése és kipróbálása')}
        </button>
      </div>
    </section>
  );
}

export default function AiSettings({ onClose, onSaved }) {
  const backdrop = useBackdropClose(onClose);
  const [cur, setCur] = useState(null);
  const [preset, setPreset] = useState('xai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
  const [visionModel, setVisionModel] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(null);
  const [msg, setMsg] = useState(null);
  const [models, setModels] = useState(null); // ids offered by the saved provider
  const [modelsErr, setModelsErr] = useState(null);

  const loadModels = async () => {
    setModelsErr(null);
    try {
      setModels(await api.get('/settings/ai/models'));
    } catch (e) {
      setModels(null);
      setModelsErr(e.message);
    }
  };

  useEffect(() => {
    api.get('/settings/ai').then((c) => {
      setCur(c);
      setPreset(presetOf(c.baseUrl));
      setBaseUrl(c.baseUrl);
      setModel(c.model);
      setVisionModel(c.visionModel || '');
      if (c.configured) loadModels();
    });
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const pick = (id) => {
    const p = PRESETS.find((x) => x.id === id);
    setPreset(id);
    if (p.baseUrl) setBaseUrl(p.baseUrl);
    if (p.model) setModel(p.model);
  };

  const save = async (andTest) => {
    setBusy(andTest ? 'test' : 'save');
    setMsg(null);
    try {
      const body = { baseUrl, model, visionModel, ...(key ? { apiKey: key } : {}) };
      const saved = await api.put('/settings/ai', body);
      setCur(saved);
      setKey('');
      setModel(saved.model);
      setVisionModel(saved.visionModel || '');
      onSaved?.(saved);
      if (saved.configured) loadModels();
      if (andTest) {
        const res = await api.post('/settings/ai/test');
        setMsg({ ok: true, text: t('Működik ✓ ({ms} ms) — válasz: „{answer}”', { ms: res.ms, answer: res.answer }) });
      } else setMsg({ ok: true, text: t('Mentve.') });
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async () => {
    const saved = await api.put('/settings/ai', { apiKey: null });
    setCur(saved);
    onSaved?.(saved);
    setMsg({ ok: true, text: t('A kulcs törölve.') });
  };

  const p = PRESETS.find((x) => x.id === preset);
  return (
    <div className="overlay center" {...backdrop}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{t('AI // BEÁLLÍTÁSOK')}</div>
            <h2>{t('AI szolgáltató')}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="help" style={{ margin: 0 }}>
          {t('Ezt használja:')} <b>{t('AI Chat')}</b>, <b>{t('Mail bot')}</b> {t('és')} <b>{t('JARVIS napi brief')}</b>. {t('A kulcs csak a saját szervereden, az adatbázisban tárolódik, és a böngésző soha nem kapja vissza.')}
        </p>
        {!cur ? (
          <div className="loading">{t('BETÖLTÉS…')}</div>
        ) : (
          <div className="form">
            <div className="form-row">
              <span className="label">{t('Szolgáltató')}</span>
              <div className="chips">
                {PRESETS.map((x) => (
                  <button key={x.id} className={`chip ${preset === x.id ? 'chip-on' : ''}`} onClick={() => pick(x.id)}>
                    {t(x.name)}
                  </button>
                ))}
              </div>
            </div>
            <label className="form-row">
              <span className="label">{t('API cím')}</span>
              <input className="input" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://…/v1" />
            </label>
            <label className="form-row">
              <span className="label">{t('API kulcs')}</span>
              <input
                className="input"
                type="password"
                autoComplete="off"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder={cur.hasKey ? t('elmentve ({hint}) — írd be az újat a cseréhez', { hint: cur.keyHint }) : p?.needsKey === false ? t('ehhez nem kell kulcs') : t('pl. xai-…')}
              />
              <span className="help">
                {cur.keySource === 'env' && t('Jelenleg a .env-ben megadott kulcs (LLM_API_KEY) van használatban; az itt megadott felülírja. ')}
                {p?.keyUrl && (
                  <>
                    {t('Kulcs létrehozása:')}{' '}
                    <a href={p.keyUrl} target="_blank" rel="noreferrer" className="accent-text">
                      {p.keyUrl.replace('https://', '')} ↗
                    </a>
                  </>
                )}
                {preset === 'ollama' && t('Telepítsd az Ollamát a gépedre, majd: ollama pull llama3.1 — a levelek így nem hagyják el a gépet.')}
                {preset === 'ollama-server' && t('A dashboarddal együtt Dockerben futó Ollama: docker compose --profile ollama up -d, majd docker compose exec ollama ollama pull qwen2.5:7b (4 magon / 16+ GB RAM-mal; 2 magon a qwen2.5:3b gyorsabb)')}
              </span>
            </label>
            <label className="form-row">
              <span className="label">{t('Modell')}</span>
              <input className="input" list="ai-models" value={model} onChange={(e) => setModel(e.target.value)} placeholder={t('pl. grok-4')} />
              <datalist id="ai-models">{(models ?? []).map((m) => <option key={m} value={m} />)}</datalist>
              {models?.length > 0 ? (
                <div className="chips ai-models">
                  {models.slice(0, 24).map((m) => (
                    <button key={m} type="button" className={`chip ${m === model ? 'chip-on' : ''}`} onClick={() => setModel(m)}>
                      {m}
                    </button>
                  ))}
                </div>
              ) : null}
              <span className="help">
                {models?.length === 0 && preset === 'ollama-server' && t('Még nincs letöltött modell: a szerveren futtasd: docker compose exec ollama ollama pull qwen2.5:3b ')}
                {models?.length === 0 && preset === 'ollama' && t('Még nincs letöltött modell: futtasd a terminálban: ollama pull qwen2.5:7b — csak a nevet írd ide (qwen2.5:7b). ')}
                {models?.length > 0 ? t('A szolgáltató által elérhető modellek — kattints egyre. ') : t('Mentés után itt megjelennek a szolgáltató elérhető modelljei. ')}
                {modelsErr && <span className="danger-text">{modelsErr} </span>}
                <button type="button" className="link-btn" onClick={loadModels}>
                  {t('Lista frissítése')}
                </button>
              </span>
            </label>
            <label className="form-row">
              <span className="label">{t('Képelemző modell')}</span>
              <input className="input" list="ai-models" value={visionModel} onChange={(e) => setVisionModel(e.target.value)} placeholder={t('üresen: nem kell (a képimport szövegfelismerővel megy)')} />
              <span className="help">
                {t('Nem kötelező: a Portfólió képernyőkép-importja szövegfelismerővel dolgozik, ez csak tartalék. Üresen a fenti modellt használom.')}{' '}
                {preset === 'ollama-server' && t('Ha mégis kell: docker compose exec ollama ollama pull qwen2.5vl:3b')}
                {preset === 'ollama' && t('A gépeden: ollama pull qwen2.5vl:3b')}
              </span>
            </label>
          </div>
        )}
        {msg && <div className={msg.ok ? 'ai-msg ok' : 'w-error'}>{msg.text}</div>}
        <div className="modal-foot">
          {cur?.keySource === 'db' && (
            <button className="btn btn-ghost" onClick={removeKey} style={{ marginRight: 'auto' }}>
              {t('Kulcs törlése')}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => save(false)} disabled={!!busy}>
            {busy === 'save' ? t('Mentés…') : t('Mentés')}
          </button>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={!!busy}>
            {busy === 'test' ? t('Kipróbálás…') : t('Mentés és kipróbálás')}
          </button>
        </div>
        {cur && <StrongModel cur={cur.strong ?? {}} onSaved={(saved) => (setCur(saved), onSaved?.(saved))} />}
      </div>
    </div>
  );
}
