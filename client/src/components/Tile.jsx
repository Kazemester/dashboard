import React, { Component } from 'react';

class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (this.state.error) return <div className="w-error">Modul hiba: {this.state.error.message}</div>;
    return this.props.children;
  }
}

export default function Tile({ widget, def, editing, onConfigure, onRemove }) {
  const Body = def?.component;
  return (
    <section className={`tile accent-${def?.accent ?? 'cyan'}`}>
      <header className="tile-head">
        <h3 className="tile-title">{widget.title}</h3>
        <div className="tile-actions no-drag">
          {def?.fields?.length > 0 && (
            <button className="icon-btn" title="Beállítások" onClick={onConfigure}>
              ⚙
            </button>
          )}
          {editing && (
            <button className="icon-btn danger" title="Eltávolítás" onClick={onRemove}>
              ✕
            </button>
          )}
        </div>
      </header>
      <div className="tile-body no-drag">
        <ErrorBoundary>
          {Body ? <Body widget={widget} editing={editing} onConfigure={onConfigure} /> : <div className="w-error">Ismeretlen modul: {widget.type}</div>}
        </ErrorBoundary>
      </div>
    </section>
  );
}
