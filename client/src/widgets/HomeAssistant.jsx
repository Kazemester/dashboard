import React, { useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';

const TOGGLE = ['light', 'switch', 'fan', 'input_boolean', 'automation', 'cover', 'media_player', 'script', 'scene', 'button'];
const ICON = { light: '◐', switch: '⏻', fan: '✲', input_boolean: '◉', automation: '⟳', cover: '▤', media_player: '▶', script: '›_', scene: '✦', button: '●', sensor: '∿', binary_sensor: '◌', climate: '°', lock: '⊡' };

export default function HomeAssistant({ widget, onConfigure }) {
  const has = String(widget.config.entities || '').trim();
  const { data, error, setData } = useWidgetData(has ? `/widgets/${widget.id}/ha` : null, { interval: has ? 15_000 : 0 });
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  if (!has)
    return (
      <div className="setup">
        <p>{t('Home Assistant vezérlő, mint a Control Center: lámpák, kapcsolók, jelenetek, szenzorok.')}</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ {t('Beállítás')}
        </button>
      </div>
    );
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('OTTHON…')}</div>;

  const toggle = async (e) => {
    setBusy(e.entity_id);
    setErr(null);
    try {
      const s = await api.post(`/widgets/${widget.id}/ha/toggle`, { entity_id: e.entity_id });
      setData((xs) => xs.map((x) => (x.entity_id === s.entity_id ? s : x)));
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(null);
    }
  };
  const controls = data.filter((e) => TOGGLE.includes(e.domain));
  const sensors = data.filter((e) => !TOGGLE.includes(e.domain));

  return (
    <div className="ha">
      {err && <div className="w-error sm">{err}</div>}
      <div className="ha-grid">
        {controls.map((e) => (
          <button key={e.entity_id} className={`ha-btn ${e.state === 'on' || e.state === 'open' || e.state === 'playing' ? 'on' : ''} ${busy === e.entity_id ? 'busy' : ''}`} onClick={() => toggle(e)} disabled={e.state === 'unavailable'} title={e.error || e.entity_id}>
            <span className="ha-icon">{ICON[e.domain] ?? '•'}</span>
            <span className="ha-name">{e.name}</span>
            <span className="ha-state">{['script', 'scene', 'button'].includes(e.domain) ? t('futtat') : e.state}</span>
          </button>
        ))}
      </div>
      {sensors.length > 0 && (
        <ul className="ha-sensors">
          {sensors.map((e) => (
            <li key={e.entity_id} title={e.error || e.entity_id}>
              <span>
                <span className="muted">{ICON[e.domain] ?? '•'}</span> {e.name}
              </span>
              <span className="mono">
                {e.state}
                {e.unit && ` ${e.unit}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
