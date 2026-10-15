import { Link } from 'react-router-dom';
import { Package, Warehouse, Boxes, ArrowDownToLine, ArrowUpFromLine, AlertTriangle, ArrowRight, RefreshCw, Plus } from 'lucide-react';
import { dashboardService } from '../services';
import useFetch from '../hooks/useFetch';
import { useAuth } from '../context/AuthContext';
import { Button, Card, DataTable, EmptyState, ErrorState, PageHeader, StatCard, StatGroup, StockStatusBadge, TxTypeBadge, ProductThumb } from '../components/ui';
import { formatInt, formatQty, relativeDay, formatTime, todayParams, sizeLabel, TX_TYPES } from '../utils/format';

function UnitBreakdown({ items }) {
  if (!items?.length) return <span>No movements</span>;
  return <span>{items.slice(0, 3).map((u) => `${formatQty(u.quantity)} ${u.unit}`).join(' · ')}{items.length > 3 ? ' …' : ''}</span>;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useFetch(() => dashboardService.summary(todayParams()), []);
  const c = data?.cards;
  const maxStock = Math.max(1, ...(data?.warehouses || []).map((w) => w.totalStock));

  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${user?.name?.split(' ')[0] || ''}`}
        description={`Here is your inventory at a glance · ${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}`}
        actions={<Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading && Boolean(data)}>Refresh</Button>}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,.8fr)]">
        <StatGroup title="Stock position" className="md:col-span-2 xl:col-span-1">
          <StatCard bare label="Total Products" value={formatInt(c?.totalProducts)} icon={Package} accent="navy" to="/products" loading={!c} sub="Active & inactive, excl. archived" />
          <StatCard bare label="Total Warehouses" value={formatInt(c?.totalWarehouses)} icon={Warehouse} accent="blue" to="/warehouses" loading={!c} sub="Locations holding stock" />
          <StatCard bare label="Total Current Stock" value={formatQty(c?.totalStock)} icon={Boxes} accent="violet" to="/inventory" loading={!c} sub={<UnitBreakdown items={c?.totalStockByUnit} />} />
        </StatGroup>
        <StatGroup title="Today's movement">
          <StatCard bare label="Today's Stock In" value={formatQty(c?.todayStockIn.quantity)} icon={ArrowDownToLine} accent="green" to="/reports/stock-in" loading={!c} sub={c ? <>{c.todayStockIn.count} entr{c.todayStockIn.count === 1 ? 'y' : 'ies'}{c.todayStockIn.byUnit.length > 1 && <> · <UnitBreakdown items={c.todayStockIn.byUnit} /></>}</> : ''} />
          <StatCard bare label="Today's Stock Out" value={formatQty(c?.todayStockOut.quantity)} icon={ArrowUpFromLine} accent="red" to="/reports/stock-out" loading={!c} sub={c ? <>{c.todayStockOut.count} entr{c.todayStockOut.count === 1 ? 'y' : 'ies'}{c.todayStockOut.byUnit.length > 1 && <> · <UnitBreakdown items={c.todayStockOut.byUnit} /></>}</> : ''} />
        </StatGroup>
        <StatGroup title="Needs attention">
          <StatCard bare label="Low Stock Items" value={formatInt(c?.lowStockCount)} icon={AlertTriangle} accent="amber" to="/inventory/low-stock" loading={!c} sub={c ? `${c.outOfStockCount} out of stock` : ''} />
        </StatGroup>
      </div>
      {c && (c.totalStockByUnit.length > 1) && (
        <p className="mt-3 text-xs text-slate-500">
          Totals add quantities across different units ({c.totalStockByUnit.map((u) => u.unit).join(', ')}); see the unit breakdown under each card.
        </p>
      )}

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-5">
        <Card
          className="xl:col-span-3"
          title="Warehouse Stock Summary"
          description="Products in stock and total quantity per warehouse"
          padded={false}
          actions={<Link to="/inventory/warehouse" className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800">View stock <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>}
        >
          <DataTable
            minWidth={520}
            loading={loading}
            rows={data?.warehouses}
            columns={[
              {
                key: 'name',
                header: 'Warehouse',
                render: (w) => (
                  <Link to={`/inventory/warehouse/${w._id}`} className="group">
                    <span className="block font-medium text-slate-900 group-hover:text-brand-700">{w.name}</span>
                    <span className="text-xs text-slate-500">{w.code} · {w.city}</span>
                  </Link>
                ),
              },
              { key: 'products', header: 'Total Products', align: 'right', render: (w) => <span className="num">{formatInt(w.totalProducts)}</span> },
              {
                key: 'stock',
                header: 'Total Stock',
                align: 'right',
                render: (w) => (
                  <div className="flex items-center justify-end gap-3">
                    <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
                      <div className="h-full rounded-full bg-brand-600" style={{ width: `${(w.totalStock / maxStock) * 100}%` }} />
                    </div>
                    <span className="num w-16 font-medium text-slate-900">{formatQty(w.totalStock)}</span>
                  </div>
                ),
              },
              {
                key: 'low',
                header: 'Low',
                align: 'right',
                render: (w) => (w.lowStock ? <span className="num font-medium text-amber-700">{w.lowStock}</span> : <span className="text-slate-400">0</span>),
              },
            ]}
            empty={<EmptyState compact icon={Warehouse} title="No warehouses added yet" description="Add your first warehouse to start tracking stock." action={<Link to="/warehouses/new"><Button icon={Plus}>Add Warehouse</Button></Link>} />}
          />
        </Card>

        <Card
          className="xl:col-span-2"
          title="Low Stock"
          description="Below minimum stock level"
          padded={false}
          actions={<Link to="/inventory/low-stock" className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800">View all <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>}
        >
          {loading && !data ? (
            <div className="space-y-3 p-5">{[1, 2, 3, 4].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-slate-100" />)}</div>
          ) : data?.lowStock?.length ? (
            <ul className="divide-y divide-slate-100">
              {data.lowStock.map((r) => (
                <li key={r._id} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50/80">
                  <ProductThumb product={r.product} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link to={`/products/${r.product._id}`} className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700">{r.product.name}</Link>
                    <p className="truncate text-xs text-slate-500">{r.warehouse.name} · min {formatQty(r.product.minimumStock)}</p>
                  </div>
                  <div className="text-right">
                    <p className="num text-sm font-semibold text-slate-900">{formatQty(r.quantity)} <span className="text-xs font-normal text-slate-500">{r.product.stockUnit}</span></p>
                    <StockStatusBadge status={r.status} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Boxes} title="All stock levels are healthy" description="Nothing is below its minimum stock level." />
          )}
        </Card>
      </div>

      <Card
        className="mt-5"
        title="Recent Transactions"
        description="Latest stock movements across all warehouses"
        padded={false}
        actions={<Link to="/stock/history" className="inline-flex items-center gap-1 rounded-md text-[13px] font-medium text-brand-700 transition-colors hover:text-brand-800">Full history <ArrowRight className="h-3.5 w-3.5" strokeWidth={2} /></Link>}
      >
        <DataTable
          loading={loading}
          rows={data?.recentTransactions}
          minWidth={820}
          columns={[
            { key: 'date', header: 'Date', render: (t) => <><span className="block text-slate-900">{relativeDay(t.date)}</span><span className="text-xs text-slate-500">{formatTime(t.date)}</span></> },
            { key: 'product', header: 'Product', render: (t) => <Link to={`/products/${t.product?._id}`} className="font-medium text-slate-900 hover:text-brand-700">{t.product?.name}<span className="ml-1 text-xs font-normal text-slate-500">{sizeLabel(t.product)}</span></Link> },
            { key: 'warehouse', header: 'Warehouse', render: (t) => t.warehouse?.name },
            { key: 'type', header: 'Type', render: (t) => <TxTypeBadge type={t.type} /> },
            {
              key: 'qty',
              header: 'Quantity',
              align: 'right',
              render: (t) => (
                <span className={`num font-semibold ${TX_TYPES[t.type].sign === '+' ? 'text-emerald-700' : 'text-red-700'}`}>
                  {TX_TYPES[t.type].sign}{formatQty(t.quantity)}
                </span>
              ),
            },
            { key: 'unit', header: 'Unit', render: (t) => t.unit },
            { key: 'user', header: 'User', render: (t) => t.performedBy?.name },
          ]}
          empty={<EmptyState compact icon={ArrowDownToLine} title="No transactions available" description="Record your first Stock In to see activity here." action={<Link to="/stock/in"><Button icon={ArrowDownToLine}>Stock In</Button></Link>} />}
        />
      </Card>
    </>
  );
}
