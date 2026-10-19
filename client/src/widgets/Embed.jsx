import React from 'react';
import { t } from '../i18n.js';

export default function Embed({ widget, onConfigure }) {
  const url = widget.config.url;
  if (!url)
    return (
      <div className="setup">
        <p>{t('Bármilyen beágyazható oldal: Grafana, Home Assistant, YouTube, Spotify, Google Sheets…')}</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ {t('Beállítás')}
        </button>
      </div>
    );
  return (
    <div className="embed">
      <iframe
        src={url}
        title={widget.title}
        loading="lazy"
        referrerPolicy="no-referrer"
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
      />
    </div>
  );
}
