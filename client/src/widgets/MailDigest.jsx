import React, { useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';

export default function MailDigest({ widget }) {
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/mail`, { interval: 60_000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await api.post(`/widgets/${widget.id}/mail/run`));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const r = data?.result;
  return (
    <div className="mail">
      <div className="row gap between">
        <div className="mail-bot">
          <span className={`bot-eye ${busy ? 'scanning' : ''}`} />
          <span className="eyebrow">{busy ? 'POSTAFIÓK ELEMZÉSE…' : data ? `UTOLSÓ FUTÁS ${new Date(data.created_at).toLocaleString('hu-HU')}` : 'MÉG NEM FUTOTT'}</span>
        </div>
        <button className="btn btn-primary sm" onClick={run} disabled={busy}>
          {busy ? '◌' : '▶ Futtatás'}
        </button>
      </div>
      {(err || error) && <div className="w-error sm">{err || error}</div>}

      {r && (
        <div className="mail-body">
          <p className="mail-headline">
            {r.headline} <span className="muted">({r.mailCount} levél)</span>
          </p>

          {r.important?.length > 0 && (
            <>
              <div className="eyebrow accent">⚡ FONTOS</div>
              {r.important.map((m, i) => (
                <div key={i} className="mail-item">
                  <div className="mail-subj">{m.subject}</div>
                  <div className="muted sm">{m.from}</div>
                  <div className="sm">
                    {m.why} {m.action && <b>→ {m.action}</b>}
                  </div>
                </div>
              ))}
            </>
          )}

          {r.todos?.length > 0 && (
            <>
              <div className="eyebrow accent">☐ TEENDŐK</div>
              <ul className="todo">
                {r.todos.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </>
          )}

          {r.categories?.length > 0 && (
            <div className="chips">
              {r.categories.map((c) => (
                <span key={c.name} className="chip chip-static" title={(c.examples ?? []).join('\n')}>
                  {c.name} <b>{c.count}</b>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
