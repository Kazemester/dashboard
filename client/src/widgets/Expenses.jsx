import React, { useState } from 'react';
import { useItems, isoDay, fmtNum } from '../hooks.js';

const pad = (n) => String(n).padStart(2, '0');

export default function Expenses({ widget, editing }) {
  const cfg = widget.config;
  const cats = String(cfg.categories || 'Étel, Lakás, Közlekedés, Szórakozás, Egyéb').split(',').map((c) => c.trim()).filter(Boolean);
  const cur = cfg.currency || 'Ft';
  const budget = Number(cfg.budget) || 0;
  const now = new Date();
  const [ym, setYm] = useState([now.getFullYear(), now.getMonth() + 1]);
  const [y, m] = ym;
  const month = `${y}-${pad(m)}`;
  const daysIn = new Date(y, m, 0).getDate();
  const { items, error, add, remove } = useItems(widget.id, `kind=expense&from=${month}-01&to=${month}-${pad(daysIn)}`);
  const [form, setForm] = useState({ amount: '', cat: cats[0], note: '' });
  const [showList, setShowList] = useState(false);

  if (error) return <div className="w-error">{error}</div>;
  const list = [...(items ?? [])].sort((a, b) => b.day.localeCompare(a.day) || b.id - a.id);
  const total = list.reduce((s, i) => s + i.value, 0);
  const byCat = {};
  for (const i of list) byCat[i.data.cat || 'Egyéb'] = (byCat[i.data.cat || 'Egyéb'] ?? 0) + i.value;
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const isCur = month === `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const elapsed = isCur ? now.getDate() : daysIn;
  const projected = isCur && elapsed ? (total / elapsed) * daysIn : null;
  const shift = (d) => {
    const x = new Date(y, m - 1 + d, 1);
    setYm([x.getFullYear(), x.getMonth() + 1]);
  };

  const submit = async (e) => {
    e.preventDefault();
    const n = Number(String(form.amount).replace(/\s/g, '').replace(',', '.'));
    if (!n) return;
    const day = isCur ? isoDay(now) : `${month}-01`;
    await add({ kind: 'expense', day, value: n, data: { cat: form.cat, note: form.note.trim() } });
    setForm({ ...form, amount: '', note: '' });
  };

  return (
    <div className="expenses">
      <div className="habit-nav between-full">
        <button className="icon-btn" onClick={() => shift(-1)}>
          ‹
        </button>
        <span className="habit-month">{new Date(y, m - 1, 1).toLocaleDateString('hu-HU', { year: 'numeric', month: 'long' })}</span>
        <button className="icon-btn" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="exp-total">
        <span className="big-num">{fmtNum(total)}</span>
        <span className="muted"> {cur}</span>
        {budget > 0 && <span className="eyebrow exp-budget">/ {fmtNum(budget)} KERET</span>}
      </div>
      {budget > 0 && (
        <div className={`bar ${total > budget ? 'over' : ''}`}>
          <div className="bar-fill" style={{ width: `${Math.min(100, (total / budget) * 100)}%` }} />
        </div>
      )}
      {projected != null && total > 0 && (
        <div className="eyebrow">
          VÁRHATÓ HÓ VÉGÉN ≈ {fmtNum(projected)} {cur}
          {budget ? (projected > budget ? ' · KERET FELETT' : ' · KERETEN BELÜL') : ''}
        </div>
      )}
      <div className="exp-cats">
        {catRows.map(([c, v]) => (
          <div key={c} className="exp-cat">
            <span>{c}</span>
            <div className="bar">
              <div className="bar-fill" style={{ width: `${(v / (catRows[0][1] || 1)) * 100}%` }} />
            </div>
            <span className="mono">{fmtNum(v)}</span>
          </div>
        ))}
      </div>
      {list.length > 0 && (
        <button className="btn btn-ghost sm" onClick={() => setShowList((x) => !x)}>
          {showList ? 'Tételek elrejtése' : `${list.length} tétel`}
        </button>
      )}
      {showList && (
        <ul className="exp-list">
          {list.map((i) => (
            <li key={i.id}>
              <span className="muted mono">{i.day.slice(5).replace('-', '.')}</span>
              <span className="grow">
                {i.data.cat}
                {i.data.note && <span className="muted"> · {i.data.note}</span>}
              </span>
              <span className="mono">{fmtNum(i.value)}</span>
              <button className="icon-btn danger sm" onClick={() => remove(i.id)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="row gap wrap" onSubmit={submit}>
        <input className="input sm w-num" inputMode="decimal" placeholder={`Összeg`} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        <select className="input sm w-cat" value={form.cat} onChange={(e) => setForm({ ...form, cat: e.target.value })}>
          {cats.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <input className="input sm grow" placeholder="Megjegyzés" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        <button className="btn btn-ghost sm">+</button>
      </form>
    </div>
  );
}
