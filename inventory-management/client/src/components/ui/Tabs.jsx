import { NavLink } from 'react-router-dom';
import clsx from 'clsx';

/** Route-driven tabs. items: [{ to, label, icon? }] */
export default function Tabs({ items }) {
  return (
    <div className="scroll-thin -mx-1 mb-5 overflow-x-auto">
      <div className="inline-flex min-w-full gap-1 border-b border-slate-200 px-1">
        {items.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end
            className={({ isActive }) =>
              clsx(
                '-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                isActive ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
              )
            }
          >
            {t.icon && <t.icon className="h-4 w-4" />}
            {t.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
