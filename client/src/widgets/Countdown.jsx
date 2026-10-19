import React from 'react';
import { useNow } from '../hooks.js';
import { locale } from '../i18n.js';

export default function Countdown({ widget, onConfigure }) {
  const now = useNow(60_000);
  const events = (widget.config.events ?? []).filter((e) => e?.date && e?.name);
  if (!events.length)
    return (
      <div className="setup">
        <p>Adj hozzá eseményeket: születésnap, nyaralás, határidő…</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ Beállítás
        </button>
      </div>
    );

  const today = new Date(now.toDateString());
  const next = (e) => {
    let d = new Date(`${e.date}T00:00:00`);
    // yearly events (birthdays, anniversaries) roll over to the next occurrence
    if (e.yearly) {
      d.setFullYear(today.getFullYear());
      if (d < today) d.setFullYear(today.getFullYear() + 1);
    }
    return d;
  };
  const list = events
    .map((e) => {
      const d = next(e);
      return { ...e, at: d, days: Math.round((d - today) / 86400_000) };
    })
    .filter((e) => e.days >= 0 || widget.config.showPast)
    .sort((a, b) => a.days - b.days);
  const [first, ...rest] = list;
  if (!first) return <div className="muted center-text">Minden esemény elmúlt.</div>;

  return (
    <div className="countdown">
      <div className="cd-main">
        <span className="big-num">{first.days === 0 ? 'MA' : first.days}</span>
        {first.days !== 0 && <span className="cd-unit">nap</span>}
        <div className="cd-name">{first.name}</div>
        <div className="eyebrow">{first.at.toLocaleDateString(locale(), { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>
      </div>
      {rest.length > 0 && (
        <ul className="cd-list">
          {rest.map((e, i) => (
            <li key={i}>
              <span>{e.name}</span>
              <span className="mono">{e.days < 0 ? `${-e.days} napja` : `${e.days} nap`}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
