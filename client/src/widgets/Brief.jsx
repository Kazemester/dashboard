import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData, isoDay } from '../hooks.js';
import AiError, { openAiSettings } from '../components/AiHint.jsx';
import { t, locale } from '../i18n.js';

export default function Brief({ widget }) {
  const { data, error, loading, setData } = useWidgetData(`/widgets/${widget.id}/brief`);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const autoRan = useRef(false);

  const run = async () => {
    setBusy(true);
    setErr(null);
    try {
      setData(await api.postJob(`/widgets/${widget.id}/brief/run`));
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
            {busy ? t('ADATOK ÖSSZEGYŰJTÉSE…') : data ? `${data.ai ? 'AI BRIEF' : t('ÖSSZEFOGLALÓ')} · ${new Date(data.generatedAt).toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' })}` : t('KÉSZENLÉTBEN')}
          </span>
        </div>
        <button className="btn btn-primary sm" onClick={run} disabled={busy}>
          {busy ? '◌' : t('⟳ Frissítés')}
        </button>
      </div>
      <AiError error={err} />
      {data?.text && <div className="brief-text">{data.text}</div>}
      {data && !data.ai && (
        <div className="muted sm">
          {t('Ez AI nélküli összefoglaló.')}{' '}
          <button className="link-btn" onClick={openAiSettings}>
            {t('Állíts be AI-t')}
          </button>{' '}
          {t('a személyre szabott, beszélt stílusú briefhez.')}
        </div>
      )}
    </div>
  );
}
