import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { useWidgetData } from '../hooks.js';
import { t } from '../i18n.js';

export default function Notes({ widget }) {
  const { data, error } = useWidgetData(`/widgets/${widget.id}/state`);
  const [text, setText] = useState(null);
  const [status, setStatus] = useState('');
  const timer = useRef(null);

  useEffect(() => {
    if (data && text === null) setText(data.value?.text ?? '');
  }, [data, text]);

  const change = (v) => {
    setText(v);
    setStatus('…');
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        await api.put(`/widgets/${widget.id}/state`, { text: v });
        setStatus(t('MENTVE'));
      } catch (e) {
        setStatus(t('HIBA: {msg}', { msg: e.message }));
      }
    }, 700);
  };

  if (error) return <div className="w-error">{error}</div>;
  if (text === null) return <div className="loading">{t('BETÖLTÉS…')}</div>;
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="notes">
      <textarea className="notes-area" value={text} onChange={(e) => change(e.target.value)} placeholder={t('Írj ide bármit…')} spellCheck={false} />
      <div className="notes-foot">
        <span>{t('{n} SZÓ', { n: words })}</span>
        <span>{status}</span>
      </div>
    </div>
  );
}
