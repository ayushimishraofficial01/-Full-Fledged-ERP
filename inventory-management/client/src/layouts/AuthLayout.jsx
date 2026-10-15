import { Outlet } from 'react-router-dom';
import { Boxes, ArrowLeftRight, ShieldCheck } from 'lucide-react';

export default function AuthLayout() {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <div className="auth-showcase relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Quiet stock-grid texture: shelving bays, not decoration for its own sake */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:56px_56px]" />
        <div className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -bottom-40 -left-40 h-[28rem] w-[28rem] rounded-full border border-white/[0.06]" />
        <div className="relative flex items-center gap-3">
          <span className="brand-mark flex h-10 w-10 items-center justify-center rounded-xl">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round">
              <path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" />
              <path d="M4 7.5 12 12l8-4.5M12 12v9" />
            </svg>
          </span>
          <span className="font-display text-lg font-bold text-white">Gen Vyro</span>
        </div>
        <div className="relative max-w-md">
          <h2 className="font-display max-w-lg text-4xl font-bold leading-[1.1] text-white xl:text-[44px]">Every unit, in every warehouse, accounted for.</h2>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-navy-200">
            Track stock across locations, move it between warehouses and keep a complete audit trail of every movement.
          </p>
          <ul className="mt-9 space-y-3.5 text-sm text-navy-100">
            {[
              [Boxes, 'Warehouse-wise stock with low-stock alerts'],
              [ArrowLeftRight, 'Atomic transfers that never lose or duplicate stock'],
              [ShieldCheck, 'Full transaction history with who did what, when'],
            ].map(([Icon, text]) => (
              <li key={text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.07] ring-1 ring-white/10">
                  <Icon className="h-4 w-4 text-brand-300" strokeWidth={1.8} />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-navy-300">© {new Date().getFullYear()} Gen Vyro</p>
      </div>
      <div className="flex items-center justify-center bg-canvas px-5 py-10 sm:px-10 lg:px-12">
        <div className="login-panel w-full max-w-[440px] px-6 py-8 sm:px-9 sm:py-10">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
