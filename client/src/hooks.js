import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Load data for a widget, optionally re-polling. Pass a falsy url to skip loading.
// Returns { data, error, loading, reload, setData }.
export function useWidgetData(url, { interval = 0, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0); // id of the newest request; older responses are ignored

  const reload = useCallback(async () => {
    const id = ++latest.current;
    if (!url) {
      setLoading(false); // nothing to load yet (widget not configured)
      return;
    }
    setLoading(true);
    try {
      const d = await api.get(url);
      if (id === latest.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (id === latest.current) setError(e.message);
    } finally {
      if (id === latest.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    reload();
    const t = interval ? setInterval(reload, interval) : null;
    return () => {
      latest.current++; // invalidate in-flight requests (unmount / url change)
      if (t) clearInterval(t);
    };
  }, [reload, interval]);

  return { data, error, loading, reload, setData };
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

export const isoDay = (d) => {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
};

// CRUD helper for the generic /items storage. `query` e.g. 'kind=todo' or 'kind=count&from=2026-10-01'.
export function useItems(widgetId, query = '') {
  const url = `/widgets/${widgetId}/items${query ? `?${query}` : ''}`;
  const { data, error, setData, reload } = useWidgetData(url);
  const add = async (item) => {
    const created = await api.post(`/widgets/${widgetId}/items`, item);
    setData((xs) => [...(xs ?? []), created]);
    return created;
  };
  const update = async (id, patch) => {
    const updated = await api.patch(`/items/${id}`, patch);
    setData((xs) => xs.map((x) => (x.id === id ? updated : x)));
    return updated;
  };
  const remove = async (id) => {
    await api.del(`/items/${id}`);
    setData((xs) => xs.filter((x) => x.id !== id));
  };
  // one value per day (counter, mood, metric)
  const setDay = async (day, kind, value, data = {}) => {
    const saved = await api.put(`/widgets/${widgetId}/items/day/${day}`, { kind, value, data });
    setData((xs) => [...(xs ?? []).filter((x) => !(x.day === day && x.kind === kind)), saved]);
    return saved;
  };
  return { items: data, error, add, update, remove, setDay, setItems: setData, reload };
}

export const fmtNum = (n, digits = 0) =>
  n == null || isNaN(n) ? '–' : Number(n).toLocaleString('hu-HU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
