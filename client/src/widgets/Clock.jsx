import React from 'react';
import { useNow } from '../hooks.js';

export default function Clock({ widget }) {
  const now = useNow(1000);
  const zones = String(widget.config.zones || '')
    .split(/[\n,]/)
    .map((z) => z.trim())
    .filter(Boolean);
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const s = now.getSeconds();
  return (
    <div className="clockw">
      <svg viewBox="0 0 100 100" className="analog">
        <circle cx="50" cy="50" r="46" className="ring-bg" />
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={i} x1="50" y1="7" x2="50" y2="12" className="ring-tick major" transform={`rotate(${i * 30} 50 50)`} />
        ))}
        <line x1="50" y1="50" x2="50" y2="26" className="hand h" transform={`rotate(${h * 30 + m / 2} 50 50)`} />
        <line x1="50" y1="50" x2="50" y2="16" className="hand m" transform={`rotate(${m * 6} 50 50)`} />
        <line x1="50" y1="56" x2="50" y2="12" className="hand s" transform={`rotate(${s * 6} 50 50)`} />
        <circle cx="50" cy="50" r="2.5" className="hand-dot" />
      </svg>
      {zones.length > 0 && (
        <div className="zones">
          {zones.map((z) => {
            let t;
            try {
              t = now.toLocaleTimeString('hu-HU', { timeZone: z, hour: '2-digit', minute: '2-digit' });
            } catch {
              t = '??';
            }
            return (
              <div key={z} className="zone">
                <span className="eyebrow">{z.split('/').pop().replace('_', ' ')}</span>
                <span className="zone-time">{t}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
