import clsx from 'clsx';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import Spinner from './Spinner';
import { ErrorState } from './EmptyState';

/**
 * columns: [{ key, header, render?(row), sortKey?, align?: 'right'|'center', className?, headerClassName? }]
 * Horizontal scroll on small screens; sticky header; keeps old rows visible while reloading.
 */
export default function DataTable({ columns, rows, rowKey = (r) => r._id, loading, error, onRetry, sort, order, onSort, empty, onRowClick, minWidth = 720, dense = false }) {
  const showSkeleton = loading && !rows;
  const hasRows = rows && rows.length > 0;

  if (error && !hasRows) return <ErrorState message={error.message} onRetry={onRetry} />;

  return (
    <div className="relative">
      {loading && hasRows && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-brand-100">
          <div className="h-full w-1/3 animate-[pulse_1s_ease-in-out_infinite] bg-brand-500" />
        </div>
      )}
      <div className="scroll-thin overflow-x-auto rounded-b-xl">
        <table className="w-full border-collapse" style={{ minWidth }}>
          <thead>
              <tr className="border-b border-slate-200">
              {columns.map((c) => {
                const active = sort && c.sortKey && sort === c.sortKey;
                const SortIcon = active ? (order === 'desc' ? ArrowDown : ArrowUp) : ArrowUpDown;
                return (
                  <th key={c.key} scope="col" className={clsx('th group/th', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.sticky && 'sticky right-0 z-[1] bg-slate-50 shadow-[-8px_0_8px_-8px_rgba(20,24,31,0.12)]', c.headerClassName)}>
                    {c.sortKey && onSort ? (
                      <button
                        type="button"
                        onClick={() => onSort(c.sortKey)}
                        className={clsx('inline-flex items-center gap-1 font-medium hover:text-slate-900', active && 'text-slate-900', c.align === 'right' && 'flex-row-reverse')}
                      >
                        {c.header}
                        <SortIcon className={clsx('h-3.5 w-3.5 transition-opacity', !active && 'opacity-0 group-hover/th:opacity-60 group-focus-within/th:opacity-60')} />
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className={clsx('divide-y divide-slate-100', loading && hasRows && 'opacity-60 transition-opacity')}>
            {showSkeleton &&
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="td">
                      <div className="h-3.5 animate-pulse rounded bg-slate-100" style={{ width: `${40 + ((i * 17 + c.key.length * 11) % 50)}%` }} />
                    </td>
                  ))}
                </tr>
              ))}
            {hasRows &&
              rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={clsx('group/row transition-colors hover:bg-slate-50/80', onRowClick && 'cursor-pointer')}
                >
                  {columns.map((c) => (
                    <td key={c.key} className={clsx('td', dense && 'py-2', c.align === 'right' && 'text-right', c.align === 'center' && 'text-center', c.sticky && 'sticky right-0 bg-white shadow-[-8px_0_8px_-8px_rgba(20,24,31,0.15)]', c.className)}>
                      {c.render ? c.render(row) : row[c.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {!loading && !error && rows && rows.length === 0 && empty}
      {loading && !rows && <div className="sr-only"><Spinner /></div>}
    </div>
  );
}
