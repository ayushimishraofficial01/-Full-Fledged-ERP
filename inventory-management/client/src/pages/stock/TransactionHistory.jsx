import { Link } from 'react-router-dom';
import { History } from 'lucide-react';
import { stockService } from '../../services';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { useMeta } from '../../context/MetaContext';
import { Card, DataTable, DateRange, EmptyState, ExportButton, FilterBar, FilterSelect, PageHeader, Pagination, SearchInput, TxTypeBadge } from '../../components/ui';
import ProductFilter from '../../components/stock/ProductFilter';
import { formatDate, formatQty, formatTime, rangeToParams, sizeLabel, TX_TYPES } from '../../utils/format';

export default function TransactionHistory() {
  const { warehouses } = useMeta();
  const { params, update, setSort, reset } = useListParams({ limit: '25' });
  const apiParams = { ...params, from: undefined, to: undefined, ...rangeToParams(params.from, params.to), withTotals: 'true' };
  const { data, loading, error, reload } = useFetch(() => stockService.transactions(apiParams), [JSON.stringify(params)]);
  const filtered = Boolean(params.search || params.warehouse || params.product || params.type || params.from || params.to);

  return (
    <>
      <PageHeader
        title="Transaction History"
        description="Immutable ledger of every stock movement."
        breadcrumbs={[{ label: 'Stock' }, { label: 'Transaction History' }]}
        actions={<ExportButton url="/export/transactions" params={apiParams} />}
      />
      <Card padded={false}>
        <FilterBar showReset={filtered} onReset={reset}>
          <DateRange from={params.from} to={params.to} onChange={(r) => update(r)} />
          <FilterSelect value={params.type} onChange={(v) => update({ type: v })} label="Transaction type">
            <option value="">All types</option>
            {Object.entries(TX_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </FilterSelect>
          <FilterSelect value={params.warehouse} onChange={(v) => update({ warehouse: v })} label="Warehouse" className="lg:w-48">
            <option value="">All warehouses</option>
            {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
          </FilterSelect>
          <ProductFilter productId={params.product} onChange={(id) => update({ product: id })} />
          <SearchInput value={params.search || ''} onChange={(v) => update({ search: v })} placeholder="Reference, customer, product" className="lg:w-56" />
        </FilterBar>
        {data?.totals && data.totals.count > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 border-b border-slate-100 bg-slate-50/60 px-4 py-2 text-xs text-slate-600">
            <span><span className="num font-semibold text-slate-900">{data.totals.count}</span> movements</span>
            {data.totals.byUnit.map((u) => <span key={u.unit}>Volume: <span className="num font-semibold text-slate-900">{formatQty(u.quantity)}</span> {u.unit}</span>)}
          </div>
        )}
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data?.items}
          sort={params.sort || 'date'}
          order={params.order || 'desc'}
          onSort={setSort}
          minWidth={1200}
          columns={[
            { key: 'date', header: 'Date', sortKey: 'date', render: (t) => <><span className="block text-slate-900">{formatDate(t.date)}</span><span className="text-xs text-slate-500">{formatTime(t.date)}</span></> },
            { key: 'product', header: 'Product', render: (t) => <Link to={`/products/${t.product?._id}`} className="font-medium text-slate-900 hover:text-brand-700">{t.product?.name} <span className="text-xs font-normal text-slate-500">{sizeLabel(t.product)}</span></Link> },
            { key: 'sku', header: 'SKU', render: (t) => <span className="sku">{t.product?.sku}</span> },
            {
              key: 'warehouse',
              header: 'Warehouse',
              render: (t) => (
                <div>
                  <span className="block">{t.warehouse?.name}</span>
                  {t.counterpartWarehouse && <span className="text-xs text-slate-500">{t.type === 'TRANSFER_OUT' ? 'to' : 'from'} {t.counterpartWarehouse.name}</span>}
                </div>
              ),
            },
            { key: 'type', header: 'Type', render: (t) => <TxTypeBadge type={t.type} /> },
            {
              key: 'quantity',
              header: 'Quantity',
              sortKey: 'quantity',
              align: 'right',
              render: (t) => <span className={`num font-semibold ${TX_TYPES[t.type].sign === '+' ? 'text-emerald-700' : 'text-red-700'}`}>{TX_TYPES[t.type].sign}{formatQty(t.quantity)}</span>,
            },
            { key: 'unit', header: 'Unit', render: (t) => t.unit },
            { key: 'balance', header: 'Balance', align: 'right', render: (t) => <span className="num text-slate-500">{formatQty(t.balanceAfter)}</span> },
            { key: 'ref', header: 'Reference', render: (t) => t.referenceNumber || <span className="text-slate-300">—</span> },
            { key: 'customer', header: 'Customer', render: (t) => t.customerName || t.customer?.fullName || <span className="text-slate-300">—</span> },
            { key: 'detail', header: 'Supplier / Reason', className: 'max-w-[200px] truncate', render: (t) => t.supplier || t.reason || (t.notes ? <span className="italic text-slate-500">{t.notes}</span> : <span className="text-slate-300">—</span>) },
            { key: 'user', header: 'User', render: (t) => t.performedBy?.name },
          ]}
          empty={<EmptyState icon={History} title="No transactions available" description={filtered ? 'No movements match these filters.' : 'Stock movements will appear here.'} />}
        />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>
    </>
  );
}
