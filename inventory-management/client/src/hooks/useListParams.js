import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Table state (search, filters, sort, page) stored in the URL so views are shareable
 * and survive refresh / back navigation.
 */
export default function useListParams(defaults = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const params = useMemo(() => {
    const out = { page: '1', ...defaults };
    searchParams.forEach((v, k) => {
      out[k] = v;
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const update = useCallback(
    (patch, { resetPage = true } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          Object.entries(patch).forEach(([k, v]) => {
            if (v === undefined || v === null || v === '' || v === defaults[k]) next.delete(k);
            else next.set(k, String(v));
          });
          if (resetPage && !('page' in patch)) next.delete('page');
          return next;
        },
        { replace: true }
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setSearchParams]
  );

  const setSort = useCallback(
    (field) => {
      const same = params.sort === field;
      update({ sort: field, order: same && params.order === 'asc' ? 'desc' : 'asc' });
    },
    [params.sort, params.order, update]
  );

  const reset = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams]);

  return { params, update, setSort, reset };
}
