import React, { useEffect, useRef, useState } from 'react';
import { THEMES, resolveAppearance } from '../theme.js';

export default function ThemePicker({ appearance, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const eff = resolveAppearance(appearance);

  useEffect(() => {
    if (!open) return;
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="theme-picker" ref={ref}>
      <button className={`btn btn-ghost theme-btn ${open ? 'btn-active' : ''}`} onClick={() => setOpen((o) => !o)} title="Téma és színek">
        <span className="theme-dot" />
        Téma
      </button>
      {open && (
        <div className="theme-pop">
          <div className="eyebrow">TÉMA</div>
          <div className="theme-grid">
            {Object.entries(THEMES).map(([k, t]) => (
              <button
                key={k}
                className={`theme-opt ${appearance.theme === k ? 'on' : ''}`}
                onClick={() => onChange({ ...appearance, theme: k, bg: null, accent: null })}
                title={t.name}
              >
                <span className="theme-swatch" style={{ background: t.bg, borderColor: t.accent }}>
                  <i style={{ background: t.accent }} />
                </span>
                <span className="theme-name">{t.name}</span>
              </button>
            ))}
          </div>
          <div className="theme-colors">
            <label>
              <span className="eyebrow">HÁTTÉR</span>
              <span className="theme-color">
                <input type="color" value={eff.bg} onChange={(e) => onChange({ ...appearance, bg: e.target.value })} />
                <code>{eff.bg}</code>
              </span>
            </label>
            <label>
              <span className="eyebrow">KIEMELÉS</span>
              <span className="theme-color">
                <input type="color" value={eff.accent} onChange={(e) => onChange({ ...appearance, accent: e.target.value })} />
                <code>{eff.accent}</code>
              </span>
            </label>
          </div>
          {(appearance.bg || appearance.accent) && (
            <button className="btn btn-ghost sm" onClick={() => onChange({ ...appearance, bg: null, accent: null })}>
              A téma eredeti színei
            </button>
          )}
          <div className="muted sm">A beállítás az adatbázisba mentődik.</div>
        </div>
      )}
    </div>
  );
}
