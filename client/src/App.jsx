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
import { t } from './i18n.js';
import { ShellContext, newCategoryId } from './shell/context.js';
import CategoryRail from './shell/CategoryRail.jsx';
import CategoryEditor from './shell/CategoryEditor.jsx';
import ScreenLayer from './shell/ScreenLayer.jsx';
import Dock from './shell/Dock.jsx';
import Assistant from './shell/Assistant.jsx';

const Grid = WidthProvider(Responsive);
const COLS = { lg: 12, md: 10, sm: 6, xs: 2 };
// a category on a phone: one simple 2-column list (full-width or half-width tiles)
const CAT_COLS = { lg: 2, md: 2, sm: 2, xs: 2 };
const CAT_KEY = 'nexus-category';
const BREAKPOINTS = { lg: 1200, md: 960, sm: 640, xs: 0 };

function useMedia(q) {
  const [hit, setHit] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const m = window.matchMedia(q);
    const on = () => setHit(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [q]);
  return hit;
}
// Desktop uses the infinite canvas; phones keep the stacked responsive grid.
const useIsDesktop = () => useMedia('(min-width: 768px)');

const readCat = () => {
  try {
    return localStorage.getItem(CAT_KEY) || null;
  } catch {
    return null;
  }
};
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
  const [rev, setRev] = useState({}); // per-tile remount counter (content changed by the chat bot)
  const [flashId, setFlashId] = useState(null); // tile that is briefly highlighted after the bot added it
  const flashTimer = useRef(null);
  const isDesktopRef = useRef(isDesktop);
  isDesktopRef.current = isDesktop;
  const canvasRef = useRef([]);
  const undoTimer = useRef(null);
  const [categories, setCategories] = useState([]);
  const [profile, setProfile] = useState({});
  const [activeCat, setActiveCat] = useState(readCat);
  const [catEditor, setCatEditor] = useState(null); // null | { startNew }
  const [assistantOpen, setAssistantOpen] = useState(false);
  const catTimer = useRef(null);
  const wide = useMedia('(min-width: 900px)');

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ widgets, layouts, appearance: saved, canvas: savedCanvas, categories: cats, profile: me }) => {
        setWidgets(widgets);
        setLayouts(layouts);
        setCategories(cats ?? []);
        setProfile(me ?? {});
        if (!(cats ?? []).some((c) => c.id === readCat())) setActiveCat(null);
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

  // ---------- categories (right-hand rail) ----------
  const persistCategories = useCallback((next) => {
    clearTimeout(catTimer.current);
    catTimer.current = setTimeout(() => api.put('/settings/categories', next).catch((e) => setError(e.message)), 400);
  }, []);
  const updateCategories = useCallback(
    (fn) =>
      setCategories((prev) => {
        const next = fn(prev);
        if (next !== prev) persistCategories(next);
        return next;
      }),
    [persistCategories],
  );
  const selectCategory = useCallback((id) => {
    setActiveCat(id);
    try {
      if (id) localStorage.setItem(CAT_KEY, id);
      else localStorage.removeItem(CAT_KEY);
    } catch {
      /* ignore */
    }
  }, []);
  const stripTile = (c, id) => ({ ...c, tiles: c.tiles.filter((x) => x !== id), canvas: c.canvas.filter((x) => x.i !== id), layout: c.layout.filter((x) => x.i !== id) });
  const setTileCategories = useCallback(
    (widgetId, ids) =>
      updateCategories((prev) =>
        prev.map((c) => {
          const has = c.tiles.includes(widgetId);
          if (ids.includes(c.id)) return has ? c : { ...c, tiles: [...c.tiles, widgetId] };
          return has ? stripTile(c, widgetId) : c;
        }),
      ),
    [updateCategories],
  );
  const createCategory = useCallback(
    (name, icon = '◆') => {
      const id = newCategoryId();
      updateCategories((prev) => [...prev, { id, name, icon, tiles: [], canvas: [], layout: [] }]);
      return id;
    },
    [updateCategories],
  );
  const cat = categories.find((c) => c.id === activeCat) ?? null;
  const shell = useMemo(() => ({ categories, active: activeCat, setTileCategories, createCategory }), [categories, activeCat, setTileCategories, createCategory]);

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

  // The tiles on screen: everything, or the active category's tiles in its own order.
  const visible = useMemo(() => (cat ? cat.tiles.map((id) => widgets.find((w) => w.id === id)).filter(Boolean) : widgets), [cat, widgets]);

  // A category's own canvas: saved positions, the rest packed from the top-left (sizes taken from the main canvas).
  const catCanvas = useMemo(() => {
    if (!cat) return null;
    const ids = new Set(visible.map((w) => w.id));
    let items = cat.canvas.filter((c) => ids.has(c.i));
    for (const w of visible) {
      if (items.some((c) => c.i === w.id)) continue;
      const main = safeCanvas.find((c) => c.i === w.id);
      const size = main ?? REGISTRY[w.type]?.size ?? { w: 4, h: 5 };
      items = [...items, { i: w.id, ...findFreeSpot(items, size.w, size.h, ORIGIN + size.w / 2, ORIGIN + size.h / 2), w: size.w, h: size.h, minW: size.minW ?? 2, minH: size.minH ?? 2 }];
    }
    return items;
  }, [cat, visible, safeCanvas]);

  // …and its phone list (2 columns; full width unless the user narrowed a tile).
  const catLayout = useMemo(() => {
    if (!cat) return null;
    const ids = new Set(visible.map((w) => w.id));
    let items = cat.layout.filter((c) => ids.has(c.i));
    for (const w of visible) {
      if (items.some((c) => c.i === w.id)) continue;
      const xs = (layouts.xs ?? []).find((l) => l.i === w.id);
      const bottom = items.reduce((m, l) => Math.max(m, l.y + l.h), 0);
      items = [...items, { i: w.id, x: 0, y: bottom, w: 2, h: xs?.h ?? REGISTRY[w.type]?.size?.h ?? 5, minW: 1, minH: 2 }];
    }
    return items;
  }, [cat, visible, layouts]);

  const onCategoryCanvas = useCallback((next) => updateCategories((prev) => prev.map((c) => (c.id === activeCat ? { ...c, canvas: next } : c))), [activeCat, updateCategories]);

  canvasRef.current = catCanvas ?? safeCanvas;

  // Tiles (chat, mail bot, brief) can ask for the AI settings: window.dispatchEvent(new Event('nexus:ai-settings'))
  useEffect(() => {
    const open = () => setAiOpen(true);
    window.addEventListener('nexus:ai-settings', open);
    return () => window.removeEventListener('nexus:ai-settings', open);
  }, []);

  // Bring a tile into view and highlight it (tiles the chat bot added may sit outside the current view).
  const revealTile = useCallback((id, list) => {
    setFlashId(id);
    clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 3200);
    setTimeout(() => {
      if (isDesktopRef.current) {
        const item = (list ?? canvasRef.current).find((c) => c.i === id);
        if (item) canvasApi.current?.reveal(item);
      } else {
        const el = document.getElementById(`tile-${id}`);
        const r = el?.getBoundingClientRect();
        // only scroll when the tile is not already on screen (below the sticky header)
        if (el && (r.top < 70 || r.bottom > innerHeight)) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 200);
  }, []);

  // Reveal from outside the current view (bell, bot): leave a category that does not hold the tile.
  const revealAnywhere = useCallback(
    (id) => {
      if (cat && !cat.tiles.includes(id)) {
        selectCategory(null);
        setTimeout(() => revealTile(id, safeCanvas), 120);
      } else revealTile(id);
    },
    [cat, selectCategory, revealTile, safeCanvas],
  );

  useEffect(() => {
    const onReveal = (e) => e.detail?.id && revealAnywhere(e.detail.id);
    window.addEventListener('nexus:reveal', onReveal);
    return () => window.removeEventListener('nexus:reveal', onReveal);
  }, [revealAnywhere]);

  // The chat bot changed tiles, layout or theme on the server → pull the new state.
  useEffect(() => {
    const onChange = async (e) => {
      try {
        const d = await api.get('/dashboard');
        setWidgets(d.widgets);
        if (d.canvas) setCanvas(d.canvas);
        if (d.appearance) setAppearance(d.appearance);
        if (d.categories) setCategories(d.categories);
        const shown = e.detail?.shown ?? (e.detail?.created ?? []).map((c) => c.id);
        if (shown.length) revealTile(shown[shown.length - 1], d.canvas ?? []);
        const ids = e.detail?.changed ?? [];
        if (ids.length) setRev((r) => Object.fromEntries([...Object.entries(r), ...(ids.includes('*') ? d.widgets.map((w) => w.id) : ids).map((id) => [id, (r[id] ?? 0) + 1])]));
      } catch (err) {
        setError(err.message);
      }
    };
    window.addEventListener('nexus:dashboard-changed', onChange);
    return () => window.removeEventListener('nexus:dashboard-changed', onChange);
  }, [revealTile]);

  const arrangeCanvas = () => {
    if (!confirm(t('Biztosan rendezed a csempéket? Minden csempe új helyre kerül egy rácsba. (Utána 12 másodpercig visszavonható.)'))) return;
    const before = catCanvas ?? safeCanvas;
    canvasApi.current?.arrange();
    setUndo(before);
    clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setUndo(null), 12_000);
  };
  const undoArrange = () => {
    if (cat) onCategoryCanvas(undo);
    else changeCanvas(undo);
    setUndo(null);
  };

  const onLayoutChange = useCallback(
    (current, all) => {
      if (!loaded) return;
      if (activeCat) {
        const next = current.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
        updateCategories((prev) => prev.map((c) => (c.id === activeCat && !sameJson(c.layout, next) ? { ...c, layout: next } : c)));
        return;
      }
      setLayouts(all);
      persistLayouts(all);
    },
    [loaded, persistLayouts, activeCat, updateCategories],
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
      let shown = spot;
      if (cat) {
        // added inside a category: it goes there too, next to the middle of this category's view
        shown = { ...spot, ...findFreeSpot(catCanvas, def.size.w, def.size.h, c.x, c.y) };
        updateCategories((prev) => prev.map((x) => (x.id === cat.id ? { ...x, tiles: [...x.tiles, w.id], canvas: [...x.canvas, shown] } : x)));
      }
      setPicker(false);
      if (def.configureOnAdd) setConfiguring(w);
      if (isDesktop) setTimeout(() => canvasApi.current?.reveal(shown), 50);
      else setTimeout(() => document.getElementById(`tile-${w.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
    } catch (e) {
      setError(e.message);
    }
  };

  const addExisting = (w) => {
    if (!cat) return;
    setTileCategories(w.id, [...categories.filter((c) => c.tiles.includes(w.id)).map((c) => c.id), cat.id]);
    setPicker(false);
    setTimeout(() => revealTile(w.id), 150);
  };

  const removeWidget = async (w) => {
    if (cat) {
      // inside a category ✕ only takes the tile out of it
      updateCategories((prev) => prev.map((c) => (c.id === cat.id ? stripTile(c, w.id) : c)));
      return;
    }
    if (!confirm(t('Biztosan törlöd: "{title}"? A modul adatai is törlődnek.', { title: t(w.title) }))) return;
    await api.del(`/widgets/${w.id}`);
    setWidgets((ws) => ws.filter((x) => x.id !== w.id));
    const next = Object.fromEntries(Object.entries(layouts).map(([bp, l]) => [bp, l.filter((x) => x.i !== w.id)]));
    setLayouts(next);
    persistLayouts(next);
    changeCanvas(safeCanvas.filter((c) => c.i !== w.id));
    updateCategories((prev) => (prev.some((c) => c.tiles.includes(w.id)) ? prev.map((c) => stripTile(c, w.id)) : prev));
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

  const tiles = visible.map((w, idx) => (
    <div key={w.id} id={`tile-${w.id}`} style={{ '--i': idx }} className={flashId === w.id ? 'tile-flash' : undefined}>
      <Tile
        key={rev[w.id] ?? 0}
        widget={w}
        def={REGISTRY[w.type]}
        editing={editing}
        onConfigure={() => setConfiguring(w)}
        onUpdateConfig={(patch) => updateConfig(w, patch)}
        onRemove={() => removeWidget(w)}
        removeLabel={cat ? t('Kivétel a kategóriából') : null}
      />
    </div>
  ));

  const catEmpty = loaded && cat && !visible.length && (
    <div className="empty">
      <div className="empty-ring" />
      <h2>
        {cat.icon} {cat.name}
      </h2>
      <p>{t('Ez a kategória még üres. Tegyél bele meglévő csempéket vagy adj hozzá újat.')}</p>
      <button className="btn btn-primary" onClick={() => setPicker(true)}>
        {t('+ Csempe hozzáadása')}
      </button>
    </div>
  );

  const empty = loaded && !widgets.length && (
    <div className="empty">
      <div className="empty-ring" />
      <h2>{t('A FEDÉLZET ÜRES')}</h2>
      <p>{t('Adj hozzá modulokat a katalógusból.')}</p>
      <button className="btn btn-primary" onClick={() => setPicker(true)}>
        {t('+ Modul hozzáadása')}
      </button>
    </div>
  );

  const saveProfile = (next) => {
    setProfile(next);
    api.put('/settings/profile', next).catch((e) => setError(e.message));
  };

  return (
    <ShellContext.Provider value={shell}>
      <div className={`app ${editing ? 'is-editing' : ''} ${isDesktop ? 'canvas-mode' : ''}`}>
        <div className="bg-grid" />
        <div className="bg-glow" />
        <TopBar
          onAi={() => setAiOpen(true)}
          aiVersion={aiVersion}
          appearance={appearance}
          onAppearance={changeAppearance}
          profile={profile}
          onProfile={saveProfile}
          onReveal={revealAnywhere}
          wide={wide}
          subtitle={cat ? `${cat.icon} ${cat.name}` : null}
        />

        {undo && (
          <div className="toast toast-info">
            {t('Csempék rendezve.')}
            <button className="btn btn-primary sm" onClick={undoArrange}>
              {t('Visszavonás')}
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
            {catEmpty}
            {loaded && (
              <Canvas
                key={activeCat ?? 'all'}
                viewKey={activeCat}
                items={catCanvas ?? safeCanvas}
                onItemsChange={cat ? onCategoryCanvas : changeCanvas}
                editing={editing}
                onApi={(a) => (canvasApi.current = a)}
              >
                {tiles}
              </Canvas>
            )}
          </main>
        ) : (
          <main className="deck">
            {empty}
            {catEmpty}
            <Grid
              key={activeCat ?? 'all'}
              className="grid"
              layouts={cat ? { lg: catLayout, md: catLayout, sm: catLayout, xs: catLayout } : safeLayouts}
              breakpoints={BREAKPOINTS}
              cols={cat ? CAT_COLS : COLS}
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

        <ScreenLayer>
          <CategoryRail
            categories={categories}
            active={cat ? cat.id : null}
            onSelect={selectCategory}
            onAdd={() => setCatEditor({ startNew: true })}
            onManage={() => setCatEditor({ startNew: false })}
          />
          <Dock
            editing={editing}
            onToggleEdit={() => setEditing((e) => !e)}
            onArrange={isDesktop && visible.length > 1 ? arrangeCanvas : null}
            onAdd={() => setPicker(true)}
            onAssistant={wide ? null : () => setAssistantOpen(true)}
          />
        </ScreenLayer>
        {!wide && <Assistant mode="sheet" open={assistantOpen} onClose={() => setAssistantOpen(false)} />}

        {picker && (
          <WidgetPicker
            onPick={addWidget}
            onClose={() => setPicker(false)}
            category={cat}
            existing={cat ? widgets.filter((w) => !cat.tiles.includes(w.id)) : null}
            onPickExisting={addExisting}
          />
        )}
        {catEditor && (
          <CategoryEditor
            categories={categories}
            startNew={catEditor.startNew}
            onClose={() => setCatEditor(null)}
            onSave={(next) => {
              updateCategories(() => next);
              setCatEditor(null);
              const added = next.find((c) => !categories.some((x) => x.id === c.id));
              if (added) selectCategory(added.id);
              else if (activeCat && !next.some((c) => c.id === activeCat)) selectCategory(null);
            }}
          />
        )}
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
    </ShellContext.Provider>
  );
}
