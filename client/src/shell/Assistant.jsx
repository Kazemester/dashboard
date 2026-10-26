import React, { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import AiError from '../components/AiHint.jsx';
import { announce, catalog, Meta } from '../widgets/Chat.jsx';
import { getLang, t } from '../i18n.js';

/*
 * The AI command bar ("Kérdezz vagy adj utasítást…"): the dashboard agent without a chat tile.
 * Desktop: a field in the header with a drop-down answer panel. Phone: a bottom sheet opened from the dock,
 * with the field at the bottom where the thumb is.
 */
function useAssistant() {
  const [log, setLog] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const load = useCallback(() => {
    if (log) return;
    api
      .get('/assistant')
      .then((h) => setLog(h.slice(-10)))
      .catch(() => setLog([]));
  }, [log]);
  const send = async (content) => {
    setErr(null);
    setBusy(true);
    setLog((l) => [...(l ?? []), { role: 'user', content }]);
    try {
      const reply = await api.post('/assistant', { content, lang: getLang(), catalog: catalog() });
      setLog((l) => [...l, { role: 'assistant', content: reply.answer, meta: reply.meta }]);
      announce(reply.meta);
      return true;
    } catch (e) {
      setErr(e.message);
      setLog((l) => l.slice(0, -1));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const confirmRemove = async (idx, p) => {
    if (!confirm(t('Biztosan törlöd: "{title}"? A modul adatai is törlődnek.', { title: p.title }))) return;
    await api.del(`/widgets/${p.id}`);
    setLog((l) => l.map((m, i) => (i === idx ? { ...m, meta: { ...m.meta, pending: m.meta.pending.map((y) => (y.id === p.id ? { ...y, done: true } : y)) } } : m)));
    announce({ layoutChanged: true, changed: [] });
  };
  const clear = async () => {
    await api.del('/assistant');
    setLog([]);
  };
  return { log, busy, err, load, send, confirmRemove, clear };
}

function Log({ a, endRef }) {
  return (
    <div className="asst-log">
      {!a.log?.length && !a.busy && (
        <div className="muted small asst-empty">{t('Pl. „Mi a mai teendőm?”, „Vegyél fel egy teendőt: számla befizetése péntekig”, „Tedd ki az USD/HUF árfolyamot”, „Legyen sötét a téma”.')}</div>
      )}
      {a.log?.map((m, i) => (
        <div key={i} className={`asst-msg ${m.role}`}>
          <div className="asst-bubble">
            {m.content}
            <Meta meta={m.meta} onConfirm={(p) => a.confirmRemove(i, p)} />
          </div>
        </div>
      ))}
      {a.busy && (
        <div className="asst-msg assistant">
          <div className="asst-bubble typing">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}
      <AiError error={a.err} />
      <div ref={endRef} />
    </div>
  );
}

export default function Assistant({ mode, open, onClose }) {
  const a = useAssistant();
  const [text, setText] = useState('');
  const [focus, setFocus] = useState(false);
  const box = useRef(null);
  const endRef = useRef(null);
  const input = useRef(null);
  const shown = mode === 'sheet' ? open : focus;

  useEffect(() => {
    if (shown) a.load();
  }, [shown]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const log = endRef.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [a.log, a.busy, shown]);
  useEffect(() => {
    if (mode !== 'bar' || !focus) return undefined;
    const close = (e) => !box.current?.contains(e.target) && setFocus(false);
    const esc = (e) => e.key === 'Escape' && (setFocus(false), input.current?.blur());
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('keydown', esc);
    };
  }, [mode, focus]);
  useEffect(() => {
    if (mode !== 'sheet' || !open) return undefined;
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [mode, open, onClose]);

  const submit = async (e) => {
    e.preventDefault();
    const content = text.trim();
    if (!content || a.busy) return;
    setText('');
    if (!(await a.send(content))) setText(content);
  };

  const form = (
    <form className="asst-form" onSubmit={submit}>
      <i className="orb" aria-hidden />
      <input
        ref={input}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onFocus={() => setFocus(true)}
        placeholder={t('Kérdezz vagy adj utasítást…')}
        aria-label={t('AI asszisztens')}
        autoFocus={mode === 'sheet'}
        enterKeyHint="send"
      />
      {text.trim() && (
        <button className="asst-send" disabled={a.busy} aria-label={t('Küldés')}>
          ↑
        </button>
      )}
    </form>
  );

  if (mode === 'sheet') {
    if (!open) return null;
    return (
      <div className="overlay sheet-overlay" onClick={onClose}>
        <div className="sheet asst-sheet" onClick={(e) => e.stopPropagation()}>
          <div className="sheet-head">
            <span className="eyebrow">{t('AI asszisztens')}</span>
            {a.log?.length > 0 && (
              <button className="btn btn-ghost sm" onClick={a.clear}>
                {t('Törlés')}
              </button>
            )}
            <button className="icon-btn" onClick={onClose} aria-label={t('Bezárás')}>
              ✕
            </button>
          </div>
          <Log a={a} endRef={endRef} />
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className={`asst-bar ${focus ? 'open' : ''}`} ref={box}>
      {form}
      {focus && (
        <div className="asst-panel pop">
          <Log a={a} endRef={endRef} />
          {a.log?.length > 0 && (
            <div className="asst-foot">
              <button className="btn btn-ghost sm" onClick={a.clear}>
                {t('Beszélgetés törlése')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
