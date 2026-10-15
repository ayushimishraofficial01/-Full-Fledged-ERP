import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

export default function PageHeader({ title, description, breadcrumbs = [], actions }) {
  return (
    <div className="page-heading mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumbs.some((b) => b.to) && (
          <nav className="mb-2 flex flex-wrap items-center gap-1 text-xs font-medium text-slate-500" aria-label="Breadcrumb">
            {breadcrumbs.map((b, i) => (
              <span key={b.label} className="flex items-center gap-1">
                {b.to ? <Link to={b.to} className="rounded transition-colors hover:text-brand-700">{b.label}</Link> : <span>{b.label}</span>}
                {i < breadcrumbs.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              </span>
            ))}
          </nav>
        )}
        <h1 className="truncate text-2xl font-bold leading-tight sm:text-[26px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-base leading-6 text-slate-500">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
