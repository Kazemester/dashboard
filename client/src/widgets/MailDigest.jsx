import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import AiError from '../components/AiHint.jsx';

const SUGGESTIONS = ['Mi a legfontosabb?', 'Van fizetendő számlám vagy határidőm?', 'Kinek kell válaszolnom?', 'Melyik levél reklám vagy spam?'];

const when = (d) => (d ? new Date(d).toLocaleString('hu-HU', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
const sender = (from) => (from || '').replace(/<[^>]*>/g, '').trim() || from;

function Summary({ r, onAsk }) {
  const empty = !r.headline && !r.important?.length && !r.todos?.length;
  return (
    <div className="mail-body">
      {r.aiError && <AiError error={r.aiError} />}
      {r.headline && <p className="mail-headline">{r.headline}</p>}
      {r.important?.length > 0 && (
        <>
          <div className="eyebrow accent">FONTOS</div>
          {r.important.map((m, i) => (
            <div key={i} className="mail-item">
              <div className="mail-subj">
                {m.n ? <span className="muted mono">#{m.n} </span> : null}
                {m.subject}
              </div>
              {m.from && <div className="muted sm">{sender(m.from)}</div>}
              {(m.why || m.action) && (
                <div className="sm">
                  {m.why} {m.action && <b>→ {m.action}</b>}
                </div>
              )}
            </div>
          ))}
        </>
      )}
      {r.todos?.length > 0 && (
        <>
          <div className="eyebrow accent">TEENDŐK</div>
          <ul className="todo">
            {r.todos.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </>
      )}
      {r.categories?.length > 0 && (
        <div className="chips">
          {r.categories.map((c, i) => (
            <span key={i} className="chip chip-static">
              {c.name} {c.count != null && <b>{c.count}</b>}
            </span>
          ))}
        </div>
      )}
      {empty && !r.aiError && r.mailCount > 0 && <div className="muted sm">Nincs összefoglaló. A Levelek fülön látod a leveleket, a Kérdezz fülön kérdezhetsz róluk.</div>}
      {r.mailCount > 0 && (
        <button className="btn btn-ghost sm" onClick={() => onAsk('Foglald össze röviden, mi történt a postafiókomban, és mi a teendőm.')}>
          Kérdezd meg a botot →
        </button>
      )}
    </div>
  );
}

function MailList({ mails, onAsk }) {
  const [open, setOpen] = useState(null);
  return (
    <ul className="mail-list">
      {mails.map((m, i) => (
        <li key={i} className={open === i ? 'open' : ''}>
          <button className="mail-row" onClick={() => setOpen(open === i ? null : i)}>
            <span className="muted mono">#{i + 1}</span>
            <span className="mail-row-main">
              <span className="mail-row-subj">{m.subject}</span>
              <span className="muted sm">{sender(m.from)}</span>
            </span>
            <span className="muted mono mail-when">{when(m.date)}</span>
          </button>
          {open === i && (
            <div className="mail-preview">
              <p>{m.text || <span className="muted">(nincs szöveges tartalom)</span>}</p>
              <div className="row gap">
                <button className="btn btn-ghost sm" onClick={() => onAsk(`Foglald össze a #${i + 1} levelet, és mondd meg, kell-e vele valamit tennem.`)}>
                  Összefoglaló
                </button>
                <button className="btn btn-ghost sm" onClick={() => onAsk(`Írj egy rövid, udvarias választ a #${i + 1} levélre.`)}>
                  Válasz piszkozat
                </button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function Ask({ widget, hasMails, pending, onPendingDone }) {
  const { data: thread, setData } = useWidgetData(`/widgets/${widget.id}/mail/thread`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const endRef = useRef(null);

  useEffect(() => {
    // scroll the log itself: scrollIntoView would also scroll every ancestor, including the canvas
    const log = endRef.current?.parentElement;
    if (log) log.scrollTop = log.scrollHeight;
  }, [thread, busy]);

  const ask = async (question) => {
    const q = question.trim();
    if (!q || busy) return;
    setText('');
    setErr(null);
    setBusy(true);
    const tmp = { id: `tmp-${Date.now()}`, role: 'user', content: q };
    setData((t) => [...(t ?? []), tmp]);
    try {
      const reply = await api.post(`/widgets/${widget.id}/mail/ask`, { question: q });
      setData((t) => [...t.filter((x) => x.id !== tmp.id), { ...tmp, id: `${tmp.id}-q` }, reply]);
    } catch (e) {
      setErr(e.message);
      setData((t) => t.filter((x) => x.id !== tmp.id));
      setText(q);
    } finally {
      setBusy(false);
    }
  };

  // a question handed over from the other tabs
  useEffect(() => {
    if (pending && thread) {
      ask(pending);
      onPendingDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, thread]);

  const clear = async () => {
    await api.del(`/widgets/${widget.id}/mail/thread`);
    setData([]);
  };

  return (
    <div className="chat mail-ask">
      <div className="chat-log">
        {!thread?.length && (
          <div className="mail-suggest">
            <div className="muted sm">{hasMails ? 'Kérdezz a letöltött leveleidről:' : 'Előbb nyomd meg a Futtatás gombot, hogy a bot letöltse a leveleket.'}</div>
            {hasMails && (
              <div className="chips">
                {SUGGESTIONS.map((s) => (
                  <button key={s} className="chip" onClick={() => ask(s)}>
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {thread?.map((m) => (
          <div key={m.id} className={`msg msg-${m.role}`}>
            <span className="msg-who">{m.role === 'user' ? 'TE' : 'BOT'}</span>
            <div className="msg-body">{m.content}</div>
          </div>
        ))}
        {busy && (
          <div className="msg msg-assistant" title="Helyi modellel a válasz eltarthat egy ideig">
            <span className="msg-who">BOT</span>
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
      <form
        className="row gap"
        onSubmit={(e) => {
          e.preventDefault();
          ask(text);
        }}
      >
        <input className="input sm grow" placeholder="pl. Mit írt a bankom? / Írj választ a 2. levélre" value={text} onChange={(e) => setText(e.target.value)} disabled={!hasMails} />
        <button className="btn btn-primary sm" disabled={busy || !hasMails}>
          ➤
        </button>
        {thread?.length > 0 && (
          <button type="button" className="btn btn-ghost sm" onClick={clear} title="Beszélgetés törlése">
            ⌫
          </button>
        )}
      </form>
    </div>
  );
}

export default function MailDigest({ widget }) {
  const { data, error, setData } = useWidgetData(`/widgets/${widget.id}/mail`, { interval: 60_000 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('summary');
  const [pending, setPending] = useState(null);

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
  const askFromTab = (question) => {
    setPending(question);
    setTab('ask');
  };

  const r = data?.result;
  const mails = r?.mails ?? [];
  return (
    <div className="mail">
      <div className="row gap between">
        <div className="mail-bot">
          <span className={`bot-eye ${busy ? 'scanning' : ''}`} />
          <span className="eyebrow">
            {busy ? 'POSTAFIÓK ELEMZÉSE…' : data ? `${r?.mailCount ?? 0} LEVÉL · ${when(data.created_at)}` : 'MÉG NEM FUTOTT'}
          </span>
        </div>
        <button className="btn btn-primary sm" onClick={run} disabled={busy}>
          {busy ? '◌' : '▶ Futtatás'}
        </button>
      </div>
      <AiError error={err || error} />
      {busy && <div className="muted sm">Levelek letöltése és elemzése… helyi modellel (Ollama) ez 1–2 percig is eltarthat.</div>}

      <div className="seg">
        {[
          ['summary', 'ÖSSZEFOGLALÓ'],
          ['mails', `LEVELEK${mails.length ? ` (${mails.length})` : ''}`],
          ['ask', 'KÉRDEZZ'],
        ].map(([k, label]) => (
          <button key={k} className={`seg-btn ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
            {label}
          </button>
        ))}
      </div>

      <div className="mail-tab">
        {tab === 'summary' &&
          (r ? <Summary r={r} onAsk={askFromTab} /> : <div className="muted sm">Nyomd meg a Futtatás gombot: a bot letölti az olvasatlan leveleket, és összefoglalja őket.</div>)}
        {tab === 'mails' && (mails.length ? <MailList mails={mails} onAsk={askFromTab} /> : <div className="muted sm">Nincs letöltött levél.</div>)}
        {tab === 'ask' && <Ask widget={widget} hasMails={mails.length > 0} pending={pending} onPendingDone={() => setPending(null)} />}
      </div>
    </div>
  );
}
