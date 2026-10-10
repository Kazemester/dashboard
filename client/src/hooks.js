import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Load data for a widget, optionally re-polling. Returns { data, error, loading, reload, setData }.
export function useWidgetData(url, { interval = 0, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const d = await api.get(url);
      if (alive.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError(e.message);
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => {
    alive.current = true;
    reload();
    const t = interval ? setInterval(reload, interval) : null;
    return () => {
      alive.current = false;
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
