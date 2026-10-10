import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { api } from './api.js';
import { REGISTRY } from './widgets/registry.js';
import Tile from './components/Tile.jsx';
import WidgetPicker from './components/WidgetPicker.jsx';
import ConfigModal from './components/ConfigModal.jsx';
import TopBar from './components/TopBar.jsx';

const Grid = WidthProvider(Responsive);
const COLS = { lg: 12, md: 10, sm: 6, xs: 2 };
const BREAKPOINTS = { lg: 1200, md: 960, sm: 640, xs: 0 };

// Place a new tile at the bottom of every breakpoint's layout.
function withNewItem(layouts, id, size) {
  const next = {};
  for (const bp of Object.keys(COLS)) {
    const cur = layouts[bp] ?? [];
    const bottom = cur.reduce((m, l) => Math.max(m, l.y + l.h), 0);
    const w = Math.min(size.w, COLS[bp]);
    next[bp] = [...cur, { i: id, x: 0, y: bottom, w, h: size.h, minW: Math.min(size.minW ?? 2, COLS[bp]), minH: size.minH ?? 2 }];
  }
  return next;
}

export default function App() {
  const [widgets, setWidgets] = useState([]);
  const [layouts, setLayouts] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [picker, setPicker] = useState(false);
  const [configuring, setConfiguring] = useState(null);
  const [error, setError] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ widgets, layouts }) => {
        setWidgets(widgets);
        setLayouts(layouts);
        if (!widgets.length) setPicker(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  const persistLayouts = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => api.put('/layouts', next).catch((e) => setError(e.message)), 600);
  }, []);

  const onLayoutChange = useCallback(
    (_current, all) => {
      if (!loaded) return;
      setLayouts(all);
      persistLayouts(all);
    },
    [loaded, persistLayouts],
  );

  const addWidget = async (def) => {
    try {
      const w = await api.post('/widgets', { type: def.type, title: def.name, config: def.defaultConfig ?? {} });
      const next = withNewItem(layouts, w.id, def.size);
      setWidgets((ws) => [...ws, w]);
      setLayouts(next);
      persistLayouts(next);
      setPicker(false);
      if (def.configureOnAdd) setConfiguring(w);
      setTimeout(() => document.getElementById(`tile-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } catch (e) {
      setError(e.message);
    }
  };

  const removeWidget = async (w) => {
    if (!confirm(`Biztosan törlöd: "${w.title}"? A modul adatai is törlődnek.`)) return;
    await api.del(`/widgets/${w.id}`);
    setWidgets((ws) => ws.filter((x) => x.id !== w.id));
    const next = Object.fromEntries(Object.entries(layouts).map(([bp, l]) => [bp, l.filter((x) => x.i !== w.id)]));
    setLayouts(next);
    persistLayouts(next);
  };

  const saveConfig = async (w, title, config) => {
    const updated = await api.patch(`/widgets/${w.id}`, { title, config });
    setWidgets((ws) => ws.map((x) => (x.id === w.id ? updated : x)));
    setConfiguring(null);
  };

  // Make sure every widget has a layout entry (e.g. after manual DB edits).
  const safeLayouts = useMemo(() => {
    let l = layouts;
    for (const w of widgets) {
      const def = REGISTRY[w.type];
      if (def && !(l.lg ?? []).some((x) => x.i === w.id)) l = withNewItem(l, w.id, def.size);
    }
    return l;
  }, [layouts, widgets]);

  return (
    <div className={`app ${editing ? 'is-editing' : ''}`}>
      <div className="bg-grid" />
      <div className="bg-glow" />
      <TopBar
        editing={editing}
        onToggleEdit={() => setEditing((e) => !e)}
        onAdd={() => setPicker(true)}
        count={widgets.length}
      />

      {error && (
        <div className="toast" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}

      <main className="deck">
        {loaded && !widgets.length && (
          <div className="empty">
            <div className="empty-ring" />
            <h2>A FEDÉLZET ÜRES</h2>
            <p>Adj hozzá modulokat a katalógusból.</p>
            <button className="btn btn-primary" onClick={() => setPicker(true)}>
              + Modul hozzáadása
            </button>
          </div>
        )}
        <Grid
          className="grid"
          layouts={safeLayouts}
          breakpoints={BREAKPOINTS}
          cols={COLS}
          rowHeight={44}
          margin={[14, 14]}
          isDraggable={editing}
          isResizable={editing}
          draggableHandle=".tile-head"
          draggableCancel=".no-drag"
          onLayoutChange={onLayoutChange}
          resizeHandles={['se']}
        >
          {widgets.map((w) => {
            const def = REGISTRY[w.type];
            return (
              <div key={w.id} id={`tile-${w.id}`}>
                <Tile
                  widget={w}
                  def={def}
                  editing={editing}
                  onConfigure={() => setConfiguring(w)}
                  onRemove={() => removeWidget(w)}
                />
              </div>
            );
          })}
        </Grid>
      </main>

      {picker && <WidgetPicker onPick={addWidget} onClose={() => setPicker(false)} />}
      {configuring && (
        <ConfigModal
          widget={configuring}
          def={REGISTRY[configuring.type]}
          onSave={saveConfig}
          onClose={() => setConfiguring(null)}
        />
      )}
    </div>
  );
}
