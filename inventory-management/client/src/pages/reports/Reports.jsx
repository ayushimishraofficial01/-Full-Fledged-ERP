import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, BarChart3, FileBarChart } from 'lucide-react';
import { reportService } from '../../services';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { useMeta } from '../../context/MetaContext';
import { Card, DataTable, DateRange, EmptyState, ExportButton, FilterBar, FilterSelect, PageHeader, Pagination, SearchInput, StockStatusBadge, Tabs } from '../../components/ui';
import InventoryFilters from '../../components/inventory/InventoryFilters';
import SummaryTiles from '../../components/inventory/SummaryTiles';
import { formatDate, formatQty, formatTime, rangeToParams } from '../../utils/format';

const TABS = [
  { to: '/reports/stock-in', label: 'Stock In Report', icon: ArrowDownToLine },
  { to: '/reports/stock-out', label: 'Stock Out Report', icon: ArrowUpFromLine },
  { to: '/reports/transfers', label: 'Transfer Report', icon: ArrowLeftRight },
  { to: '/reports/inventory', label: 'Inventory Report', icon: BarChart3 },
];

const dateCol = { key: 'date', header: 'Date', sortKey: 'date', render: (t) => <><span className="block text-slate-900">{formatDate(t.date)}</span><span className="text-xs text-slate-500">{formatTime(t.date)}</span></> };
const productCol = { key: 'product', header: 'Product', render: (t) => <Link to={`/products/${t.product?._id}`} className="font-medium text-slate-900 hover:text-brand-700">{t.product?.name}</Link> };
const skuCol = { key: 'sku', header: 'SKU', render: (t) => <span className="sku">{t.product?.sku}</span> };
const qtyCol = { key: 'quantity', header: 'Quantity', sortKey: 'quantity', align: 'right', render: (t) => <span className="num font-semibold text-slate-900">{formatQty(t.quantity)}</span> };
const unitCol = { key: 'unit', header: 'Unit', render: (t) => t.unit };
const userCol = { key: 'user', header: 'User', render: (t) => t.performedBy?.name };
const dash = <span className="text-slate-300">—</span>;

const CONFIG = {
  'stock-in': {
    title: 'Stock In Report',
    fetch: reportService.stockIn,
    exportUrl: '/export/transactions',
    exportParams: { type: 'STOCK_IN' },
    columns: [dateCol, productCol, skuCol, { key: 'warehouse', header: 'Warehouse', render: (t) => t.warehouse?.name }, qtyCol, unitCol, { key: 'ref', header: 'Reference', render: (t) => t.referenceNumber || dash }, { key: 'supplier', header: 'Supplier', render: (t) => t.supplier || dash }, userCol],
  },
  'stock-out': {
    title: 'Stock Out Report',
    fetch: reportService.stockOut,
    exportUrl: '/export/transactions',
    exportParams: { type: 'STOCK_OUT' },
    columns: [dateCol, productCol, skuCol, { key: 'warehouse', header: 'Warehouse', render: (t) => t.warehouse?.name }, qtyCol, unitCol, { key: 'reason', header: 'Reason', render: (t) => t.reason || dash }, { key: 'ref', header: 'Reference', render: (t) => t.referenceNumber || dash }, userCol],
  },
  transfers: {
    title: 'Transfer Report',
    fetch: reportService.transfers,
    exportUrl: '/export/transfers',
    exportParams: {},
    columns: [dateCol, productCol, skuCol, { key: 'from', header: 'From Warehouse', render: (t) => t.fromWarehouse?.name }, { key: 'to', header: 'To Warehouse', render: (t) => t.toWarehouse?.name }, qtyCol, unitCol, { key: 'ref', header: 'Reference', render: (t) => t.referenceNumber || dash }, userCol],
  },
};

function MovementReport({ type }) {
  const cfg = CONFIG[type];
  const { warehouses } = useMeta();
  const { params, update, setSort, reset } = useListParams({ limit: '25' });
  const apiParams = { ...params, from: undefined, to: undefined, ...rangeToParams(params.from, params.to) };
  const { data, loading, error, reload } = useFetch(() => cfg.fetch(apiParams), [type, JSON.stringify(params)]);
  const filtered = Boolean(params.search || params.warehouse || params.from || params.to);

  return (
    <Card
      padded={false}
      title={cfg.title}
      description={data?.totals ? `${data.totals.count} record(s) · ${data.totals.byUnit.map((u) => `${formatQty(u.quantity)} ${u.unit}`).join(' · ') || 'no quantity'}` : ' '}
      actions={<ExportButton url={cfg.exportUrl} params={{ ...apiParams, ...cfg.exportParams }} size="sm" />}
    >
      <FilterBar showReset={filtered} onReset={reset}>
        <DateRange from={params.from} to={params.to} onChange={(r) => update(r)} />
        <FilterSelect value={params.warehouse} onChange={(v) => update({ warehouse: v })} label="Warehouse" className="lg:w-48">
          <option value="">All warehouses</option>
          {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
        </FilterSelect>
        <SearchInput value={params.search || ''} onChange={(v) => update({ search: v })} placeholder="Product, SKU or reference" className="lg:w-64" />
      </FilterBar>
      <DataTable
        loading={loading}
        error={error}
        onRetry={reload}
        rows={data?.items}
        columns={cfg.columns}
        sort={params.sort || 'date'}
        order={params.order || 'desc'}
        onSort={setSort}
        minWidth={1000}
        empty={<EmptyState icon={FileBarChart} title="No records for this period" description="Adjust the date range or filters." />}
      />
      <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
    </Card>
  );
}

function InventoryReport() {
  const { params, update, setSort, reset } = useListParams({ limit: '25' });
  const { data, loading, error, reload } = useFetch(() => reportService.inventory(params), [JSON.stringify(params)]);
  return (
    <>
      <SummaryTiles summary={data?.summary} loading={loading} />
      <Card padded={false} title="Inventory Report" description="Current stock per product per warehouse" actions={<ExportButton url="/export/inventory" params={params} size="sm" />}>
        <InventoryFilters params={params} update={update} reset={reset} />
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data?.items}
          sort={params.sort || 'product'}
          order={params.order || 'asc'}
          onSort={setSort}
          minWidth={960}
          columns={[
            { key: 'product', header: 'Product', sortKey: 'product', render: (r) => <Link to={`/products/${r.product._id}`} className="font-medium text-slate-900 hover:text-brand-700">{r.product.name}</Link> },
            { key: 'sku', header: 'SKU', sortKey: 'sku', render: (r) => <span className="sku">{r.product.sku}</span> },
            { key: 'warehouse', header: 'Warehouse', sortKey: 'warehouse', render: (r) => r.warehouse.name },
            { key: 'size', header: 'Size', render: (r) => <span className="num">{r.product.size ?? '—'}</span> },
            { key: 'unit', header: 'Unit', render: (r) => r.product.stockUnit },
            { key: 'qty', header: 'Current Stock', sortKey: 'quantity', align: 'right', render: (r) => <span className="num font-semibold text-slate-900">{formatQty(r.quantity)}</span> },
            { key: 'min', header: 'Minimum Stock', sortKey: 'minimumStock', align: 'right', render: (r) => <span className="num">{formatQty(r.product.minimumStock)}</span> },
            { key: 'status', header: 'Status', sortKey: 'status', render: (r) => <StockStatusBadge status={r.status} /> },
          ]}
          empty={<EmptyState icon={BarChart3} title="No inventory records" />}
        />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>
    </>
  );
}

export default function Reports() {
  const { type } = useParams();
  if (!CONFIG[type] && type !== 'inventory') return <Navigate to="/reports/stock-in" replace />;
  return (
    <>
      <PageHeader title="Reports" description="Filter by date, warehouse and product, then export to Excel." breadcrumbs={[{ label: 'Reports' }]} />
      <Tabs items={TABS} />
      {type === 'inventory' ? <InventoryReport key="inv" /> : <MovementReport key={type} type={type} />}
    </>
  );
}
