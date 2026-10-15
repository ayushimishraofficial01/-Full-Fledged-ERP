import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X, ChevronDown, ChevronRight, ArrowLeft, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight } from 'lucide-react';
import { NAV } from './navigation';
import { useAuth } from '../context/AuthContext';
import { useMeta } from '../context/MetaContext';
import { SalesTrackingProvider } from '../context/SalesTrackingContext';
import { ConfirmDialog } from '../components/ui';
import { inventoryService } from '../services';

function readCollapsed() {
  try {
    return localStorage.getItem('ims.sidebar') === 'collapsed';
  } catch {
    return false;
  }
}

/** Visual grouping of the existing top-level navigation items (no items added or removed). */
const SECTION_OF = {
  'Production Stock': 'Operations',
  Products: 'Operations',
  Warehouses: 'Operations',
  Inventory: 'Operations',
  Stock: 'Operations',
  Reports: 'Analysis & sales',
  CRM: 'Analysis & sales',
  Sales: 'Analysis & sales',
  Attendance: 'Operations',
  'HR & Workforce': 'Operations',
  'Excel Import/Export': 'Administration',
  Settings: 'Administration',
  'User & Access': 'Administration',
  Profile: 'Administration',
};

function getPageContext(pathname) {
  const flat = NAV.flatMap((item) => (item.children ? item.children.map((c) => ({ ...c, section: item.label })) : [{ ...item, section: null }]))
    .filter((item) => item.to)
    .sort((left, right) => right.to.length - left.to.length);
  const hit = flat.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  // On nested detail/edit routes (e.g. /products/123) show the parent area rather than a sibling page's name.
  if (hit && hit.section && pathname !== hit.to) return { title: hit.section, section: null };
  return { title: hit?.label || 'Gen Vyro', section: hit?.section || null };
}

function initials(name = '') {
  return name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
}

function Logo({ compact, company }) {
  return (
    <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5 rounded-lg">
      <span className="brand-mark flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px]">
        <img src="/gen-vyro-mark.png" alt="Gen Vyro" className="h-full w-full object-contain" />
      </span>
      {!compact && (
        <span className="min-w-0 leading-tight">
          <span className="brand-title block text-[17px] font-bold">Gen Vyro</span>
            <span className="brand-caption block truncate text-[13px]">{company || 'Inventory Management'}</span>
        </span>
      )}
    </Link>
  );
}

function NavItem({ item, compact, onNavigate, lowStock }) {
  const location = useLocation();
  const childActive = item.children?.some((c) => location.pathname === c.to || (c.to !== '/products' && c.to !== '/warehouses' && c.to !== '/inventory' && location.pathname.startsWith(`${c.to}/`)));
  const [open, setOpen] = useState(Boolean(childActive));

  // Keep the group holding the current page open when navigating into it.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (!item.children) {
    return (
      <NavLink
        to={item.to}
        onClick={onNavigate}
        title={compact ? item.label : undefined}
        className={({ isActive }) =>
          clsx('nav-link group flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-base font-medium transition-colors', isActive && 'is-active', compact && 'justify-center px-0')
        }
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        {!compact && item.label}
      </NavLink>
    );
  }

  if (compact) {
    return (
      <NavLink
        to={item.children[0].to}
        onClick={onNavigate}
        title={item.label}
        className={clsx('nav-link flex justify-center rounded-lg py-2 transition-colors', childActive && 'is-active')}
      >
        <item.icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={clsx('nav-group-btn flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-base font-medium transition-colors', childActive && 'has-active')}
        aria-expanded={open}
      >
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
        <span className="flex-1 text-left">{item.label}</span>
        {item.children.some((c) => c.badge === 'lowStock') && lowStock > 0 && !open && <span className="num h-1.5 w-1.5 rounded-full bg-amber-500" aria-label="Low stock alerts" />}
        <ChevronDown className={clsx('h-4 w-4 text-slate-500 transition-transform duration-200', !open && '-rotate-90')} />
      </button>
      {open && (
        <div className="nav-divider relative ml-[1.3rem] mt-0.5 mb-1 space-y-0.5 border-l pl-3">
          {item.children.map((c) => (
            <NavLink
              key={c.to}
              to={c.to}
              end
              onClick={onNavigate}
              className={({ isActive }) => clsx('nav-sub flex items-center justify-between rounded-md px-2.5 py-2 text-base transition-colors', isActive && 'is-active')}
            >
              {c.label}
              {c.badge === 'lowStock' && lowStock > 0 && <span className="num rounded-full bg-amber-400/20 px-1.5 py-px text-[11px] font-semibold text-amber-300 ring-1 ring-inset ring-amber-400/30">{lowStock}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}

function Sidebar({ compact, onNavigate, onLogout, lowStock }) {
  const { user } = useAuth();
  const { hasPermission } = useAuth();
  const { settings } = useMeta();
  const visibleNav = NAV
    .filter((item) => !item.permission || hasPermission(item.permission))
    .map((item) => item.children ? { ...item, children: item.children.filter((child) => !child.permission || hasPermission(child.permission)) } : item)
    .filter((item) => !item.children || item.children.length > 0);

  let lastSection = null;
  return (
    <div className="app-sidebar flex h-full flex-col">
      <div className={clsx('flex h-16 shrink-0 items-center', compact ? 'justify-center px-2' : 'px-4')}>
        <Logo compact={compact} company={settings.companyName} />
      </div>
      <nav className="scroll-thin flex-1 overflow-y-auto px-3 pb-4 pt-1" aria-label="Main navigation">
        {visibleNav.map((item) => {
          const section = SECTION_OF[item.label] || null;
          const showHeading = section && section !== lastSection;
          lastSection = section || lastSection;
          return (
            <div key={item.label} className={clsx(!section && 'mb-1')}>
              {showHeading && (compact
                ? <div className="nav-footer mx-2 my-3 border-t" />
                : <p className="nav-section mb-1 mt-5 px-2.5 text-[13px] font-semibold">{section}</p>)}
              <div className="mb-0.5"><NavItem item={item} compact={compact} onNavigate={onNavigate} lowStock={lowStock} /></div>
            </div>
          );
        })}
      </nav>
      <div className={clsx('nav-footer border-t p-3', compact && 'px-2')}>
        {!compact && user && (
          <Link to="/profile" onClick={onNavigate} className="mb-1 flex items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/10">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">{initials(user.name)}</span>
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-semibold text-white">{user.name}</span>
              <span className="block truncate text-[13px] text-slate-400">{user.email}</span>
            </span>
          </Link>
        )}
        <button
          type="button"
          onClick={onLogout}
          title="Logout"
          className={clsx('flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-[15px] font-medium text-slate-300 hover:bg-white/10 hover:text-white', compact && 'justify-center px-0')}
        >
          <LogOut className="h-[18px] w-[18px]" strokeWidth={1.8} />
          {!compact && 'Logout'}
        </button>
      </div>
    </div>
  );
}

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [lowStock, setLowStock] = useState(0);
  const { logout, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { title: pageTitle, section } = getPageContext(location.pathname);

  useEffect(() => {
    try {
      localStorage.setItem('ims.sidebar', collapsed ? 'collapsed' : 'expanded');
    } catch {
      /* storage unavailable */
    }
  }, [collapsed]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  // Low-stock count for the sidebar badge, refreshed on navigation.
  useEffect(() => {
    inventoryService.lowStock({ limit: 1 }).then((r) => setLowStock(r.pagination.total)).catch(() => {});
  }, [location.pathname]);

  const doLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const goBack = () => {
    const historyIndex = window.history.state?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) navigate(-1);
    else navigate('/dashboard', { replace: true });
  };

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className={clsx('fixed inset-y-0 left-0 z-30 hidden transition-[width] duration-200 lg:block', collapsed ? 'w-[72px]' : 'w-64')}>
        <Sidebar compact={collapsed} onLogout={() => setConfirmLogout(true)} lowStock={lowStock} />
      </aside>

      {/* Mobile / tablet drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="animate-fade absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} />
          <aside className="animate-drawer absolute inset-y-0 left-0 w-72 max-w-[85vw] shadow-2xl">
            <button type="button" onClick={() => setMobileOpen(false)} className="absolute right-3 top-4 z-10 rounded-lg p-1.5 text-slate-300 hover:bg-white/10" aria-label="Close menu">
              <X className="h-5 w-5" />
            </button>
            <Sidebar onNavigate={() => setMobileOpen(false)} onLogout={() => setConfirmLogout(true)} lowStock={lowStock} />
          </aside>
        </div>
      )}

      <div className={clsx('transition-[padding] duration-200', collapsed ? 'lg:pl-[72px]' : 'lg:pl-64')}>
        <header className="app-header sticky top-0 z-20 flex h-14 items-center gap-2 px-3 sm:px-6">
          <button type="button" onClick={() => setMobileOpen(true)} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden" aria-label="Open menu">
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="hidden rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 lg:inline-flex"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" strokeWidth={1.8} /> : <PanelLeftClose className="h-[18px] w-[18px]" strokeWidth={1.8} />}
          </button>
          <div className="mx-1 hidden h-5 w-px bg-slate-200 sm:block" />
          <div className="flex min-w-0 flex-1 items-center gap-1.5 text-[13.5px]">
            {section && (
              <>
                <span className="hidden truncate text-slate-500 sm:inline">{section}</span>
                <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 text-slate-300 sm:inline" />
              </>
            )}
            <p className="truncate font-semibold text-slate-900">{pageTitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <Link to="/stock/in" className="quick-action in inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors" title="Stock In">
              <ArrowDownToLine className="h-4 w-4" strokeWidth={1.9} /> <span className="hidden md:inline">Stock In</span>
            </Link>
            <Link to="/stock/out" className="quick-action out inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors" title="Stock Out">
              <ArrowUpFromLine className="h-4 w-4" strokeWidth={1.9} /> <span className="hidden md:inline">Stock Out</span>
            </Link>
            <Link to="/stock/transfer" className="quick-action move inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors" title="Transfer">
              <ArrowLeftRight className="h-4 w-4" strokeWidth={1.9} /> <span className="hidden md:inline">Transfer</span>
            </Link>
            {user && (
              <Link to="/profile" title="Profile" aria-label="Open profile" className="ml-1 flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white ring-2 ring-white transition hover:bg-brand-700">
                {initials(user.name)}
              </Link>
            )}
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1480px] px-4 pb-10 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mb-5">
            <button type="button" onClick={goBack} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 text-[13px] font-medium text-slate-700 shadow-xs transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900" aria-label="Go back">
              <ArrowLeft className="h-4 w-4" strokeWidth={1.9} />
              Back
            </button>
          </div>
          <SalesTrackingProvider><Outlet /></SalesTrackingProvider>
        </main>
      </div>

      <ConfirmDialog
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        onConfirm={doLogout}
        tone="info"
        title="Log out?"
        message="You will need to sign in again to access your inventory."
        confirmLabel="Logout"
      />
    </div>
  );
}
