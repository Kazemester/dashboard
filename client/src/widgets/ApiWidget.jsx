import React from 'react';
import { useWidgetData } from '../hooks.js';
import { locale } from '../i18n.js';

const get = (obj, path) =>
  !path ? obj : path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean).reduce((o, k) => (o == null ? undefined : o[k]), obj);

export default function ApiWidget({ widget, onConfigure }) {
  const cfg = widget.config;
  const refresh = Math.max(10, Number(cfg.refreshSec) || 300) * 1000;
  const { data, error, reload, loading } = useWidgetData(cfg.url ? `/widgets/${widget.id}/api` : null, { interval: cfg.url ? refresh : 0, deps: [cfg.url, cfg.path] });

  if (!cfg.url)
    return (
      <div className="setup">
        <p>Köss be bármilyen JSON API-t (kripto árfolyam, GitHub, Home Assistant, saját szolgáltatás…).</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ Beállítás
        </button>
      </div>
    );
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">KAPCSOLÓDÁS…</div>;

  const value = data.data;
  const display = cfg.display || 'auto';
  let body;
  if (display === 'list' || (display === 'auto' && Array.isArray(value))) {
    const arr = Array.isArray(value) ? value : [];
    body = (
      <ul className="news">
        {arr.slice(0, Number(cfg.limit) || 20).map((it, i) => {
          const text = typeof it === 'object' ? get(it, cfg.itemField) ?? JSON.stringify(it) : String(it);
          const link = typeof it === 'object' && cfg.linkField ? get(it, cfg.linkField) : null;
          return <li key={i}>{link ? <a href={link} target="_blank" rel="noreferrer">{String(text)}</a> : String(text)}</li>;
        })}
      </ul>
    );
  } else if (display === 'json' || (display === 'auto' && typeof value === 'object' && value !== null)) {
    body = <pre className="json">{JSON.stringify(value, null, 2)}</pre>;
  } else {
    const num = Number(value);
    const shown = !isNaN(num) && cfg.decimals !== '' && cfg.decimals !== undefined ? num.toFixed(Number(cfg.decimals)) : String(value);
    body = (
      <div className="api-value">
        <span className="big-num glow">
          {cfg.prefix}
          {shown}
          <span className="api-suffix">{cfg.suffix}</span>
        </span>
        {cfg.caption && <span className="muted">{cfg.caption}</span>}
      </div>
    );
  }

  return (
    <div className="api-widget">
      {body}
      <button className={`api-refresh muted sm ${loading ? 'spin' : ''}`} onClick={reload} title="Frissítés">
        ⟳ {new Date(data.fetchedAt).toLocaleTimeString(locale())}
      </button>
    </div>
  );
}
