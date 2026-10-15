import { CalendarRange } from 'lucide-react';

const PRESETS = [
  { label: 'Today', days: 0 },
  { label: '7 days', days: 6 },
  { label: '30 days', days: 29 },
];

const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function DateRange({ from, to, onChange }) {
  const applyPreset = (days) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    onChange({ from: fmt(start), to: fmt(end) });
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 shadow-xs transition-colors focus-within:border-brand-500 focus-within:ring-[3px] focus-within:ring-brand-500/15">
        <CalendarRange className="h-4 w-4 text-slate-400" />
        <input type="date" value={from || ''} max={to || undefined} onChange={(e) => onChange({ from: e.target.value, to })} className="w-[8.6rem] border-0 bg-transparent py-[7px] text-sm focus:outline-none" aria-label="From date" />
        <span className="text-slate-400">–</span>
        <input type="date" value={to || ''} min={from || undefined} onChange={(e) => onChange({ from, to: e.target.value })} className="w-[8.6rem] border-0 bg-transparent py-[7px] text-sm focus:outline-none" aria-label="To date" />
      </div>
      <div className="flex gap-1">
        {PRESETS.map((p) => (
          <button key={p.label} type="button" onClick={() => applyPreset(p.days)} className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-slate-900">
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}
