import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BarChart3, Boxes, Factory, FileSpreadsheet, Menu, Package, ShieldCheck, Users, Warehouse, ArrowLeftRight, AlertTriangle, X, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: Boxes, title: 'Live stock, warehouse by warehouse', text: 'See exactly what you hold in every location, with minimum-stock levels and low-stock alerts that surface before you run out.' },
  { icon: ArrowLeftRight, title: 'Stock in, out and transfers', text: 'Record receipts, issues and warehouse-to-warehouse transfers. Every movement is logged with who did it and when.' },
  { icon: Factory, title: 'Production tracking', text: 'Log what you manufacture, keep production stock separate, and transfer finished goods to the warehouse when ready.' },
  { icon: BarChart3, title: 'Reports you can export', text: 'Stock in, stock out, transfer and production reports with date filters, ready to download to Excel.' },
  { icon: FileSpreadsheet, title: 'Excel import and export', text: 'Bring your product list in from a spreadsheet and take your data out again whenever you need it.' },
  { icon: Users, title: 'Built-in CRM', text: 'Customers, leads, contacts, follow-ups, tasks and sample dispatches alongside your inventory.' },
];

const MODULES = ['Dashboard', 'Production', 'Products', 'Warehouses', 'Current stock', 'Low stock', 'Stock in / out', 'Transfers', 'Transaction history', 'Reports', 'Excel import / export', 'CRM', 'User & access', 'Settings'];

function Logo({ light = false }) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="brand-mark flex h-9 w-9 items-center justify-center rounded-[10px]">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round">
          <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
          <path d="M4 7.5 12 12l8-4.5M12 12v9" />
        </svg>
      </span>
      <span className={`font-display text-[17px] font-bold ${light ? 'text-white' : 'text-slate-900'}`}>Gen Vyro</span>
    </span>
  );
}

/** Static illustration of the product UI (sample figures, not live data). */
function ProductPreview() {
  const rows = [
    ['Product 1', 'P001', '12,400', 'In Stock', 'green'],
    ['Product 2', 'P002', '640', 'Low Stock', 'amber'],
    ['Product 3', 'P003', '3,300', 'In Stock', 'green'],
    ['Product 4', 'P004', '0', 'Out of Stock', 'red'],
  ];
  const tone = { green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20', amber: 'bg-amber-50 text-amber-800 ring-amber-600/25', red: 'bg-red-50 text-red-700 ring-red-600/20' };
  return (
    <div className="relative mx-auto w-full max-w-5xl" aria-hidden="true">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center gap-1.5 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span className="h-2.5 w-2.5 rounded-full bg-slate-300" />
          <span className="ml-3 hidden rounded-md bg-white px-3 py-0.5 text-[11px] text-slate-400 ring-1 ring-slate-200 sm:block">app.genvyro / dashboard</span>
        </div>
        <div className="grid grid-cols-[3.25rem_1fr] sm:grid-cols-[11rem_1fr]">
          <div className="space-y-1.5 bg-navy-900 p-3">
            {['Dashboard', 'Products', 'Warehouses', 'Inventory', 'Stock', 'Reports'].map((t, i) => (
              <div key={t} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium ${i === 0 ? 'bg-brand-600 text-white' : 'text-slate-400'}`}>
                <span className="h-3 w-3 shrink-0 rounded-sm bg-current opacity-60" /> <span className="hidden sm:inline">{t}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 bg-canvas p-3 sm:p-5">
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[['Products', '278'], ['Total stock', '89,290'], ['Low stock', '4']].map(([l, v]) => (
                <div key={l} className="rounded-lg border border-slate-200 bg-white p-2.5 sm:p-3.5">
                  <p className="text-[10px] font-medium text-slate-500 sm:text-xs">{l}</p>
                  <p className="font-display mt-1 text-base font-bold text-slate-900 sm:text-xl">{v}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white sm:mt-4">
              {rows.map(([n, s, q, st, t]) => (
                <div key={s} className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2 last:border-0 sm:px-4 sm:py-2.5">
                  <div className="min-w-0"><p className="truncate text-[11px] font-medium text-slate-800 sm:text-[13px]">{n}</p><p className="font-mono text-[10px] text-slate-400">{s}</p></div>
                  <div className="flex shrink-0 items-center gap-2 sm:gap-4"><span className="num text-[11px] font-semibold text-slate-800 sm:text-[13px]">{q}</span><span className={`rounded-md px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset sm:text-xs ${tone[t]}`}>{st}</span></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs text-slate-400">Illustration with sample data</p>
    </div>
  );
}

export default function Landing() {
  const { isAuthenticated } = useAuth();
  const [open, setOpen] = useState(false);
  const cta = isAuthenticated ? { to: '/dashboard', label: 'Open dashboard' } : { to: '/login', label: 'Login' };
  const links = [['Features', '#features'], ['Modules', '#modules'], ['Why Gen Vyro', '#why']];

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link to="/" aria-label="Gen Vyro home"><Logo /></Link>
          <nav className="hidden items-center gap-8 md:flex" aria-label="Site">
            {links.map(([l, h]) => <a key={l} href={h} className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900">{l}</a>)}
          </nav>
          <div className="flex items-center gap-2">
            <Link to={cta.to} className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700">{cta.label}</Link>
            <button type="button" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Toggle menu" aria-expanded={open}>
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="animate-fade border-t border-slate-100 bg-white px-5 py-3 md:hidden" aria-label="Site mobile">
            {links.map(([l, h]) => <a key={l} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{l}</a>)}
          </nav>
        )}
      </header>

      <main>
        <section className="relative overflow-hidden border-b border-slate-100 bg-gradient-to-b from-brand-50/70 to-white">
          <div className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(var(--color-slate-200)_1px,transparent_1px),linear-gradient(90deg,var(--color-slate-200)_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_75%)]" />
          <div className="relative mx-auto max-w-6xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
            <div className="mx-auto max-w-3xl text-center">
              <p className="mx-auto inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-brand-700 ring-1 ring-brand-200"><Package className="h-3.5 w-3.5" /> Inventory, production and CRM in one place</p>
              <h1 className="font-display mt-6 text-4xl font-bold leading-[1.08] text-slate-900 sm:text-6xl">Know what you have, <span className="text-brand-600">everywhere you keep it.</span></h1>
              <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">Gen Vyro keeps your products, warehouses, stock movements and production in sync, with a complete history of every change, so your team always works from the same numbers.</p>
              <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link to={cta.to} className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-600 px-6 text-[15px] font-medium text-white shadow-sm transition-colors hover:bg-brand-700">{cta.label} <ArrowRight className="h-4 w-4" /></Link>
                <a href="#features" className="inline-flex h-11 items-center rounded-lg border border-slate-300 bg-white px-6 text-[15px] font-medium text-slate-800 transition-colors hover:bg-slate-50">See what it does</a>
              </div>
            </div>
            <div className="mt-14 sm:mt-20"><ProductPreview /></div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-brand-600">Features</p>
            <h2 className="font-display mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">Everything your stock room needs, nothing it doesn't.</h2>
          </div>
          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div key={title}>
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-brand-100"><Icon className="h-5 w-5" strokeWidth={1.8} /></span>
                <h3 className="font-display mt-4 text-[17px] font-semibold text-slate-900">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="modules" className="scroll-mt-16 border-y border-slate-100 bg-slate-50">
          <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1fr_1.4fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold text-brand-600">Modules</p>
              <h2 className="font-display mt-2 text-3xl font-bold text-slate-900">One workspace, every part of the operation.</h2>
              <p className="mt-4 text-[15px] leading-7 text-slate-600">From the first purchase entry to the final dispatch, each step lives in its own module and feeds the same stock figures.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {MODULES.map((m) => <span key={m} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-xs">{m}</span>)}
            </div>
          </div>
        </section>

        <section id="why" className="scroll-mt-16 mx-auto max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="grid gap-10 lg:grid-cols-3">
            {[
              [ShieldCheck, 'A trail for every movement', 'Each stock change records the product, quantity, warehouse, user and time, so nothing happens without a record.'],
              [Warehouse, 'Separate stock per warehouse', 'Every location keeps its own independent quantity, and transfers move stock between them without losing or duplicating units.'],
              [AlertTriangle, 'Warnings before shortages', 'Set a minimum level per product and see low and out-of-stock items on the dashboard and in their own list.'],
            ].map(([Icon, t, d]) => (
              <div key={t} className="rounded-2xl border border-slate-200 p-6">
                <Icon className="h-6 w-6 text-brand-600" strokeWidth={1.8} />
                <h3 className="font-display mt-4 text-lg font-semibold">{t}</h3>
                <p className="mt-2 text-[15px] leading-7 text-slate-600">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-16 sm:px-8 sm:pb-24">
          <div className="mx-auto max-w-6xl overflow-hidden rounded-3xl bg-navy-900 px-6 py-14 text-center sm:px-12">
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-bold text-white sm:text-4xl">Ready to see your stock clearly?</h2>
            <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-navy-200">Sign in with your email or phone number, or continue with Google.</p>
            <Link to={cta.to} className="mt-8 inline-flex h-11 items-center gap-2 rounded-lg bg-white px-6 text-[15px] font-semibold text-navy-900 transition-colors hover:bg-slate-100">{cta.label} <ArrowRight className="h-4 w-4" /></Link>
            <ul className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-navy-200">
              {['Email or phone login', 'Google sign-in', 'Works on desktop and mobile'].map((t) => <li key={t} className="flex items-center gap-1.5"><Check className="h-4 w-4 text-brand-300" /> {t}</li>)}
            </ul>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <Logo />
          <p className="text-sm text-slate-500">© {new Date().getFullYear()} Gen Vyro</p>
        </div>
      </footer>
    </div>
  );
}
