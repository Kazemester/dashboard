import React from 'react';

export default function Embed({ widget, onConfigure }) {
  const url = widget.config.url;
  if (!url)
    return (
      <div className="setup">
        <p>Bármilyen beágyazható oldal: Grafana, Home Assistant, YouTube, Spotify, Google Sheets…</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ Beállítás
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
