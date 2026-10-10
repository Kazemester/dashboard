import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';

export default function Chat({ widget }) {
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/chat`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [data, busy]);

  const send = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || busy) return;
    setText('');
    setErr(null);
    setBusy(true);
    const tmpId = `tmp-${Date.now()}`;
    setData((m) => [...(m ?? []), { id: tmpId, role: 'user', content }]);
    try {
      const reply = await api.post(`/widgets/${widget.id}/chat`, { content });
      setData((m) => [...m, reply]);
    } catch (e2) {
      setErr(e2.message);
      setData((m) => m.filter((x) => x.id !== tmpId));
      setText(content);
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!confirm('Törlöd a beszélgetést?')) return;
    await api.del(`/widgets/${widget.id}/chat`);
    setData([]);
  };

  if (error) return <div className="w-error">{error}</div>;
  return (
    <div className="chat">
      <div className="chat-log">
        {!data?.length && <div className="muted center-text">Csatorna nyitva. Kérdezz bármit.</div>}
        {data?.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <span className="msg-who">{m.role === 'user' ? 'TE' : 'AI'}</span>
            <div className="msg-body">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="msg msg-assistant">
            <span className="msg-who">AI</span>
            <div className="msg-body typing">
              <i />
              <i />
              <i />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {err && <div className="w-error sm">{err}</div>}
      <form onSubmit={send} className="row gap">
        <input className="input sm grow" placeholder="Üzenet…" value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary sm" disabled={busy}>
          ➤
        </button>
        {data?.length > 0 && (
          <button type="button" className="btn btn-ghost sm" onClick={clear} title="Beszélgetés törlése">
            ⌫
          </button>
        )}
      </form>
    </div>
  );
}
