import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronsUpDown, Search, X } from 'lucide-react';
import { productService } from '../../services';
import useDebounce from '../../hooks/useDebounce';
import ProductThumb from './ProductThumb';
import Spinner from './Spinner';
import { sizeLabel } from '../../utils/format';

/** Searchable, server-backed product combobox (scales to thousands of products). */
export default function ProductPicker({ value, onChange, error, placeholder = 'Search product by name, SKU or HSN', activeOnly = false, id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const debounced = useDebounce(query, 250);
  const rootRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    productService
      .list({ search: debounced, limit: 15, sort: 'name', order: 'asc', status: activeOnly ? 'active' : undefined })
      .then((r) => active && (setItems(r.items), setHighlight(0)))
      .catch(() => active && setItems([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [debounced, open, activeOnly]);

  useEffect(() => {
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (p) => {
    onChange(p);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      setHighlight((h) => Math.min(h + 1, items.length - 1));
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      setHighlight((h) => Math.max(h - 1, 0));
      e.preventDefault();
    } else if (e.key === 'Enter' && items[highlight]) {
      choose(items[highlight]);
      e.preventDefault();
    } else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      {value && !open ? (
        <button
          type="button"
          id={id}
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={clsx('input flex items-center gap-3 py-1.5 text-left', error && 'input-error')}
        >
          <ProductThumb product={value} size="sm" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-900">{value.name}</span>
            <span className="block truncate text-xs text-slate-500">
              {value.sku} · {sizeLabel(value)} · counted in {value.stockUnit}
            </span>
          </span>
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
            onKeyDown={(e) => e.key === 'Enter' && onChange(null)}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear product"
          >
            <X className="h-4 w-4" />
          </span>
        </button>
      ) : (
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            ref={inputRef}
            id={id}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={clsx('input pl-9 pr-9', error && 'input-error')}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            autoComplete="off"
          />
          <ChevronsUpDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      )}

      {open && (
        <div className="animate-pop absolute z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <ul className="scroll-thin max-h-72 overflow-y-auto py-1" role="listbox">
            {loading && items.length === 0 && (
              <li className="flex items-center gap-2 px-4 py-3 text-sm text-slate-500">
                <Spinner className="h-4 w-4" /> Searching…
              </li>
            )}
            {!loading && items.length === 0 && <li className="px-4 py-3 text-sm text-slate-500">No products found</li>}
            {items.map((p, i) => (
              <li key={p._id} role="option" aria-selected={i === highlight}>
                <button
                  type="button"
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => choose(p)}
                  className={clsx('flex w-full items-center gap-3 px-3 py-2 text-left', i === highlight && 'bg-slate-50')}
                >
                  <ProductThumb product={p} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-slate-900">{p.name}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {p.sku} · {sizeLabel(p)}
                      {p.status !== 'active' && ' · inactive'}
                    </span>
                  </span>
                  <span className="num shrink-0 text-xs text-slate-500">
                    {p.totalStock ?? 0} {p.stockUnit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
