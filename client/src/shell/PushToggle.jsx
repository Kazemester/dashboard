import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { getLang, t } from '../i18n.js';
import { currentSubscription, disablePush, enablePush, isIOS, isStandalone, pushSupported, testPush } from '../push.js';

/** Bottom of the bell panel: turn phone notifications (Web Push) on / off, send a test. */
export default function PushToggle() {
  const [state, setState] = useState('checking'); // checking | off | on | busy | ios-install | unsupported | denied
  const [msg, setMsg] = useState(null);
  const [prefs, setPrefs] = useState(null); // { daily, hour }
  useEffect(() => {
    if (state === 'on' && !prefs) api.get('/push/prefs').then(setPrefs).catch(() => {});
  }, [state, prefs]);
  const savePrefs = async (patch) => {
    setPrefs((p) => ({ ...p, ...patch }));
    setPrefs(await api.put('/push/prefs', patch).catch(() => prefs));
  };

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
      {state === 'on' && prefs && (
        <label className="push-daily small">
          <input type="checkbox" checked={prefs.daily} onChange={(e) => savePrefs({ daily: e.target.checked })} />
          <span>{t('Reggeli összefoglaló')}</span>
          <select value={prefs.hour} onChange={(e) => savePrefs({ hour: Number(e.target.value) })} disabled={!prefs.daily} aria-label={t('Időpont')}>
            {[7, 8, 9, 10, 11, 12].map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
          <span className="muted">{t('— az ikonon lévő számot is frissíti')}</span>
        </label>
      )}
      {state === 'on' && prefs && prefs.daily && (
        <label className="push-daily small">
          <input type="checkbox" checked={prefs.ai !== false} onChange={(e) => savePrefs({ ai: e.target.checked })} />
          <span>{t('AI írja meg (időjárás, naptár, teendők, levelek)')}</span>
        </label>
      )}
      {state === 'on' && prefs && (
        <label className="push-daily small">
          <input type="checkbox" checked={prefs.weekly !== false} onChange={(e) => savePrefs({ weekly: e.target.checked })} />
          <span>{t('Heti áttekintés')}</span>
          <select value={prefs.weeklyDay ?? 0} onChange={(e) => savePrefs({ weeklyDay: Number(e.target.value) })} disabled={prefs.weekly === false} aria-label={t('Nap')}>
            {[t('vasárnap'), t('hétfő'), t('kedd'), t('szerda'), t('csütörtök'), t('péntek'), t('szombat')].map((d, i) => (
              <option key={i} value={i}>
                {d}
              </option>
            ))}
          </select>
          <select value={prefs.weeklyHour ?? 19} onChange={(e) => savePrefs({ weeklyHour: Number(e.target.value) })} disabled={prefs.weekly === false} aria-label={t('Időpont')}>
            {[8, 10, 12, 15, 17, 18, 19, 20, 21].map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </label>
      )}
      {msg && <p className="muted small">{msg}</p>}
      <button type="button" className="link-btn sc-open" onClick={() => window.dispatchEvent(new CustomEvent('nexus:rules'))}>
        ⚡ {t('Szabályok: „Szólj, ha…”')}
      </button>
      <button type="button" className="link-btn sc-open" onClick={() => window.dispatchEvent(new CustomEvent('nexus:shortcuts'))}>
        📱 {t('iPhone Parancsok: Siri, Egészség, megosztás')}
      </button>
    </div>
  );
}
