import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';

// Load data for a widget, optionally re-polling. Returns { data, error, loading, reload, setData }.
export function useWidgetData(url, { interval = 0, deps = [] } = {}) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const latest = useRef(0); // id of the newest request; older responses are ignored

  const reload = useCallback(async () => {
    const id = ++latest.current;
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
