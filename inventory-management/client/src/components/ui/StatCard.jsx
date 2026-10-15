import clsx from 'clsx';
import { Link } from 'react-router-dom';

const ACCENTS = {
  navy: 'bg-navy-50 text-navy-600',
  blue: 'bg-brand-50 text-brand-600',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  violet: 'bg-violet-50 text-violet-600',
};

/**
 * Standalone metric tile. `bare` renders it without its own surface so several
 * can be grouped inside one shared panel (see StatGroup).
 */
export default function StatCard({ label, value, sub, icon: Icon, accent = 'navy', to, loading, bare = false, size = 'md' }) {
  const tile = Icon && (
    <span className={clsx('flex shrink-0 items-center justify-center rounded-lg', bare ? 'h-8 w-8' : size === 'lg' ? 'h-10 w-10' : 'h-9 w-9', ACCENTS[accent])}>
      <Icon className="h-[17px] w-[17px]" strokeWidth={1.9} />
    </span>
  );
  const valueEl = loading ? (
    <div className="mt-2.5 h-8 w-24 animate-pulse rounded-md bg-slate-100" />
  ) : (
    <p className={clsx('num font-display mt-1.5 font-bold leading-none text-slate-900', size === 'lg' ? 'text-[40px]' : 'text-[26px]')}>{value}</p>
  );
  const body = bare ? (
    // Grouped cell: on wider screens the icon sits on top so the figure always gets the full cell width;
    // on phones it moves beside the text to keep the panel compact.
    <div className="kpi-cell flex h-full flex-row items-center gap-3.5 p-4 sm:flex-col sm:items-start sm:gap-0 sm:p-5">
      {tile}
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500 sm:mt-3">{label}</p>
        {valueEl}
        {sub && <div className="mt-1.5 text-xs leading-snug text-slate-500 sm:mt-2">{sub}</div>}
      </div>
    </div>
  ) : (
    <div className={clsx('card group flex h-full items-start justify-between gap-3 transition-colors hover:border-slate-300', size === 'lg' ? 'p-5 sm:p-6' : 'p-4 sm:p-5')}>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-slate-500">{label}</p>
        {valueEl}
        {sub && <div className="mt-2 text-xs leading-snug text-slate-500">{sub}</div>}
      </div>
      {tile}
    </div>
  );
  return to ? <Link to={to} className={clsx('stat-link block h-full rounded-xl', bare && 'flex items-stretch')}>{body}</Link> : body;
}

/** Several related metrics in one panel, separated by hairlines. */
export function StatGroup({ title, children, className }) {
  return (
    <section className={clsx('card stat-group flex flex-col overflow-hidden', className)}>
      {title && <h2 className="border-b px-5 py-2.5 text-xs font-semibold text-slate-500" style={{ borderColor: 'var(--line-soft)' }}>{title}</h2>}
      <div className="grid flex-1 grid-cols-1 divide-y divide-slate-200/70 sm:auto-cols-fr sm:grid-flow-col sm:divide-x sm:divide-y-0 [&>*]:min-w-0">{children}</div>
    </section>
  );
}
