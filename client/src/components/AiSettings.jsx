import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import useBackdropClose from './useBackdropClose.js';
import { t } from '../i18n.js';

// OpenAI-compatible providers. Model names are suggestions — every provider lists its current models.
const PRESETS = [
  { id: 'xai', name: 'xAI Grok', baseUrl: 'https://api.x.ai/v1', model: 'grok-4', keyUrl: 'https://console.x.ai', needsKey: true },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', keyUrl: 'https://platform.openai.com/api-keys', needsKey: true },
  { id: 'openrouter', name: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'x-ai/grok-4', keyUrl: 'https://openrouter.ai/keys', needsKey: true },
  { id: 'ollama', name: 'Ollama (helyi, ingyenes)', baseUrl: 'http://host.docker.internal:11434/v1', model: 'llama3.1', needsKey: false },
  { id: 'ollama-server', name: 'Ollama (a szerveren)', baseUrl: 'http://ollama:11434/v1', model: 'qwen2.5:3b', needsKey: false },
  { id: 'custom', name: 'Egyéni', baseUrl: '', model: '', needsKey: true },
];
const presetOf = (url) => PRESETS.find((p) => p.baseUrl && url?.startsWith(p.baseUrl))?.id ?? 'custom';

export default function AiSettings({ onClose, onSaved }) {
  const backdrop = useBackdropClose(onClose);
  const [cur, setCur] = useState(null);
  const [preset, setPreset] = useState('xai');
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('');
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
      const body = { baseUrl, model, ...(key ? { apiKey: key } : {}) };
      const saved = await api.put('/settings/ai', body);
      setCur(saved);
      setKey('');
      setModel(saved.model);
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
                {preset === 'ollama-server' && t('A dashboarddal együtt Dockerben futó Ollama: docker compose --profile ollama up -d, majd docker compose exec ollama ollama pull qwen2.5:3b')}
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
      </div>
    </div>
  );
}
