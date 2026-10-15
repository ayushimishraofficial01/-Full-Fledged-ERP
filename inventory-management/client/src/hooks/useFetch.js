import { useCallback, useEffect, useRef, useState } from 'react';
import { parseError } from '../services/api';

/**
 * Runs `fetcher` whenever `deps` change. Ignores stale responses so fast filter changes never
 * show out-of-order results. Keeps previous data while reloading (no table flicker).
 */
export default function useFetch(fetcher, deps = [], { enabled = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const reqId = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    if (!enabled) return;
    const id = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const res = await fetcherRef.current();
      if (id === reqId.current) setData(res);
    } catch (err) {
      if (id === reqId.current) setError(parseError(err));
    } finally {
      if (id === reqId.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  useEffect(() => {
    run();
  }, [run]);

  return { data, loading, error, reload: run, setData };
}
