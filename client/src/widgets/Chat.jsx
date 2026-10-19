import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import AiError from '../components/AiHint.jsx';
import { REGISTRY } from './registry.js';
import { t, getLang } from '../i18n.js';

// What the bot needs to know about tile types (names, settings fields) — the registry lives in the frontend.
function catalog() {
  const out = {};
  for (const [type, d] of Object.entries(REGISTRY)) {
    if (d.hidden) continue;
    out[type] = {
      name: d.name,
      description: d.description,
      size: d.size,
      defaultConfig: d.defaultConfig,
      fields: (d.fields ?? []).map((f) => ({
        key: f.key,
        label: f.label,
        type: f.type ?? 'text',
        ...(f.options ? { options: f.options.map(([v]) => v) } : {}),
        ...(f.fields ? { fields: f.fields.map((x) => ({ key: x.key, type: x.type ?? 'text' })) } : {}),
      })),
    };
  }
  return out;
}

// Tell the app to reload tiles / layout the bot changed.
const announce = (meta) => {
  if (meta?.changed?.length || meta?.layoutChanged) window.dispatchEvent(new CustomEvent('nexus:dashboard-changed', { detail: meta }));
};

function Meta({ meta, onConfirm }) {
  if (!meta) return null;
  return (
    <div className="msg-meta">
      {meta.readOnly && <span className="chip chip-static">{t('csak olvasás: ez a modell nem tud eszközöket használni')}</span>}
      {meta.actions?.map((a, i) => (
        <span key={i} className="chip chip-static">
          ✓ {a}
        </span>
      ))}
      {meta.created?.map((c) => (
        <button key={c.id} className="btn btn-ghost sm" onClick={() => window.dispatchEvent(new CustomEvent('nexus:reveal', { detail: { id: c.id } }))} title={t('Odaugrik a csempéhez')}>
          ↗ {t('Megmutat')}: {c.title}
        </button>
      ))}
      {meta.pending?.map((p) =>
        p.done ? (
          <span key={p.id} className="chip chip-static">
            ✓ {t('Törölve')}: {p.title}
          </span>
        ) : (
          <button key={p.id} className="btn btn-ghost sm danger" onClick={() => onConfirm(p)}>
            {p.replacedBy ? t('Régi csempe törlése') : t('Törlés jóváhagyása')}: {p.title}
          </button>
        ),
      )}
    </div>
  );
}

export default function Chat({ widget }) {
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/chat`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    // scroll the log itself: scrollIntoView would also scroll every ancestor, including the canvas
    const log = endRef.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
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
      const reply = await api.post(`/widgets/${widget.id}/chat`, { content, lang: getLang(), catalog: widget.config.access === 'off' ? undefined : catalog() });
      setData((m) => [...m, reply]);
      announce(reply.meta);
    } catch (e2) {
      setErr(e2.message);
      setData((m) => m.filter((x) => x.id !== tmpId));
      setText(content);
    } finally {
      setBusy(false);
    }
  };

  // A removal the bot proposed: only happens when the user presses the button.
  const confirmRemove = async (msg, p) => {
    if (!confirm(t('Biztosan törlöd: "{title}"? A modul adatai is törlődnek.', { title: p.title }))) return;
    await api.del(`/widgets/${p.id}`);
    setData((m) => m.map((x) => (x.id === msg.id ? { ...x, meta: { ...x.meta, pending: x.meta.pending.map((y) => (y.id === p.id ? { ...y, done: true } : y)) } } : x)));
    announce({ layoutChanged: true, changed: [] });
  };

  const clear = async () => {
    if (!confirm(t('Törlöd a beszélgetést?'))) return;
    await api.del(`/widgets/${widget.id}/chat`);
    setData([]);
  };

  if (error) return <div className="w-error">{error}</div>;
  return (
    <div className="chat">
      <div className="chat-log">
        {!data?.length && (
          <div className="muted center-text">
            {widget.config.access === 'off'
              ? t('Csatorna nyitva. Kérdezz bármit.')
              : t('Kérdezz a dashboardról, vagy kérd meg, hogy állítson be valamit. Pl. „Mi a mai teendőm?”, „Vegyél fel egy teendőt: számla befizetése péntekig”, „Tegyél ki egy budapesti időjárás csempét”, „Legyen amber a téma”.')}
          </div>
        )}
        {data?.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <span className="msg-who">{m.role === 'user' ? t('TE') : 'AI'}</span>
            <div className="msg-body">
              {m.content}
              <Meta meta={m.meta} onConfirm={(p) => confirmRemove(m, p)} />
            </div>
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
      <AiError error={err} />
      <form onSubmit={send} className="row gap">
        <input className="input sm grow" placeholder={t('Üzenet…')} value={text} onChange={(e) => setText(e.target.value)} />
        <button className="btn btn-primary sm" disabled={busy}>
          ➤
        </button>
        {data?.length > 0 && (
          <button type="button" className="btn btn-ghost sm" onClick={clear} title={t('Beszélgetés törlése')}>
            ⌫
          </button>
        )}
      </form>
    </div>
  );
}
