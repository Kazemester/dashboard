import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Responsive, WidthProvider } from 'react-grid-layout';
import { api } from './api.js';
import { REGISTRY } from './widgets/registry.js';
import Tile from './components/Tile.jsx';
import WidgetPicker from './components/WidgetPicker.jsx';
import ConfigModal from './components/ConfigModal.jsx';
import TopBar from './components/TopBar.jsx';
import AiSettings from './components/AiSettings.jsx';
import { applyAppearance, cachedAppearance } from './theme.js';
import Canvas, { findFreeSpot } from './components/Canvas.jsx';

const Grid = WidthProvider(Responsive);
const COLS = { lg: 12, md: 10, sm: 6, xs: 2 };
const BREAKPOINTS = { lg: 1200, md: 960, sm: 640, xs: 0 };

// Desktop uses the infinite canvas; phones keep the stacked responsive grid.
function useIsDesktop() {
  const q = '(min-width: 768px)';
  const [desk, setDesk] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setDesk(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  return desk;
}

// First canvas: take the old desktop layout, moved away from the world's top-left corner.
const ORIGIN = 24;
const canvasFromLayouts = (layouts) => (layouts.lg ?? []).map(({ i, x, y, w, h, minW, minH }) => ({ i, x: x + ORIGIN, y: y + ORIGIN, w, h, minW, minH }));

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
  const [appearance, setAppearance] = useState(cachedAppearance);
  const appearanceTimer = useRef(null);
  const [canvas, setCanvas] = useState([]);
  const canvasTimer = useRef(null);
  const canvasApi = useRef(null);
  const isDesktop = useIsDesktop();
  const [aiOpen, setAiOpen] = useState(false);
  const [aiVersion, setAiVersion] = useState(0); // bump to refresh AI status in the header
  const [undo, setUndo] = useState(null); // previous canvas after "Rendezés"
  const undoTimer = useRef(null);

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ widgets, layouts, appearance: saved, canvas: savedCanvas }) => {
        setWidgets(widgets);
        setLayouts(layouts);
        if (savedCanvas) setCanvas(savedCanvas);
        else {
          // one-time migration of the old grid layout onto the canvas
          const migrated = canvasFromLayouts(layouts);
          setCanvas(migrated);
          if (migrated.length) api.put('/settings/canvas', migrated).catch(() => {});
        }
        if (saved) setAppearance(saved);
        if (!widgets.length) setPicker(true);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  const changeAppearance = (next) => {
    setAppearance(next);
    clearTimeout(appearanceTimer.current);
    // colour inputs fire continuously while dragging — save once the user settles
    appearanceTimer.current = setTimeout(() => api.put('/settings/appearance', next).catch((e) => setError(e.message)), 500);
  };

  const persistLayouts = useCallback((next) => {
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => api.put('/layouts', next).catch((e) => setError(e.message)), 600);
  }, []);

  const persistCanvas = useCallback((next) => {
    clearTimeout(canvasTimer.current);
    canvasTimer.current = setTimeout(() => api.put('/settings/canvas', next).catch((e) => setError(e.message)), 400);
  }, []);

  const changeCanvas = useCallback(
    (next) => {
      setCanvas(next);
      persistCanvas(next);
    },
    [persistCanvas],
  );

  // Every widget needs a spot on the canvas (new widgets, or ones added on a phone).
  const safeCanvas = useMemo(() => {
    let items = canvas.filter((c) => widgets.some((w) => w.id === c.i));
    for (const w of widgets) {
      if (items.some((c) => c.i === w.id)) continue;
      const size = REGISTRY[w.type]?.size ?? { w: 4, h: 5 };
      const c = canvasApi.current?.centerCell() ?? { x: ORIGIN + 6, y: ORIGIN + 4 };
      items = [...items, { i: w.id, ...findFreeSpot(items, size.w, size.h, c.x, c.y), w: size.w, h: size.h, minW: size.minW ?? 2, minH: size.minH ?? 2 }];
    }
    return items;
  }, [canvas, widgets]);

  // Tiles (chat, mail bot, brief) can ask for the AI settings: window.dispatchEvent(new Event('nexus:ai-settings'))
  useEffect(() => {
    const open = () => setAiOpen(true);
    window.addEventListener('nexus:ai-settings', open);
    return () => window.removeEventListener('nexus:ai-settings', open);
  }, []);

  const arrangeCanvas = () => {
    const before = safeCanvas;
    canvasApi.current?.arrange();
    setUndo(before);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 12_000);
  };
  const undoArrange = () => {
    changeCanvas(undo);
    setUndo(null);
  };

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
      // canvas: nearest free spot to the middle of the screen
      const c = canvasApi.current?.centerCell() ?? { x: ORIGIN + 6, y: ORIGIN + 4 };
      const spot = { i: w.id, ...findFreeSpot(safeCanvas, def.size.w, def.size.h, c.x, c.y), w: def.size.w, h: def.size.h, minW: def.size.minW ?? 2, minH: def.size.minH ?? 2 };
      setWidgets((ws) => [...ws, w]);
      setLayouts(next);
      persistLayouts(next);
      changeCanvas([...safeCanvas, spot]);
      setPicker(false);
      if (def.configureOnAdd) setConfiguring(w);
      if (isDesktop) setTimeout(() => canvasApi.current?.reveal(spot), 50);
      else setTimeout(() => document.getElementById(`tile-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
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
    changeCanvas(safeCanvas.filter((c) => c.i !== w.id));
  };

  const saveConfig = async (w, title, config) => {
    const updated = await api.patch(`/widgets/${w.id}`, { title, config });
    setWidgets((ws) => ws.map((x) => (x.id === w.id ? updated : x)));
    setConfiguring(null);
  };

  // Tiles that edit their own config in place (e.g. a stock watchlist).
  const updateConfig = async (w, patch) => {
    const updated = await api.patch(`/widgets/${w.id}`, { config: { ...w.config, ...patch } });
    setWidgets((ws) => ws.map((x) => (x.id === w.id ? updated : x)));
    return updated;
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

  const tiles = widgets.map((w) => (
    <div key={w.id} id={`tile-${w.id}`}>
      <Tile
        widget={w}
        def={REGISTRY[w.type]}
        editing={editing}
        onConfigure={() => setConfiguring(w)}
        onUpdateConfig={(patch) => updateConfig(w, patch)}
        onRemove={() => removeWidget(w)}
      />
    </div>
  ));

  const empty = loaded && !widgets.length && (
    <div className="empty">
      <div className="empty-ring" />
      <h2>A FEDÉLZET ÜRES</h2>
      <p>Adj hozzá modulokat a katalógusból.</p>
      <button className="btn btn-primary" onClick={() => setPicker(true)}>
        + Modul hozzáadása
      </button>
    </div>
  );

  return (
    <div className={`app ${editing ? 'is-editing' : ''} ${isDesktop ? 'canvas-mode' : ''}`}>
      <div className="bg-grid" />
      <div className="bg-glow" />
      <TopBar
        editing={editing}
        onToggleEdit={() => setEditing((e) => !e)}
        onAdd={() => setPicker(true)}
        onArrange={isDesktop && widgets.length > 1 ? arrangeCanvas : null}
        onAi={() => setAiOpen(true)}
        aiVersion={aiVersion}
        count={widgets.length}
        appearance={appearance}
        onAppearance={changeAppearance}
      />

      {undo && (
        <div className="toast toast-info">
          Csempék rendezve.
          <button className="btn btn-primary sm" onClick={undoArrange}>
            Visszavonás
          </button>
        </div>
      )}

      {error && (
        <div className="toast" onClick={() => setError(null)}>
          ⚠ {error}
        </div>
      )}

      {isDesktop ? (
        <main className="canvas-main">
          {empty}
          {loaded && (
            <Canvas items={safeCanvas} onItemsChange={changeCanvas} editing={editing} onApi={(a) => (canvasApi.current = a)}>
              {tiles}
            </Canvas>
          )}
        </main>
      ) : (
        <main className="deck">
          {empty}
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
            {tiles}
          </Grid>
        </main>
      )}

      {picker && <WidgetPicker onPick={addWidget} onClose={() => setPicker(false)} />}
      {aiOpen && <AiSettings onClose={() => setAiOpen(false)} onSaved={() => setAiVersion((v) => v + 1)} />}
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
