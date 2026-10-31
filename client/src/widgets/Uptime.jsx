import React from 'react';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';

export default function Uptime({ widget, onConfigure }) {
  const has = (widget.config.targets ?? []).some((t) => t?.url);
  const interval = Math.max(15, Number(widget.config.intervalSec) || 60) * 1000;
  const { data, error } = useWidgetData(has ? `/widgets/${widget.id}/uptime` : null, { interval: has ? interval : 0 });
  if (!has)
    return (
      <div className="setup">
        <p>{t('Figyeld, hogy elérhetők-e az oldalaid és szolgáltatásaid (NAS, router, saját app…).')}</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ {t('Beállítás')}
        </button>
      </div>
    );
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">PING…</div>;
  const down = data.filter((d) => !d.ok).length;
  return (
    <div className="uptime">
      <div className="eyebrow">{down ? <span className="danger-text">{t('{n} SZOLGÁLTATÁS NEM ELÉRHETŐ', { n: down })}</span> : t('MINDEN RENDSZER MŰKÖDIK')}</div>
      <ul>
        {data.map((d) => (
          <li key={d.url} className={d.ok ? '' : 'down'}>
            <i className={`dot ${d.ok ? 'ok' : 'bad'}`} />
            <span className="up-name" title={d.url}>
              {d.name}
            </span>
            <span className="up-hist">
              {d.history.slice(-20).map((h, i) => (
                <b key={i} className={h.ok ? 'ok' : 'bad'} />
              ))}
            </span>
            <span className="mono up-ms">{d.ok ? `${d.ms} ms` : d.status || d.error}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
