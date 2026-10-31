import React, { useEffect, useState } from 'react';
import { useLive } from '../hooks.js';
import { t } from '../i18n.js';

export default function ImageFrame({ widget, onConfigure }) {
  const urls = String(widget.config.urls || '')
    .split(/\s*\n\s*/)
    .filter(Boolean);
  const interval = Math.max(5, Number(widget.config.intervalSec) || 30) * 1000;
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  // runs for a slideshow (2+ images) and for a single image that is told to refresh
  const timed = urls.length >= 2 || (urls.length === 1 && Boolean(widget.config.refresh));
  useLive(timed);
  useEffect(() => {
    if (!timed) return;
    const t = setInterval(() => {
      setTick((x) => x + 1);
      if (urls.length > 1) setI((x) => (x + 1) % urls.length);
    }, interval);
    return () => clearInterval(t);
  }, [timed, urls.length, interval]);
  if (!urls.length)
    return (
      <div className="setup">
        <p>{t('Képek URL-ből (pl. saját fotók, webkamera kép, NASA kép).')}</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ {t('Beállítás')}
        </button>
      </div>
    );
  // Append a cache-buster for webcam-style images that change at the same URL.
  const bust = widget.config.refresh ? `${urls[i % urls.length].includes('?') ? '&' : '?'}t=${Math.floor(Date.now() / interval)}-${tick}` : '';
  return (
    <div className="frame" onClick={() => setI((x) => (x + 1) % urls.length)}>
      <img src={urls[i % urls.length] + bust} alt="" style={{ objectFit: widget.config.fit || 'cover' }} />
      {urls.length > 1 && (
        <div className="frame-dots">
          {urls.map((_, j) => (
            <i key={j} className={j === i % urls.length ? 'on' : ''} />
          ))}
        </div>
      )}
    </div>
  );
}
