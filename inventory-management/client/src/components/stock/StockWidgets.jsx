import { Link } from 'react-router-dom';
import { CheckCircle2, ArrowRight } from 'lucide-react';
import { Button, Input, Spinner, StockStatusBadge } from '../ui';
import { formatQty } from '../../utils/format';

export function AvailableBox({ label = 'Available', state, warehouseName }) {
  if (!state || (!state.loading && state.quantity === null)) return null;
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm">
      <span className="text-slate-600">{label}{warehouseName ? ` in ${warehouseName}` : ''}</span>
      {state.loading ? (
        <Spinner className="h-4 w-4 text-slate-400" />
      ) : (
        <span className="flex items-center gap-2">
          <span className="num font-semibold text-slate-900">{formatQty(state.quantity)} {state.unit}</span>
          <StockStatusBadge status={state.status} />
        </span>
      )}
    </div>
  );
}

export function QuantityInput({ value, onChange, unit, error, id, max }) {
  return (
    <div className="flex">
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min="0"
        step="any"
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        className="num rounded-r-none text-base font-medium"
        placeholder="0"
      />
      <span className="inline-flex min-w-16 items-center justify-center rounded-r-lg border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-600" title="Stock unit of the product">
        {unit || 'Unit'}
      </span>
    </div>
  );
}

export function BalancePreview({ before, change, unit, sign }) {
  if (before === null || before === undefined || !change || Number.isNaN(Number(change))) return null;
  const after = sign === '+' ? Number(before) + Number(change) : Number(before) - Number(change);
  const bad = after < 0;
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm ${bad ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand-800'}`}>
      <span className="num">{formatQty(before)}</span>
      <span>{sign === '+' ? '+' : '−'}</span>
      <span className="num">{formatQty(change)}</span>
      <ArrowRight className="h-4 w-4" />
      <span className="num font-semibold">{formatQty(after)} {unit}</span>
      {bad && <span className="w-full text-xs font-medium">Insufficient stock. Available quantity is {formatQty(before)}.</span>}
    </div>
  );
}

export function SuccessPanel({ title, lines, onAgain, againLabel, links = [] }) {
  return (
    <div className="card animate-pop p-6 text-center sm:p-8">
      <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><CheckCircle2 className="h-6 w-6" /></span>
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
        {lines.map((l) => (
          <div key={l.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3.5 py-2.5 text-sm">
            <span className="text-slate-600">{l.label}</span>
            <span className="num font-medium text-slate-900">{l.value}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button onClick={onAgain}>{againLabel}</Button>
        {links.map((l) => <Link key={l.to} to={l.to}><Button variant="secondary">{l.label}</Button></Link>)}
      </div>
    </div>
  );
}

export function validateQty(v, { max } = {}) {
  if (v === '' || v === null || v === undefined) return 'Quantity is required';
  const n = Number(v);
  if (Number.isNaN(n)) return 'Quantity must be a number';
  if (n <= 0) return 'Quantity must be greater than 0';
  if (Math.abs(n * 1000 - Math.round(n * 1000)) > 1e-6) return 'Use at most 3 decimal places';
  if (max !== undefined && max !== null && n > max + 1e-9) return `Insufficient stock. Available quantity is ${formatQty(max)}.`;
  return '';
}
