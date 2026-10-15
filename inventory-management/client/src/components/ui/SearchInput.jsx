import { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';
import clsx from 'clsx';
import useDebounce from '../../hooks/useDebounce';

/** Debounced search box that syncs with an external value (e.g. URL param). */
export default function SearchInput({ value = '', onChange, placeholder = 'Search…', className }) {
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, 350);

  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (debounced !== value) onChange(debounced);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  return (
    <div className={clsx('relative', className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input type="search" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="input pl-9 pr-8 [&::-webkit-search-cancel-button]:hidden" aria-label={placeholder} />
      {text && (
        <button type="button" onClick={() => setText('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Clear search">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
