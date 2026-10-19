import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData, isoDay } from '../hooks.js';
import { locale } from '../i18n.js';

const pad = (n) => String(n).padStart(2, '0');
const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
const shiftMonth = (key, delta) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
};

export default function Habits({ widget, editing }) {
  const thisMonth = monthKey(new Date());
  const [month, setMonth] = useState(thisMonth);
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/habits?month=${month}`);
  const [name, setName] = useState('');
  const scrollRef = useRef(null);
  const loadedMonth = data?.month;

  // On narrow tiles the month scrolls horizontally: bring today into view.
  useEffect(() => {
    const el = scrollRef.current;
    const t = el?.querySelector('.habit-dow.today');
    if (el && t && el.scrollWidth > el.clientWidth) el.scrollLeft = t.offsetLeft - el.clientWidth / 2;
  }, [loadedMonth]);

  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(y, m, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => `${month}-${pad(i + 1)}`);
  const today = isoDay(new Date());
  const isCurrent = month === thisMonth;
  const isFuture = month > thisMonth;
  // Days that can already be ticked in this month (everything up to today).
  const elapsed = isFuture ? 0 : isCurrent ? new Date().getDate() : daysInMonth;
  const title = new Date(y, m - 1, 1).toLocaleDateString(locale(), { year: 'numeric', month: 'long' });

  const setHabits = (fn) => setData((d) => ({ ...d, habits: fn(d.habits) }));

  const toggle = async (h, day) => {
    const { checked } = await api.post(`/habits/${h.id}/toggle`, { day });
    setHabits((hs) =>
      hs.map((x) => (x.id === h.id ? { ...x, days: checked ? [...x.days, day] : x.days.filter((d) => d !== day) } : x)),
    );
  };

  const add = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const h = await api.post(`/widgets/${widget.id}/habits`, { name, month });
    setHabits((hs) => [...hs, h]);
    setName('');
  };

  const remove = async (h) => {
    const msg =
      h.startMonth === month
        ? `Törlöd a(z) "${h.name}" sort? Az összes előzménye is törlődik.`
        : `Eltávolítod a(z) "${h.name}" sort ettől a hónaptól kezdve? A korábbi hónapok megmaradnak.`;
    if (!confirm(msg)) return;
    await api.del(`/habits/${h.id}?month=${month}`);
    setHabits((hs) => hs.filter((x) => x.id !== h.id));
  };

  const nav = (
    <div className="habit-nav">
      <button className="icon-btn" onClick={() => setMonth((k) => shiftMonth(k, -1))} title="Előző hónap">
        ‹
      </button>
      <span className="habit-month">{title}</span>
      <button className="icon-btn" onClick={() => setMonth((k) => shiftMonth(k, 1))} title="Következő hónap">
        ›
      </button>
      {!isCurrent && (
        <button className="btn btn-ghost sm" onClick={() => setMonth(thisMonth)}>
          Ma
        </button>
      )}
    </div>
  );

  if (error) return <div className="w-error">{error}</div>;
  if (!data || data.month !== month)
    return (
      <div className="habits">
        {nav}
        <div className="loading">SZINKRONIZÁLÁS…</div>
      </div>
    );

  const habits = data.habits;
  const totalDone = habits.reduce((s, h) => s + h.days.length, 0);
  const possible = habits.length * elapsed;
  const doneToday = habits.filter((h) => h.days.includes(today)).length;

  return (
    <div className="habits">
      <div className="habits-top">
        {nav}
        <div className="habits-summary">
          {isCurrent && (
            <span>
              MA <b>{doneToday}</b>/{habits.length}
            </span>
          )}
          <span>
            HÓNAP <b>{possible ? Math.round((totalDone / possible) * 100) : 0}%</b>
          </span>
        </div>
      </div>

      <div className="habit-scroll" ref={scrollRef}>
        <div className="habit-grid" style={{ '--cols': daysInMonth }}>
          <div />
          {days.map((d, i) => {
            const dow = new Date(y, m - 1, i + 1).getDay();
            return (
              <div key={d} className={`habit-dow ${d === today ? 'today' : ''} ${dow === 0 || dow === 6 ? 'weekend' : ''}`}>
                {i + 1}
              </div>
            );
          })}
          <div />
          {habits.map((h) => {
            const set = new Set(h.days);
            return (
              <React.Fragment key={h.id}>
                <div className="habit-name" title={isCurrent && h.streak ? `Sorozat: ${h.streak} nap` : h.name}>
                  <span>{h.name}</span>
                </div>
                {days.map((d) => (
                  <button
                    key={d}
                    className={`habit-cell ${set.has(d) ? 'done' : ''} ${d === today ? 'today' : ''}`}
                    disabled={d > today}
                    title={d}
                    onClick={() => toggle(h, d)}
                  />
                ))}
                <div className="habit-streak">
                  {editing ? (
                    <button className="icon-btn danger sm" onClick={() => remove(h)} title="Sor eltávolítása">
                      ✕
                    </button>
                  ) : (
                    <span title="Teljesített napok ebben a hónapban">
                      {h.days.length}
                      <span className="muted">/{elapsed || daysInMonth}</span>
                    </span>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
        {!habits.length && <div className="muted center-text sm">Ebben a hónapban még nincs sor. Adj hozzá egyet lent.</div>}
      </div>

      <form onSubmit={add} className="row gap">
        <input className="input sm" placeholder={`Új sor (${title})…`} value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-ghost sm">+</button>
      </form>
    </div>
  );
}
