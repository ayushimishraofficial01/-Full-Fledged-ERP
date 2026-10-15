import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatInt } from '../../utils/format';

export default function Pagination({ pagination, onPageChange, onLimitChange, limits = [10, 20, 25, 50, 100] }) {
  if (!pagination || pagination.total === 0) return null;
  const { page, limit, total, totalPages } = pagination;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  const pages = [];
  const add = (p) => pages.push(p);
  const window = 1;
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || Math.abs(p - page) <= window) add(p);
    else if (pages[pages.length - 1] !== '…') add('…');
  }

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-2.5 text-[13px] text-slate-600 sm:flex-row">
      <div className="flex items-center gap-3">
        <span className="num">
          {formatInt(from)}–{formatInt(to)} of {formatInt(total)}
        </span>
        {onLimitChange && (
          <select
            value={limit}
            onChange={(e) => onLimitChange(Number(e.target.value))}
            className="input h-8! min-h-8! w-auto py-1 pl-2 pr-7 text-xs"
            aria-label="Rows per page"
          >
            {limits.map((l) => (
              <option key={l} value={l}>
                {l} / page
              </option>
            ))}
          </select>
        )}
      </div>
      <nav className="flex items-center gap-1" aria-label="Pagination">
        <button type="button" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === '…' ? (
            <span key={`e${i}`} className="px-1.5 text-slate-400">…</span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`num min-w-8 rounded-md px-2 py-1 text-[13px] ${p === page ? 'bg-brand-600 font-semibold text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </button>
          )
        )}
        <button type="button" className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:hover:bg-transparent" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}
