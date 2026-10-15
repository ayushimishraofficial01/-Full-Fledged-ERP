import { RotateCcw } from 'lucide-react';
import Button from './Button';

/** Row of search + filter controls above a table; wraps nicely on mobile. */
export default function FilterBar({ children, onReset, showReset }) {
  return (
    <div className="grid grid-cols-1 gap-2.5 border-b border-slate-200/80 bg-slate-50/70 p-3.5 sm:grid-cols-2 sm:p-4 xl:grid-cols-6 xl:items-center">
      {children}
      {showReset && onReset && (
        <Button variant="ghost" size="sm" icon={RotateCcw} onClick={onReset} className="sm:col-span-2 sm:justify-self-end xl:col-span-6">
          Reset filters
        </Button>
      )}
    </div>
  );
}

export function FilterSelect({ value, onChange, children, label, className = '' }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={`input min-w-0 w-full ${className}`} aria-label={label}>
      {children}
    </select>
  );
}
