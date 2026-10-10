import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData, isoDay } from '../hooks.js';

export default function Brief({ widget }) {
  const { data, error, loading, setData } = useWidgetData(`/widgets/${widget.id}/brief`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const autoRan = useRef(false);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await api.post(`/widgets/${widget.id}/brief/run`));
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  // Generate automatically once a day when the dashboard is opened.
  useEffect(() => {
    if (loading || error || autoRan.current || widget.config.autoDaily === false) return;
    if (!data || isoDay(data.generatedAt) !== isoDay(new Date())) {
      autoRan.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, data, error]);

  if (error) return <div className="w-error">{error}</div>;
  return (
    <div className="brief">
      <div className="row between">
        <div className="mail-bot">
          <span className={`bot-eye ${busy ? 'scanning' : ''}`} />
          <span className="eyebrow">
            {busy ? 'ADATOK ÖSSZEGYŰJTÉSE…' : data ? `${data.ai ? 'AI BRIEF' : 'ÖSSZEFOGLALÓ'} · ${new Date(data.generatedAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit' })}` : 'KÉSZENLÉTBEN'}
          </span>
        </div>
        <button className="btn btn-primary sm" onClick={run} disabled={busy}>
          {busy ? '◌' : '⟳ Frissítés'}
        </button>
      </div>
      {err && <div className="w-error sm">{err}</div>}
      {data?.text && <div className="brief-text">{data.text}</div>}
      {data && !data.ai && <div className="muted sm">Tipp: LLM_API_KEY megadásával a JARVIS személyre szabott, beszélt stílusú briefet ír.</div>}
    </div>
  );
}
