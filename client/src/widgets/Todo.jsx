import React, { useState } from 'react';
import { api } from '../api.js';
import { useItems, isoDay } from '../hooks.js';
import { locale } from '../i18n.js';

export default function Todo({ widget, editing }) {
  const { items, error, add, update, remove, setItems } = useItems(widget.id, 'kind=todo');
  const [text, setText] = useState('');
  const [due, setDue] = useState('');
  const hideDone = widget.config.hideDone === true;

  if (error) return <div className="w-error">{error}</div>;
  if (!items) return <div className="loading">SZINKRONIZÁLÁS…</div>;

  const today = isoDay(new Date());
  const open = items.filter((i) => !i.data.done);
  const done = items.filter((i) => i.data.done);
  const sorted = [
    ...open.sort((a, b) => (a.data.due || '9999') .localeCompare(b.data.due || '9999') || a.sort - b.sort),
    ...(hideDone ? [] : done),
  ];

  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await add({ kind: 'todo', data: { text: text.trim(), done: false, ...(due ? { due } : {}) } });
    setText('');
    setDue('');
  };

  const clearDone = async () => {
    await api.post(`/widgets/${widget.id}/items/delete`, { ids: done.map((d) => d.id) });
    setItems((xs) => xs.filter((x) => !x.data.done));
  };

  const dueLabel = (d) => {
    if (!d) return null;
    const diff = Math.round((new Date(d) - new Date(today)) / 86400_000);
    const txt = diff === 0 ? 'ma' : diff === 1 ? 'holnap' : diff === -1 ? 'tegnap' : diff < 0 ? `${-diff} napja` : new Date(d).toLocaleDateString(locale(), { month: 'short', day: 'numeric' });
    return <span className={`todo-due ${diff < 0 ? 'late' : diff === 0 ? 'now' : ''}`}>{txt}</span>;
  };

  return (
    <div className="todo-w">
      <div className="todo-head">
        <span className="eyebrow">
          <b className="accent-text">{open.length}</b> NYITOTT · {done.length} KÉSZ
        </span>
        {done.length > 0 && (
          <button className="btn btn-ghost sm" onClick={clearDone}>
            Készek törlése
          </button>
        )}
      </div>
      <ul className="todo-list">
        {sorted.map((i) => (
          <li key={i.id} className={i.data.done ? 'done' : ''}>
            <button className="todo-check" onClick={() => update(i.id, { data: { done: !i.data.done } })} aria-label="Kész" />
            <span className="todo-text">{i.data.text}</span>
            {!i.data.done && dueLabel(i.data.due)}
            {editing || i.data.done ? (
              <button className="icon-btn danger sm" onClick={() => remove(i.id)}>
                ✕
              </button>
            ) : null}
          </li>
        ))}
        {!sorted.length && <li className="muted center-text">Minden kész. Szép munka.</li>}
      </ul>
      <form className="row gap" onSubmit={submit}>
        <input className="input sm grow" placeholder="Új feladat…" value={text} onChange={(e) => setText(e.target.value)} />
        <input className="input sm w-date" type="date" value={due} onChange={(e) => setDue(e.target.value)} title="Határidő (opcionális)" />
        <button className="btn btn-ghost sm">+</button>
      </form>
    </div>
  );
}
