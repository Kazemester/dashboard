import React, { useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';

const PALETTE = ['#00f0ff', '#ff2bd6', '#7cff6b', '#ffb020', '#8a7dff', '#ff5470'];

function Sparkline({ history, color }) {
  if (history.length < 2) return null;
  const vals = history.map((h) => h.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${20 - ((v - min) / (max - min || 1)) * 18 - 1}`).join(' ');
  return (
    <svg className="spark" viewBox="0 0 100 20" preserveAspectRatio="none">
      <polyline points={pts} style={{ stroke: color }} />
    </svg>
  );
}

function ValueEditor({ item, onSave, onCancel }) {
  const [v, setV] = useState(item.value);
  const [t, setT] = useState(item.target);
  return (
    <form
      className="row gap"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({ value: Number(v), target: Number(t) });
      }}
    >
      <input className="input sm" type="number" step="any" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
      <span className="muted">/</span>
      <input className="input sm" type="number" step="any" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn btn-primary sm">OK</button>
      <button type="button" className="btn btn-ghost sm" onClick={onCancel}>
        ✕
      </button>
    </form>
  );
}

export default function Progress({ widget, editing }) {
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/progress`);
  const [editId, setEditId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ label: '', target: 100, unit: '' });
  const mode = widget.config.mode || 'bars';
  const step = Number(widget.config.step) || 1;

  const update = async (item, patch) => {
    const updated = await api.patch(`/progress/${item.id}`, patch);
    setData((items) =>
      items.map((x) =>
        x.id === item.id
          ? { ...x, ...updated, history: patch.value !== undefined ? [...x.history, { value: updated.value, at: new Date().toISOString() }] : x.history }
          : x,
      ),
    );
    setEditId(null);
  };

  const add = async (e) => {
    e.preventDefault();
    if (!form.label.trim()) return;
    const item = await api.post(`/widgets/${widget.id}/progress`, {
      ...form,
      target: Number(form.target) || 100,
      color: PALETTE[(data?.length ?? 0) % PALETTE.length],
    });
    setData((items) => [...items, item]);
    setForm({ label: '', target: 100, unit: '' });
    setAdding(false);
  };

  const remove = async (item) => {
    if (!confirm(t('Törlöd: "{label}"?', { label: item.label }))) return;
    await api.del(`/progress/${item.id}`);
    setData((items) => items.filter((x) => x.id !== item.id));
  };

  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">{t('SZINKRONIZÁLÁS…')}</div>;

  const pctOf = (i) => Math.max(0, Math.min(100, (i.value / (i.target || 1)) * 100));
  const overall = data.length ? data.reduce((s, i) => s + pctOf(i), 0) / data.length : 0;

  return (
    <div className="progress">
      {data.length > 0 && (
        <div className="progress-overall">
          <span className="eyebrow">{t('ÖSSZESÍTETT')}</span>
          <span className="big-num">{overall.toFixed(0)}%</span>
        </div>
      )}

      {mode === 'columns' ? (
        <div className="columns">
          {data.map((i) => (
            <div key={i.id} className="col" title={`${i.label}: ${i.value}/${i.target} ${i.unit}`} onClick={() => setEditId(i.id)}>
              <div className="col-track">
                <div className="col-fill" style={{ height: `${pctOf(i)}%`, '--c': i.color }}>
                  <span className="col-pct">{pctOf(i).toFixed(0)}%</span>
                </div>
              </div>
              <span className="col-label">{i.label}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className={`p-list ${mode === 'columns' ? 'compact' : ''}`}>
        {data.map((i) =>
          editId === i.id ? (
            <div key={i.id} className="p-item">
              <span className="p-label">{i.label}</span>
              <ValueEditor item={i} onSave={(p) => update(i, p)} onCancel={() => setEditId(null)} />
            </div>
          ) : mode === 'columns' ? null : (
            <div key={i.id} className="p-item">
              <div className="p-top">
                <span className="p-label">{i.label}</span>
                <span className="p-val" onClick={() => setEditId(i.id)} title={t('Kattints a szerkesztéshez')}>
                  {i.value}
                  <span className="muted">
                    /{i.target} {i.unit}
                  </span>
                </span>
              </div>
              <div className="p-row">
                <button className="icon-btn sm" onClick={() => update(i, { value: i.value - step })}>
                  −
                </button>
                <div className="bar">
                  <div className="bar-fill" style={{ width: `${pctOf(i)}%`, '--c': i.color }} />
                  <Sparkline history={i.history} color={i.color} />
                </div>
                <button className="icon-btn sm" onClick={() => update(i, { value: i.value + step })}>
                  +
                </button>
                {editing ? (
                  <button className="icon-btn danger sm" onClick={() => remove(i)}>
                    ✕
                  </button>
                ) : (
                  <span className="p-pct">{pctOf(i).toFixed(0)}%</span>
                )}
              </div>
            </div>
          ),
        )}
      </div>

      {adding ? (
        <form onSubmit={add} className="row gap wrap">
          <input className="input sm grow" placeholder={t('Cél neve')} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} autoFocus />
          <input className="input sm w-num" type="number" placeholder={t('Cél')} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
          <input className="input sm w-unit" placeholder={t('egység')} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
          <button className="btn btn-primary sm">+</button>
          <button type="button" className="btn btn-ghost sm" onClick={() => setAdding(false)}>
            ✕
          </button>
        </form>
      ) : (
        <button className="btn btn-ghost sm" onClick={() => setAdding(true)}>
          {t('+ Új sáv')}
        </button>
      )}
    </div>
  );
}
