import React from 'react';
import { useWidgetData, isoDay } from '../hooks.js';
import { locale } from '../i18n.js';

export default function Calendar({ widget, onConfigure }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/calendar`, { interval: 5 * 60_000 });
  if (!(widget.config.sources ?? []).some((s) => s.url))
    return (
      <div className="setup">
        <p>Köss be egy Google / iCloud naptárat (iCal link).</p>
        <button className="btn btn-primary sm" onClick={onConfigure}>
          ⚙ Beállítás
        </button>
      </div>
    );
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">NAPTÁR LETÖLTÉSE…</div>;

  const today = isoDay(new Date());
  const tomorrow = isoDay(Date.now() + 86400_000);
  const groups = {};
  for (const e of data.events) (groups[isoDay(e.start)] ??= []).push(e);
  const label = (d) =>
    d === today ? 'MA' : d === tomorrow ? 'HOLNAP' : new Date(d).toLocaleDateString(locale(), { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();
  const time = (e) => (e.allDay ? 'egész nap' : new Date(e.start).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }));
  const now = Date.now();

  return (
    <div className="agenda">
      {data.errors.map((e) => (
        <div key={e} className="w-error sm">
          {e}
        </div>
      ))}
      {!data.events.length && <div className="muted center-text">Nincs esemény a következő napokban.</div>}
      {Object.entries(groups).map(([day, evs]) => (
        <div key={day} className="agenda-day">
          <div className={`agenda-date ${day === today ? 'today' : ''}`}>{label(day)}</div>
          {evs.map((e, i) => {
            const live = !e.allDay && new Date(e.start) <= now && new Date(e.end) >= now;
            return (
              <div key={i} className={`agenda-ev ${live ? 'live' : ''}`} style={{ '--c': e.color }}>
                <span className="agenda-time">{time(e)}</span>
                <span className="agenda-title">
                  {e.title}
                  {e.location && <span className="muted"> · {e.location}</span>}
                </span>
                <span className="agenda-src">{e.source}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
