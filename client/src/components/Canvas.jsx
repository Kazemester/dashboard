import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import GridLayout from 'react-grid-layout';

// Infinite canvas: tiles live on a free (non-compacting) grid inside a pannable / zoomable world.
export const CELL_W = 96;
export const CELL_H = 44;
export const GAP = 14;
const MIN_COLS = 160;
const EDGE = 3; // keep at least this many free cells left / above the content (the world grows as needed)
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 2;
const VIEW_KEY = 'nexus:canvas-view';

// Grid cell → world pixels (matches react-grid-layout's own maths for this width/margin).
export const toPx = (l) => ({
  x: (CELL_W + GAP) * l.x + GAP,
  y: (CELL_H + GAP) * l.y + GAP,
  w: CELL_W * l.w + GAP * (l.w - 1),
  h: CELL_H * l.h + GAP * (l.h - 1),
});

function bounds(items) {
  if (!items.length) return null;
  const r = items.map(toPx);
  const x0 = Math.min(...r.map((b) => b.x));
  const y0 = Math.min(...r.map((b) => b.y));
  const x1 = Math.max(...r.map((b) => b.x + b.w));
  const y1 = Math.max(...r.map((b) => b.y + b.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

// Nearest free spot to (cx, cy) for a w×h tile — spiral search over grid cells.
export function findFreeSpot(items, w, h, cx, cy) {
  const fits = (x, y) => x >= 0 && y >= 0 && !items.some((it) => overlaps({ x, y, w, h }, it));
  const x0 = Math.max(0, Math.round(cx - w / 2));
  const y0 = Math.max(0, Math.round(cy - h / 2));
  for (let r = 0; r < 80; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (fits(x0 + dx, y0 + dy)) return { x: x0 + dx, y: y0 + dy };
      }
    }
  }
  const b = items.reduce((m, it) => Math.max(m, it.y + it.h), 0);
  return { x: x0, y: b + 1 };
}

// After a drag: the moved tile stays where it was dropped, or goes to the nearest free spot.
function resolveDrag(layout, id) {
  const moved = layout.find((l) => l.i === id);
  const others = layout.filter((l) => l.i !== id);
  if (!moved || !others.some((o) => overlaps(o, moved))) return layout;
  const spot = findFreeSpot(others, moved.w, moved.h, moved.x + moved.w / 2, moved.y + moved.h / 2);
  return layout.map((l) => (l.i === id ? { ...l, ...spot } : l));
}

// After a resize: the resized tile keeps its size; tiles it now covers step aside to the nearest free spot.
function resolveResize(layout, id) {
  const resized = layout.find((l) => l.i === id);
  if (!resized) return layout;
  const rest = layout.filter((l) => l.i !== id);
  const result = [resized, ...rest.filter((l) => !overlaps(l, resized))];
  for (const l of rest.filter((o) => overlaps(o, resized))) {
    result.push({ ...l, ...findFreeSpot(result, l.w, l.h, l.x + l.w / 2, l.y + l.h / 2) });
  }
  return result;
}

// "Rendezés": pack tiles top-left first, in reading order, into a band `width` cells wide.
export function arrange(items, width, origin = { x: 24, y: 24 }) {
  const order = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const W = Math.max(width, ...order.map((l) => l.w));
  const placed = [];
  for (const l of order) {
    let spot = null;
    for (let y = 0; !spot; y++) {
      for (let x = 0; x + l.w <= W; x++) {
        const cand = { x, y, w: l.w, h: l.h };
        if (!placed.some((p) => overlaps(p, cand))) {
          spot = cand;
          break;
        }
      }
    }
    placed.push({ ...l, x: spot.x, y: spot.y });
  }
  return placed.map((l) => ({ ...l, x: l.x + origin.x, y: l.y + origin.y }));
}

function loadView() {
  try {
    return JSON.parse(localStorage.getItem(VIEW_KEY));
  } catch {
    return null;
  }
}

export default function Canvas({ items, onItemsChange, editing, children, onApi }) {
  const vpRef = useRef(null);
  const [view, setView] = useState(() => loadView());
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [panning, setPanning] = useState(false);
  const [space, setSpace] = useState(false);
  const pan = useRef(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  // Persist the view per device (screens differ, so it is not stored in the DB).
  useEffect(() => {
    if (!view) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(view));
      } catch {
        /* ignore */
      }
    }, 300);
    return () => clearTimeout(t);
  }, [view]);

  useLayoutEffect(() => {
    const el = vpRef.current;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const fit = useCallback(
    (list = items) => {
      const b = bounds(list);
      if (!b) return setView({ x: 40, y: 40, zoom: 1 });
      const pad = 60;
      const zoom = Math.min(1, Math.max(ZOOM_MIN, Math.min((size.w - pad * 2) / b.w, (size.h - pad * 2) / b.h)));
      // centre when it fits; otherwise start from the top-left corner so the beginning is visible
      const x = b.w * zoom <= size.w - pad * 2 ? (size.w - b.w * zoom) / 2 - b.x * zoom : pad - b.x * zoom;
      const y = b.h * zoom <= size.h - pad * 2 ? (size.h - b.h * zoom) / 2 - b.y * zoom : pad - b.y * zoom;
      setView({ zoom, x, y });
    },
    [items, size],
  );

  const fitRef = useRef(fit);
  fitRef.current = fit;

  // First visit: show everything.
  useEffect(() => {
    if (!view && items.length && size.w > 0) fit();
  }, [view, items.length, size.w, fit]);

  const v = view ?? { x: 40, y: 40, zoom: 1 };

  const zoomAt = useCallback((factor, cx, cy) => {
    setView((cur) => {
      const c = cur ?? { x: 40, y: 40, zoom: 1 };
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, c.zoom * factor));
      const k = zoom / c.zoom;
      return { zoom, x: cx - (cx - c.x) * k, y: cy - (cy - c.y) * k };
    });
  }, []);

  // Centre the viewport on a world point (used by the minimap and when a tile is added).
  const centerOn = useCallback(
    (wx, wy) => setView((cur) => {
      const z = (cur ?? v).zoom;
      return { zoom: z, x: size.w / 2 - wx * z, y: size.h / 2 - wy * z };
    }),
    [size, v],
  );

  // Viewport centre in grid cells — where new tiles are placed.
  const centerCell = useCallback(() => {
    const c = viewRef.current ?? { x: 40, y: 40, zoom: 1 };
    const wx = (size.w / 2 - c.x) / c.zoom;
    const wy = (size.h / 2 - c.y) / c.zoom;
    return { x: wx / (CELL_W + GAP), y: wy / (CELL_H + GAP) };
  }, [size]);

  useEffect(() => {
    onApi?.({
      centerCell,
      // tidy everything into a band as wide as the screen (at 100%), then show it all
      arrange: () => {
        // band width chosen so the packed block has the screen's aspect ratio (fills the screen when fitted)
        const area = items.reduce((a, l) => a + l.w * (CELL_W + GAP) * l.h * (CELL_H + GAP), 0);
        const widthPx = Math.sqrt(area * (size.w / Math.max(1, size.h)));
        const cols = Math.min(48, Math.max(8, Math.round(widthPx / (CELL_W + GAP))));
        const next = arrange(items, cols, { x: EDGE * 4, y: EDGE * 4 });
        onItemsChange(next);
        setTimeout(() => fitRef.current?.(next), 0);
      },
      // centre on a tile, zooming in if it would otherwise be a speck
      reveal: (l) => {
        const p = toPx(l);
        setView((c) => {
          const z = Math.max((c ?? v).zoom, 0.55);
          return { zoom: z, x: size.w / 2 - (p.x + p.w / 2) * z, y: size.h / 2 - (p.y + p.h / 2) * z };
        });
      },
    });
  }, [onApi, centerCell, centerOn, items, size, onItemsChange]);

  // ---------- wheel: pan, ctrl/⌘ (or pinch) zooms ----------
  useEffect(() => {
    const el = vpRef.current;
    const onWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const r = el.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * 0.0025 * (e.deltaMode === 1 ? 16 : 1)), e.clientX - r.left, e.clientY - r.top);
        return;
      }
      // Let scrollable content inside a tile scroll natively.
      for (let n = e.target; n && n !== el; n = n.parentElement) {
        if (n.scrollHeight > n.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
          const atTop = n.scrollTop <= 0;
          const atBottom = n.scrollTop + n.clientHeight >= n.scrollHeight - 1;
          if ((e.deltaY < 0 && !atTop) || (e.deltaY > 0 && !atBottom)) return;
        }
      }
      e.preventDefault();
      const m = e.deltaMode === 1 ? 16 : 1;
      setView((c) => ({ ...(c ?? v), x: (c ?? v).x - e.deltaX * m, y: (c ?? v).y - e.deltaY * m }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [zoomAt, v]);

  // ---------- drag to pan: empty background, middle button, or space + drag ----------
  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !/input|textarea|select/i.test(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault();
        setSpace(true);
      }
    };
    const up = (e) => {
      if (e.code !== 'Space') return;
      setSpace(false);
      // space is our pan key: don't let it also "click" the focused button (e.g. toggle edit mode off)
      if (!/input|textarea|select/i.test(e.target.tagName) && !e.target.isContentEditable) e.preventDefault();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Capture phase: with space held (or the middle button) we pan even over a tile, and preventDefault on
  // pointerdown suppresses the mousedown the tile's drag handler would otherwise get. Tiles stay
  // isDraggable the whole time — toggling it does not reach react-grid-layout's memoised items.
  const onPointerDown = (e) => {
    const onTile = e.target.closest('.react-grid-item, .canvas-ui');
    if (!(e.button === 1 || (e.button === 0 && (space || !onTile)))) return;
    e.preventDefault();
    e.stopPropagation();
    pan.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: v.x, y: v.y };
    vpRef.current.setPointerCapture(e.pointerId);
    setPanning(true);
  };
  const onPointerMove = (e) => {
    const p = pan.current;
    if (!p || p.id !== e.pointerId) return;
    setView({ zoom: v.zoom, x: p.x + e.clientX - p.sx, y: p.y + e.clientY - p.sy });
  };
  const endPan = (e) => {
    if (pan.current?.id !== e.pointerId) return;
    pan.current = null;
    setPanning(false);
  };

  // ---------- grid ----------
  const cols = Math.max(MIN_COLS, ...items.map((l) => l.x + l.w + 40));
  const width = cols * (CELL_W + GAP) + GAP;

  // Keep free space on the left / top: shift everything and move the view so nothing jumps visually.
  const normalise = useCallback(
    (layout) => {
      const minX = Math.min(...layout.map((l) => l.x));
      const minY = Math.min(...layout.map((l) => l.y));
      const dx = minX < EDGE ? EDGE * 3 - minX : 0;
      const dy = minY < EDGE ? EDGE * 3 - minY : 0;
      if (!dx && !dy) return layout;
      setView((c) => ({ ...(c ?? v), x: (c ?? v).x - dx * (CELL_W + GAP) * (c ?? v).zoom, y: (c ?? v).y - dy * (CELL_H + GAP) * (c ?? v).zoom }));
      return layout.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy }));
    },
    [v],
  );

  const strip = (layout) => layout.map(({ i, x, y, w, h, minW, minH }) => ({ i, x, y, w, h, minW, minH }));
  const interacting = useRef(false); // a tile is being dragged / resized

  // The world starts at cell 0; keep at least half a screen of it left of / above the viewport, so wherever
  // you pan there is canvas under the cursor to drop onto. Grows by shifting all tiles and the view together.
  useEffect(() => {
    if (!view || interacting.current || !items.length) return;
    const cw = (CELL_W + GAP) * view.zoom;
    const ch = (CELL_H + GAP) * view.zoom;
    const dx = view.x > -size.w / 2 ? Math.ceil((view.x + size.w / 2) / cw) + 10 : 0;
    const dy = view.y > -size.h / 2 ? Math.ceil((view.y + size.h / 2) / ch) + 10 : 0;
    if (!dx && !dy) return;
    onItemsChange(items.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })));
    setView((c) => ({ ...c, x: c.x - dx * cw, y: c.y - dy * ch }));
    // a pan in progress computes the view from its start point — move that too, or the next mouse move undoes this
    if (pan.current) {
      pan.current.x -= dx * cw;
      pan.current.y -= dy * ch;
    }
  }, [view, items, size, onItemsChange]);
  const [ghost, setGhost] = useState(null);
  const lastDrag = useRef(null);

  // While dragging, tiles may overlap freely (so the tile follows the cursor); show where it will land.
  const onStart = () => {
    interacting.current = true;
  };
  const onDrag = (layout, _old, item) => {
    const resolved = resolveDrag(strip(layout), item.i).find((l) => l.i === item.i);
    lastDrag.current = { i: item.i, x: item.x, y: item.y };
    setGhost(resolved.x !== item.x || resolved.y !== item.y ? resolved : null);
  };
  // react-grid-layout stores the very `layout` array it passes to onDragStop / onResizeStop right after
  // calling us. Writing the resolved positions into those objects keeps its internal state and ours identical
  // (handing them over as props instead races with that setState).
  const applyTo = (rglLayout, resolved) => {
    const byId = Object.fromEntries(resolved.map((l) => [l.i, l]));
    for (const l of rglLayout) {
      const r = byId[l.i];
      if (r) Object.assign(l, { x: r.x, y: r.y, w: r.w, h: r.h });
    }
  };
  const onDragStop = (layout, _old, item) => {
    interacting.current = false;
    setGhost(null);
    // land exactly where the preview / placeholder last was (the drop event can round one cell differently)
    const last = lastDrag.current?.i === item.i ? lastDrag.current : null;
    lastDrag.current = null;
    const dropped = strip(layout).map((l) => (last && l.i === item.i ? { ...l, x: last.x, y: last.y } : l));
    const final = normalise(resolveDrag(dropped, item.i));
    applyTo(layout, final);
    onItemsChange(final);
  };
  const onResizeStop = (layout, _old, item) => {
    interacting.current = false;
    const final = normalise(resolveResize(strip(layout), item.i));
    applyTo(layout, final);
    onItemsChange(final);
  };

  const layout = useMemo(() => items.map((l) => ({ ...l })), [items]);
  // react-grid-layout's GridItem only re-renders when its children or its position change (its
  // shouldComponentUpdate ignores everything else). Its drag / resize handlers keep the `transformScale` and
  // handle settings of the last real render, so after zooming the first grab computes the tile position with
  // the OLD zoom and the tile teleports. Hand the items fresh children whenever those inputs have changed:
  // the drag handle mode flipping (zoomed out: whole tile; otherwise: header), and the zoom once it settles.
  const grabAll = v.zoom < 0.5;
  const [settledZoom, setSettledZoom] = useState(v.zoom);
  useEffect(() => {
    const t = setTimeout(() => setSettledZoom(v.zoom), 80);
    return () => clearTimeout(t);
  }, [v.zoom]);
  // (plain array map: React.Children.map would prefix the keys react-grid-layout matches the layout by)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const tiles = useMemo(() => [].concat(children).map((c) => React.cloneElement(c)), [children, grabAll, settledZoom]);
  const content = bounds(items);

  // ---------- minimap ----------
  const MM_W = 180;
  const MM_H = 120;
  const visible = { x: -v.x / v.zoom, y: -v.y / v.zoom, w: size.w / v.zoom, h: size.h / v.zoom };
  const mmArea = content
    ? {
        x: Math.min(content.x, visible.x),
        y: Math.min(content.y, visible.y),
        x2: Math.max(content.x + content.w, visible.x + visible.w),
        y2: Math.max(content.y + content.h, visible.y + visible.h),
      }
    : null;
  const mmScale = mmArea ? Math.min(MM_W / (mmArea.x2 - mmArea.x), MM_H / (mmArea.y2 - mmArea.y)) : 1;
  const mm = (b) => ({ left: (b.x - mmArea.x) * mmScale, top: (b.y - mmArea.y) * mmScale, width: Math.max(2, b.w * mmScale), height: Math.max(2, b.h * mmScale) });
  const onMinimap = (e) => {
    if (!mmArea || !(e.buttons & 1)) return;
    const r = e.currentTarget.getBoundingClientRect();
    centerOn(mmArea.x + (e.clientX - r.left) / mmScale, mmArea.y + (e.clientY - r.top) / mmScale);
  };

  // Dot grid that moves with the world.
  const step = { x: (CELL_W + GAP) * v.zoom, y: (CELL_H + GAP) * v.zoom };
  const bg = {
    backgroundSize: `${step.x}px ${step.y}px`,
    backgroundPosition: `${v.x + (GAP / 2) * v.zoom}px ${v.y + (GAP / 2) * v.zoom}px`,
  };

  return (
    <div
      ref={vpRef}
      className={`canvas-viewport ${panning ? 'panning' : ''} ${space ? 'space' : ''} ${v.zoom < 0.3 ? 'far' : ''}`}
      style={bg}
      // belt and braces for browsers without overflow: clip — this box is never meant to scroll
      onScroll={(e) => {
        if (e.currentTarget.scrollLeft || e.currentTarget.scrollTop) {
          e.currentTarget.scrollLeft = 0;
          e.currentTarget.scrollTop = 0;
        }
      }}
      onPointerDownCapture={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
    >
      <div className="canvas-world" style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`, width }}>
        <GridLayout
          className="canvas-grid"
          layout={layout}
          cols={cols}
          width={width}
          rowHeight={CELL_H}
          margin={[GAP, GAP]}
          compactType={null}
          allowOverlap
          transformScale={v.zoom}
          isDraggable={editing}
          isResizable={editing}
          // zoomed out, headers are tiny targets: let the whole tile be grabbed (except controls)
          draggableHandle={grabAll ? undefined : '.tile-head'}
          draggableCancel={grabAll ? 'button, input, textarea, select, a, iframe, .react-resizable-handle' : '.no-drag'}
          resizeHandles={['se']}
          onDragStart={onStart}
          onResizeStart={onStart}
          onDrag={onDrag}
          onDragStop={onDragStop}
          onResizeStop={onResizeStop}
        >
          {tiles}
        </GridLayout>
        {ghost && <div className="canvas-ghost" style={{ left: toPx(ghost).x, top: toPx(ghost).y, width: toPx(ghost).w, height: toPx(ghost).h }} />}
      </div>

      {mmArea && (
        <div className="canvas-ui minimap" style={{ width: MM_W, height: MM_H }} onPointerDown={onMinimap} onPointerMove={onMinimap} title="Minitérkép: kattints vagy húzd">
          {items.map((l) => (
            <i key={l.i} style={mm(toPx(l))} />
          ))}
          <b style={mm(visible)} />
        </div>
      )}

      <div className="canvas-ui zoom-ctrl">
        <button className="icon-btn" title="Kicsinyítés (Ctrl + görgő)" onClick={() => zoomAt(1 / 1.2, size.w / 2, size.h / 2)}>
          −
        </button>
        <button className="zoom-pct" title="100%" onClick={() => zoomAt(1 / v.zoom, size.w / 2, size.h / 2)}>
          {Math.round(v.zoom * 100)}%
        </button>
        <button className="icon-btn" title="Nagyítás (Ctrl + görgő)" onClick={() => zoomAt(1.2, size.w / 2, size.h / 2)}>
          +
        </button>
        <button className="icon-btn" title="Mindent mutat" onClick={() => fit()}>
          ⤢
        </button>
      </div>
      <div className="canvas-ui canvas-hint">Húzd a hátteret · görgő: mozgatás · Ctrl + görgő: nagyítás</div>
    </div>
  );
}
