import { Router } from 'express';
import { getWidget, HttpError } from '../util.js';
import { resolveSecrets } from '../secrets.js';

// Home Assistant REST API: https://developers.home-assistant.io/docs/api/rest/
const r = Router();

function client(cfg) {
  const base = resolveSecrets(cfg.baseUrl || '{{secret:HA_URL}}').replace(/\/$/, '');
  const token = resolveSecrets(cfg.token || '{{secret:HA_TOKEN}}');
  return async (path, init = {}) => {
    const res = await fetch(`${base}/api${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new HttpError(502, `Home Assistant ${res.status}: ${(await res.text()).slice(0, 150)}`);
    return res.json();
  };
}

const entityIds = (cfg) =>
  String(cfg.entities || '')
    .split(/[\s,]+/)
    .filter((e) => /^[a-z_]+\.[\w]+$/.test(e));

const shape = (s) => ({
  entity_id: s.entity_id,
  state: s.state,
  name: s.attributes?.friendly_name || s.entity_id,
  unit: s.attributes?.unit_of_measurement || '',
  domain: s.entity_id.split('.')[0],
});

r.get('/widgets/:id/ha', async (req, res) => {
  const w = await getWidget(req.params.id, 'homeassistant');
  const api = client(w.config);
  const ids = entityIds(w.config);
  const states = await Promise.all(
    ids.map((id) => api(`/states/${id}`).then(shape).catch((err) => ({ entity_id: id, name: id, state: 'unavailable', error: err.message, domain: id.split('.')[0] }))),
  );
  res.json(states);
});

const SERVICE = { light: 'toggle', switch: 'toggle', fan: 'toggle', input_boolean: 'toggle', automation: 'toggle', cover: 'toggle', media_player: 'media_play_pause', script: 'turn_on', scene: 'turn_on', button: 'press' };

r.post('/widgets/:id/ha/toggle', async (req, res) => {
  const w = await getWidget(req.params.id, 'homeassistant');
  const id = req.body?.entity_id;
  if (!entityIds(w.config).includes(id)) throw new HttpError(400, 'Entity is not configured on this tile');
  const domain = id.split('.')[0];
  const service = SERVICE[domain];
  if (!service) throw new HttpError(400, `${domain} entities are read-only here`);
  const api = client(w.config);
  await api(`/services/${domain}/${service}`, { method: 'POST', body: JSON.stringify({ entity_id: id }) });
  await new Promise((r2) => setTimeout(r2, 400));
  res.json(shape(await api(`/states/${id}`)));
});

export default r;
