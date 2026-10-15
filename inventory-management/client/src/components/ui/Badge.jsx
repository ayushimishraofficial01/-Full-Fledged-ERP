import clsx from 'clsx';
import { STOCK_STATUS, TX_TYPES } from '../../utils/format';
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Factory } from 'lucide-react';

const TONES = {
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-600/20',
  amber: 'bg-amber-50 text-amber-800 ring-amber-600/25',
  red: 'bg-red-50 text-red-800 ring-red-600/20',
  blue: 'bg-brand-50 text-brand-700 ring-brand-600/20',
  violet: 'bg-violet-50 text-violet-800 ring-violet-600/20',
  slate: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  navy: 'bg-navy-50 text-navy-700 ring-navy-600/20',
};
const DOTS = { green: 'bg-emerald-500', amber: 'bg-amber-500', red: 'bg-red-500', blue: 'bg-brand-500', violet: 'bg-violet-500', slate: 'bg-slate-400', navy: 'bg-navy-500' };

export default function Badge({ tone = 'slate', dot = false, className, children }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', TONES[tone], className)}>
      {dot && <span className={clsx('h-1.5 w-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  );
}

export function StockStatusBadge({ status }) {
  const s = STOCK_STATUS[status];
  if (!s) return null;
  return <Badge tone={s.tone} dot>{s.label}</Badge>;
}

export function ActiveBadge({ status, archived }) {
  if (archived) return <Badge tone="slate">Archived</Badge>;
  return status === 'active' ? <Badge tone="green" dot>Active</Badge> : <Badge tone="slate" dot>Inactive</Badge>;
}

const TX_ICONS = { STOCK_IN: ArrowDownLeft, STOCK_OUT: ArrowUpRight, TRANSFER_IN: ArrowLeftRight, TRANSFER_OUT: ArrowLeftRight, PRODUCTION_IN: Factory, PRODUCTION_TRANSFER_OUT: Factory, WAREHOUSE_TRANSFER_IN: ArrowLeftRight };

export function TxTypeBadge({ type }) {
  const t = TX_TYPES[type];
  if (!t) return null;
  const Icon = TX_ICONS[type];
  return (
    <Badge tone={t.tone}>
      <Icon className="h-3 w-3" strokeWidth={2.2} />
      {t.label}
    </Badge>
  );
}
