import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getLang, t } from '../i18n.js';
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported, testPush } from '../push.js';

/** Bottom of the bell panel: turn phone notifications (Web Push) on / off, send a test. */
export default function PushToggle() {
  const [state, setState] = useState('checking'); // checking | off | on | busy | ios-install | unsupported | denied
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    (async () => {
      if (!pushSupported()) return setState(isIOS() && !isStandalone() ? 'ios-install' : 'unsupported');
      if (Notification.permission === 'denied') return setState('denied');
      const sub = await currentSubscription().catch(() => null);
      if (!sub) return setState('off');
      // the server may have dropped it (expired): register again quietly
      const { subscribed } = await api.post('/push/status', { endpoint: sub.endpoint }).catch(() => ({ subscribed: true }));
      if (!subscribed) await api.post('/push/subscribe', { subscription: sub.toJSON(), lang: getLang() }).catch(() => {});
      setState('on');
    })();
  }, []);

  const turnOn = async () => {
    setMsg(null);
    setState('busy');
    try {
      await enablePush();
      setState('on');
      setMsg(t('Bekapcsolva. Küldök egy próbát…'));
      await testPush().catch(() => {});
    } catch (e) {
      if (e.denied) setState('denied');
      else {
        setState('off');
        setMsg(t('Nem sikerült bekapcsolni: {msg}', { msg: e.message }));
      }
    }
  };
  const turnOff = async () => {
    setState('busy');
    await disablePush();
    setMsg(null);
    setState('off');
  };
  const test = async () => {
    setMsg(null);
    try {
      await testPush();
      setMsg(t('Elküldve — pár másodpercen belül meg kell jelennie.'));
    } catch (e) {
      setMsg(e.message);
    }
  };

  if (state === 'checking') return null;
  return (
    <div className="push-box">
      {state === 'ios-install' && <p className="muted small">{t('Értesítések a telefonra: Safariban Megosztás → „Főképernyőhöz adás”, majd a kezdőképernyőn lévő NEXUS ikonról nyisd meg, és itt kapcsold be.')}</p>}
      {state === 'unsupported' && <p className="muted small">{t('Ez a böngésző nem tud értesítést fogadni.')}</p>}
      {state === 'denied' && <p className="muted small">{t('Az értesítések tiltva vannak. iPhone-on: Beállítások → Értesítések → NEXUS → Értesítések engedélyezése.')}</p>}
      {(state === 'off' || state === 'busy') && (
        <button className="btn btn-primary sm push-on" onClick={turnOn} disabled={state === 'busy'}>
          📲 {state === 'busy' ? t('Bekapcsolás…') : t('Értesítések a telefonra')}
        </button>
      )}
      {state === 'on' && (
        <div className="push-row">
          <span className="small">📲 {t('Értesítések bekapcsolva')}</span>
          <button className="btn btn-ghost sm" onClick={test}>
            {t('Próba')}
          </button>
          <button className="btn btn-ghost sm" onClick={turnOff}>
            {t('Kikapcsolás')}
          </button>
        </div>
      )}
      {msg && <p className="muted small">{msg}</p>}
      <button type="button" className="link-btn sc-open" onClick={() => window.dispatchEvent(new CustomEvent('nexus:shortcuts'))}>
        📱 {t('iPhone Parancsok: Siri, Egészség, megosztás')}
      </button>
    </div>
  );
}
