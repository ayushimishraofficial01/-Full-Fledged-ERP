import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Factory } from 'lucide-react';
import { formatDate, formatQty, formatTime, TX_TYPES } from '../../utils/format';

const ICONS = { STOCK_IN: ArrowDownLeft, STOCK_OUT: ArrowUpRight, TRANSFER_IN: ArrowLeftRight, TRANSFER_OUT: ArrowLeftRight, PRODUCTION_IN: Factory, PRODUCTION_TRANSFER_OUT: Factory, WAREHOUSE_TRANSFER_IN: ArrowLeftRight };
const DOT = {
  STOCK_IN: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  STOCK_OUT: 'bg-red-50 text-red-600 ring-red-200',
  TRANSFER_IN: 'bg-brand-50 text-brand-600 ring-brand-200',
  TRANSFER_OUT: 'bg-violet-50 text-violet-600 ring-violet-200',
  PRODUCTION_IN: 'bg-emerald-50 text-emerald-600 ring-emerald-200',
  PRODUCTION_TRANSFER_OUT: 'bg-violet-50 text-violet-600 ring-violet-200',
  WAREHOUSE_TRANSFER_IN: 'bg-brand-50 text-brand-600 ring-brand-200',
};

/** Day-grouped movement timeline (used on product and warehouse views). */
export default function TransactionTimeline({ items }) {
  const groups = [];
  items.forEach((t) => {
    const key = new Date(t.date).toDateString();
    const g = groups[groups.length - 1];
    if (g && g.key === key) g.items.push(t);
    else groups.push({ key, date: t.date, items: [t] });
  });

  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <div key={g.key}>
          <p className="mb-3 text-xs font-semibold text-slate-500">{formatDate(g.date)}</p>
          <ol className="relative space-y-4 border-l border-slate-200 pl-6">
            {g.items.map((t) => {
              const Icon = ICONS[t.type];
              const meta = TX_TYPES[t.type];
              const positive = meta.sign === '+';
              return (
                <li key={t._id} className="relative">
                  <span className={`absolute -left-[37px] flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-white ${DOT[t.type]}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <p className="text-sm">
                      <span className={`num font-semibold ${positive ? 'text-emerald-700' : 'text-red-700'}`}>
                        {meta.sign}{formatQty(t.quantity)} {t.unit}
                      </span>{' '}
                      <span className="font-medium text-slate-800">{meta.label}</span>
                      <span className="text-slate-500">
                        {' '}· {t.warehouse?.name}
                        {t.counterpartWarehouse && (t.type === 'TRANSFER_OUT' ? ` → ${t.counterpartWarehouse.name}` : ` ← ${t.counterpartWarehouse.name}`)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-500">{formatTime(t.date)} · {t.performedBy?.name}</p>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Balance after: <span className="num font-medium text-slate-700">{formatQty(t.balanceAfter)} {t.unit}</span>
                    {t.referenceNumber && <> · Ref {t.referenceNumber}</>}
                    {t.supplier && <> · {t.supplier}</>}
                    {t.reason && <> · {t.reason}</>}
                  </p>
                  {t.notes && <p className="mt-1 text-xs italic text-slate-500">“{t.notes}”</p>}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
