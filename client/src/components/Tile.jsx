import React, { Component, useCallback, useState } from 'react';
import { TileLiveContext } from '../hooks.js';
import { t } from '../i18n.js';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) return <div className="w-error">{t('Modul hiba:')} {this.state.error.message}</div>;
    return this.props.children;
  }
}

export default function Tile({ widget, def, editing, onConfigure, onUpdateConfig, onRemove }) {
  const Body = def?.component;
  // number of timed data loads running inside this tile (see useLive in hooks.js)
  const [liveCount, setLiveCount] = useState(0);
  const register = useCallback(() => {
    setLiveCount((n) => n + 1);
    return () => setLiveCount((n) => n - 1);
  }, []);
  return (
    <TileLiveContext.Provider value={register}>
      <section className={`tile accent-${def?.accent ?? 'cyan'} ${liveCount > 0 ? 'tile-live' : ''}`}>
        <header className="tile-head">
          <h3 className="tile-title">{t(widget.title)}</h3>
          <div className="tile-actions no-drag">
            {def?.fields?.length > 0 && (
              <button className="icon-btn" title={t('Beállítások')} onClick={onConfigure}>
                ⚙
              </button>
            )}
            {editing && (
              <button className="icon-btn danger" title={t('Eltávolítás')} onClick={onRemove}>
                ✕
              </button>
            )}
          </div>
        </header>
        <div className="tile-body no-drag">
          <ErrorBoundary>
            {Body ? <Body widget={widget} editing={editing} onConfigure={onConfigure} onUpdateConfig={onUpdateConfig} /> : <div className="w-error">{t('Ismeretlen modul:')} {widget.type}</div>}
          </ErrorBoundary>
        </div>
      </section>
    </TileLiveContext.Provider>
  );
}
