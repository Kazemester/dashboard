import React from 'react';
import { useWidgetData } from '../hooks.js';

function ago(date) {
  if (!date) return '';
  const m = Math.round((Date.now() - new Date(date)) / 60000);
  if (m < 60) return `${m}p`;
  if (m < 1440) return `${Math.round(m / 60)}ó`;
  return `${Math.round(m / 1440)}n`;
}

export default function News({ widget }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/news`, { interval: 10 * 60_000 });
  if (error) return <div className="w-error">{error}</div>;
  if (!data) return <div className="loading">HÍRCSATORNÁK…</div>;
  return (
    <ul className="news">
      {data.items.map((it, i) => (
        <li key={i}>
          <a href={it.link} target="_blank" rel="noreferrer">
            {it.title}
          </a>
          <span className="news-meta">
            {it.source} · {ago(it.date)}
          </span>
        </li>
      ))}
    </ul>
  );
}
