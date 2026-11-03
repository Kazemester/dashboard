import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { t } from '../i18n.js';
import useBackdropClose from '../components/useBackdropClose.js';

/*
 * ⚡ Szabályok: notification rules written in plain Hungarian ("Szólj, ha az arany 3%-ot esik"). The server turns
 * the sentence into a rule (rules.js) and the push scheduler checks it every 5 minutes.
 */
const EXAMPLES = ['Szólj, ha az arany 3%-ot esik', 'Ha az Nvidia 180 dollár alá megy, szólj', 'Figyelmeztess, ha egy héten 40 ezernél többet költök', 'Szólj, ha levelet kapok a NAV-tól', 'Szólj, ha holnap esni fog', 'Szólj, ha este 8-ig nem pipáltam ki az edzést'];

export default function RulesPanel({ onClose }) {
  const backdrop = useBackdropClose(onClose);
  const [rules, setRules] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [checks, setChecks] = useState({});

  const load = () => api.get('/rules').then(setRules).catch((e) => setErr(e.message));
  useEffect(() => {
    load();
    const esc = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [onClose]);

  const add = async (e) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      await api.postJob('/rules', { text });
      setText('');
      await load();
    } catch (e2) {
      setErr(e2.message);
    }
    setBusy(false);
  };
  const toggle = async (r) => {
    await api.patch(`/rules/${r.id}`, { enabled: r.enabled === false });
    load();
  };
  const remove = async (r) => {
    if (!confirm(t('Törlöd ezt a szabályt? „{text}”', { text: r.text }))) return;
    await api.del(`/rules/${r.id}`);
    load();
  };
  const check = async (r) => {
    setChecks((c) => ({ ...c, [r.id]: '…' }));
    try {
      const { events } = await api.post(`/rules/${r.id}/check`);
      setChecks((c) => ({ ...c, [r.id]: events.length ? `${t('Most teljesül')}: ${events.map((x) => x.title).join('; ')}` : t('Most nem teljesül.') }));
    } catch (e) {
      setChecks((c) => ({ ...c, [r.id]: e.message }));
    }
  };

  return (
    <div className="overlay center" {...backdrop}>
      <div className="modal rules-modal" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div>
            <div className="eyebrow">{t('ÉRTESÍTÉSEK // SZABÁLYOK')}</div>
            <h2>⚡ {t('Szabályok')}</h2>
          </div>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <p className="help">{t('Írd le magyarul, mire figyeljen a dashboard. 5 percenként ellenőrzi, és push-értesítést küld (mindent csak egyszer). Az asszisztensnek is mondhatod: „Szólj, ha…”.')}</p>
        <form className="rules-add" onSubmit={add}>
          <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={t('pl. Szólj, ha az arany 3%-ot esik')} disabled={busy} />
          <button className="btn btn-primary" disabled={busy || !text.trim()}>
            {busy ? t('Értelmezem…') : t('Hozzáadás')}
          </button>
        </form>
        <div className="chips">
          {EXAMPLES.map((x) => (
            <button key={x} type="button" className="chip" onClick={() => setText(t(x))}>
              {t(x)}
            </button>
          ))}
        </div>
        {err && <div className="w-error sm">{err}</div>}
        {!rules ? (
          <div className="loading">{t('BETÖLTÉS…')}</div>
        ) : !rules.length ? (
          <p className="muted small">{t('Még nincs szabály.')}</p>
        ) : (
          <ul className="rules-list">
            {rules.map((r) => (
              <li key={r.id} className={r.enabled === false ? 'off' : ''}>
                <div className="rules-main">
                  <b>{r.summary}</b>
                  <span className="muted small">„{r.text}”</span>
                  {checks[r.id] && <span className="small">{checks[r.id]}</span>}
                </div>
                <div className="rules-actions">
                  <button type="button" className="btn btn-ghost sm" onClick={() => check(r)} title={t('Teljesül most?')}>
                    {t('Próba')}
                  </button>
                  <button type="button" className="btn btn-ghost sm" onClick={() => toggle(r)}>
                    {r.enabled === false ? t('Bekapcsolás') : t('Szünet')}
                  </button>
                  <button type="button" className="icon-btn danger" onClick={() => remove(r)} aria-label={t('Törlés')}>
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
