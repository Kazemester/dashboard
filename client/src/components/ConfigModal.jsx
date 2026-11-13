import React, { useEffect, useState } from 'react';
import useBackdropClose from './useBackdropClose.js';
import { getLang, t } from '../i18n.js';

function Field({ field, value, onChange }) {
  const common = { className: 'input', value: value ?? '', placeholder: field.placeholder && t(field.placeholder) };
  switch (field.type) {
    case 'textarea':
      return <textarea {...common} rows={field.rows ?? 4} onChange={(e) => onChange(e.target.value)} />;
    case 'number':
      return (
        <input
          {...common}
          type="number"
          min={field.min}
          max={field.max}
          onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
        />
      );
    case 'select':
      return (
        <select {...common} onChange={(e) => onChange(e.target.value)}>
          {field.options.map(([v, label]) => (
            <option key={v} value={v}>
              {t(label)}
            </option>
          ))}
        </select>
      );
    case 'checkbox':
      return (
        <label className="check">
          <input type="checkbox" checked={value ?? field.default ?? false} onChange={(e) => onChange(e.target.checked)} />
          <span>{t(field.checkLabel ?? 'Bekapcsolva')}</span>
        </label>
      );
    case 'color':
      return <input type="color" className="color" value={value || '#67e8f9'} onChange={(e) => onChange(e.target.value)} />;
    case 'list': {
      const rows = Array.isArray(value) ? value : [];
      const set = (i, k, v) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
      return (
        <div className="list-field">
          {rows.map((row, i) => (
            <div key={i} className="list-row">
              {field.fields.map((sub) => (
                <div key={sub.key} className={`list-cell list-${sub.type ?? 'text'}`}>
                  <Field field={sub} value={row[sub.key]} onChange={(v) => set(i, sub.key, v)} />
                </div>
              ))}
              <button type="button" className="icon-btn danger" onClick={() => onChange(rows.filter((_, j) => j !== i))}>
                ✕
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost" onClick={() => onChange([...rows, { ...(field.newItem ?? {}) }])}>
            + {getLang() === 'en' && field.addLabel === 'Cím' ? 'Address' : t(field.addLabel ?? 'Új sor')}
          </button>
        </div>
      );
    }
    default:
      return <input {...common} type={['password', 'date'].includes(field.type) ? field.type : 'text'} onChange={(e) => onChange(e.target.value)} />;
  }
}

export default function ConfigModal({ widget, def, onSave, onClose }) {
  const backdrop = useBackdropClose(onClose);
  const [title, setTitle] = useState(widget.title);
  const [config, setConfig] = useState(() => ({ ...(def.defaultConfig ?? {}), ...widget.config }));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(widget, title, config);
    } catch (e2) {
      setErr(e2.message);
      setSaving(false);
    }
  };

  return (
    <div className="overlay center" {...backdrop}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">
              {def.icon} {t(def.name)} // {t('KONFIGURÁCIÓ')}
            </div>
            <h2>{title ? t(title) : t(def.name)}</h2>
          </div>
          <button type="button" className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="form">
          <label className="form-row">
            <span className="label">{t('Cím')}</span>
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          {def.fields.map((f) => (
            <div key={f.key} className="form-row">
              <span className="label">{t(f.label)}</span>
              <Field field={f} value={config[f.key]} onChange={(v) => setConfig((c) => ({ ...c, [f.key]: v }))} />
              {f.help && <span className="help">{t(f.help)}</span>}
            </div>
          ))}
        </div>

        {err && <div className="w-error">{err}</div>}
        <div className="modal-foot">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            {t('Mégse')}
          </button>
          <button className="btn btn-primary" disabled={saving}>
            {saving ? t('Mentés…') : t('Mentés')}
          </button>
        </div>
      </form>
    </div>
  );
}
