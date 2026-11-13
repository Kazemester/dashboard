import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { t } from '../i18n.js';
import { announce } from '../widgets/Chat.jsx';
import { useKeyboardInset } from './Assistant.jsx';

/*
 * ⚡ Quick capture: one sentence, and it goes where it belongs (capture.js on the server): to-do, shopping list,
 * expense, note, mood, habit. On an iPhone the keyboard's microphone dictates it.
 */
const EXAMPLES = ['tej, kenyér, tojás', '5000 Ft benzin', 'holnap 10-kor fogorvos', 'jó napom volt', 'ma lefutottam az 5 km-t', 'ötlet: hétvégén Balaton'];

export default function CaptureSheet({ onClose }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState([]); // recent results in this session
  const input = useRef(null);
  useKeyboardInset(true); // the sheet rides above the iPhone keyboard
  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const send = async (e) => {
    e?.preventDefault();
    const v = text.trim();
    if (!v) return;
    setBusy(true);
    try {
      const r = await api.postJob('/capture', { text: v });
      setLog((l) => [{ ok: true, text: r.message }, ...l].slice(0, 5));
      setText('');
      announce({ changed: [r.widgetId], layoutChanged: true });
    } catch (e2) {
      setLog((l) => [{ ok: false, text: e2.message }, ...l].slice(0, 5));
    }
    setBusy(false);
    input.current?.focus({ preventScroll: true });
  };

  return (
    <div className="overlay sheet-overlay" onClick={onClose}>
      <div className="sheet capture-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <span className="eyebrow">⚡ {t('Gyors rögzítés')}</span>
          <button className="icon-btn" onClick={onClose} aria-label={t('Bezárás')}>
            ✕
          </button>
        </div>
        <form className="capture-form" onSubmit={send}>
          <input ref={input} className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('Mit rögzítsek? (teendő, vásárlás, kiadás, jegyzet…)')} disabled={busy} enterKeyHint="send" />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? '…' : t('Rögzítés')}
          </button>
        </form>
        {!log.length && (
          <div className="chips">
            {EXAMPLES.map((x) => (
              <button key={x} type="button" className="chip" onClick={() => setText(t(x))}>
                {t(x)}
              </button>
            ))}
          </div>
        )}
        {log.map((x, i) => (
          <div key={i} className={x.ok ? 'ai-msg ok' : 'w-error sm'}>
            {x.ok ? '✓ ' : ''}
            {x.text}
          </div>
        ))}
        <p className="muted small capture-help">{t('Az AI dönti el, hova kerül: bevásárlólista, kiadás, teendő (dátummal), jegyzet, hangulat vagy szokás. Siriből és a megosztás menüből is működik (iPhone Parancsok).')}</p>
      </div>
    </div>
  );
}
