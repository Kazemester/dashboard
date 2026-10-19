import React from 'react';
import { useWidgetData, fmtNum } from '../hooks.js';
import { t } from '../i18n.js';

const ago = (iso) => {
  const h = Math.round((Date.now() - new Date(iso)) / 3600_000);
  return h < 24 ? t('{n} órája', { n: h }) : t('{n} napja', { n: Math.round(h / 24) });
};

export default function GitHub({ widget, onConfigure }) {
  const hasRepos = String(widget.config.repos || '').trim();
  const { data, error } = useWidgetData(hasRepos ? `/widgets/${widget.id}/github` : null, { interval: hasRepos ? 10 * 60_000 : 0 });
  if (!hasRepos)
    return (
      <div className="setup">
        <p>{t('Kövesd a repóidat: csillagok, nyitott issue-k és PR-ek.')}</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ {t('Beállítás')}
        </button>
      </div>
    );
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('REPÓK…')}</div>;
  return (
    <div className="gh">
      {data.map((r) =>
        r.error ? (
          <div key={r.repo} className="w-error sm">
            {r.repo}: {r.error}
          </div>
        ) : (
          <div key={r.repo} className="gh-repo">
            <div className="gh-head">
              <a href={r.url} target="_blank" rel="noreferrer" className="gh-name">
                {r.repo}
              </a>
              <span className="muted sm">push {ago(r.pushedAt)}</span>
            </div>
            <div className="gh-stats">
              <span>★ {fmtNum(r.stars)}</span>
              <span>⑂ {fmtNum(r.forks)}</span>
              <span>◎ {t('{n} nyitott', { n: fmtNum(r.openTotal) })}</span>
              {r.language && <span className="muted">{r.language}</span>}
            </div>
            {r.pulls.length > 0 && (
              <ul className="gh-pulls">
                {r.pulls.map((p) => (
                  <li key={p.number}>
                    <a href={p.url} target="_blank" rel="noreferrer">
                      <span className="muted mono">#{p.number}</span> {p.title}
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ),
      )}
    </div>
  );
}
