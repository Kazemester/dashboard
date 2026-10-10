import React from 'react';

export default function Links({ widget, onConfigure }) {
  const links = (widget.config.links ?? []).filter((l) => l?.url);
  if (!links.length)
    return (
      <div className="setup">
        <p>Gyorslinkek a gyakran használt oldalaidhoz.</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ Beállítás
        </button>
      </div>
    );
  const icons = widget.config.icons !== false;
  return (
    <div className="links">
      {links.map((l, i) => {
        let host = '';
        try {
          host = new URL(l.url).hostname;
        } catch {
          /* invalid url */
        }
        const name = l.name || host.replace(/^www\./, '');
        return (
          <a key={i} className="link-tile" href={l.url} target="_blank" rel="noreferrer" title={l.url}>
            <span className="link-icon">
              {icons && host ? <img src={`https://www.google.com/s2/favicons?domain=${host}&sz=64`} alt="" loading="lazy" /> : name.slice(0, 1).toUpperCase()}
            </span>
            <span className="link-name">{name}</span>
          </a>
        );
      })}
    </div>
  );
}
