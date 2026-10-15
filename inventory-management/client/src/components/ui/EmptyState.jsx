import { PackageOpen, AlertOctagon } from 'lucide-react';
import Button from './Button';

export default function EmptyState({ icon: Icon = PackageOpen, title, description, action, compact = false }) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 text-center ${compact ? 'py-10' : 'py-16'}`}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500 ring-1 ring-slate-200">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h3 className="font-display text-[15px] font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-red-100">
        <AlertOctagon className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <h3 className="text-sm font-semibold text-slate-900">Could not load data</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message || 'Something went wrong.'}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
