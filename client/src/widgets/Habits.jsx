import React, { useState } from 'react';
import { api } from '../api.js';
import { useWidgetData, isoDay } from '../hooks.js';

function streak(daysSet) {
  let n = 0;
  const d = new Date();
  if (!daysSet.has(isoDay(d))) d.setDate(d.getDate() - 1); // today not done yet doesn't break the streak
  while (daysSet.has(isoDay(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

const DOW = ['V', 'H', 'K', 'Sz', 'Cs', 'P', 'Sz'];

export default function Habits({ widget, editing }) {
  const span = Number(widget.config.days) || 7;
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/habits?days=${span}`);
  const [name, setName] = useState('');

  const days = Array.from({ length: span }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (span - 1 - i));
    return d;
  });

  const toggle = async (h, day) => {
    const { checked } = await api.post(`/habits/${h.id}/toggle`, { day });
    setData((hs) => hs.map((x) => (x.id === h.id ? { ...x, days: checked ? [...x.days, day] : x.days.filter((d) => d !== day) } : x)));
  };

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const palette = ['#00f0ff', '#ff2bd6', '#7cff6b', '#ffb020', '#8a7dff'];
    const h = await api.post(`/widgets/${widget.id}/habits`, { name, color: palette[(data?.length ?? 0) % palette.length] });
    setData((hs) => [...(hs ?? []), h]);
    setName('');
  };

  const remove = async (h) => {
    if (!confirm(`Törlöd a(z) "${h.name}" szokást és az előzményeit?`)) return;
    await api.del(`/habits/${h.id}`);
    setData((hs) => hs.filter((x) => x.id !== h.id));
  };

  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">SZINKRONIZÁLÁS…</div>;

  const today = isoDay(new Date());
  const doneToday = data.filter((h) => h.days.includes(today)).length;

  return (
    <div className="habits">
      <div className="habits-summary">
        <span>
          MAI TELJESÍTÉS <b>{doneToday}</b>/{data.length}
        </span>
        <div className="bar thin">
          <div className="bar-fill" style={{ width: `${data.length ? (doneToday / data.length) * 100 : 0}%` }} />
        </div>
      </div>
      <div className="habit-grid" style={{ '--cols': span }}>
        <div />
        {days.map((d) => (
          <div key={d} className={`habit-dow ${isoDay(d) === today ? 'today' : ''}`}>
            {span <= 14 ? DOW[d.getDay()] : d.getDate()}
          </div>
        ))}
        <div />
        {data.map((h) => {
          const set = new Set(h.days);
          return (
            <React.Fragment key={h.id}>
              <div className="habit-name" style={{ '--c': h.color }}>
                <span>{h.name}</span>
              </div>
              {days.map((d) => {
                const k = isoDay(d);
                return (
                  <button
                    key={k}
                    className={`habit-cell ${set.has(k) ? 'done' : ''} ${k === today ? 'today' : ''}`}
                    style={{ '--c': h.color }}
                    title={k}
                    onClick={() => toggle(h, k)}
                  />
                );
              })}
              <div className="habit-streak" title="Jelenlegi sorozat">
                {editing ? (
                  <button className="icon-btn danger" onClick={() => remove(h)}>
                    ✕
                  </button>
                ) : (
                  <>{streak(set)}d</>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <form onSubmit={add} className="row gap">
        <input className="input sm" placeholder="Új szokás…" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-ghost sm">+</button>
      </form>
    </div>
  );
}
