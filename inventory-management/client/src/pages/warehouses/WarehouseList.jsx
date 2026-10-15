import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Boxes, Warehouse as WarehouseIcon, RotateCcw, MapPin, Phone } from 'lucide-react';
import { warehouseService } from '../../services';
import { parseError } from '../../services/api';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { ActiveBadge, Button, Card, ConfirmDialog, DataTable, EmptyState, ExportButton, FilterBar, FilterSelect, PageHeader, Pagination, SearchInput } from '../../components/ui';
import { formatInt, formatQty } from '../../utils/format';

export default function WarehouseList() {
  const toast = useToast();
  const { refreshWarehouses } = useMeta();
  const { params, update, setSort, reset } = useListParams({ limit: '20' });
  const { data, loading, error, reload } = useFetch(() => warehouseService.list(params), [JSON.stringify(params)]);
  const [toDelete, setToDelete] = useState(null);
  const [busy, setBusy] = useState(false);
  const filtered = Boolean(params.search || params.status || params.archived);

  const doDelete = async () => {
    setBusy(true);
    try {
      const res = await warehouseService.remove(toDelete._id);
      toast.success(res.message);
      setToDelete(null);
      reload();
      refreshWarehouses();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const restore = async (w) => {
    try {
      const res = await warehouseService.restore(w._id);
      toast.success(res.message);
      reload();
      refreshWarehouses();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  return (
    <>
      <PageHeader
        title="All Warehouses"
        description="Each warehouse keeps its own independent stock."
        breadcrumbs={[{ label: 'Warehouses' }]}
        actions={
          <>
            <ExportButton url="/export/warehouses" params={params} />
            <Link to="/warehouses/new"><Button icon={Plus}>Add Warehouse</Button></Link>
          </>
        }
      />
      <Card padded={false}>
        <FilterBar showReset={filtered} onReset={reset}>
          <SearchInput value={params.search || ''} onChange={(v) => update({ search: v })} placeholder="Search name, code or city" className="lg:w-72" />
          <FilterSelect value={params.archived === 'only' ? 'archived' : params.status} onChange={(v) => update(v === 'archived' ? { archived: 'only', status: '' } : { status: v, archived: '' })} label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </FilterSelect>
        </FilterBar>
        <DataTable
          loading={loading}
          error={error}
          onRetry={reload}
          rows={data?.items}
          sort={params.sort || 'name'}
          order={params.order || 'asc'}
          onSort={setSort}
          minWidth={1000}
          columns={[
            {
              key: 'name',
              header: 'Warehouse',
              sortKey: 'name',
              render: (w) => (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600"><WarehouseIcon className="h-4.5 w-4.5" /></span>
                  <div>
                    <span className="block font-medium text-slate-900">{w.name}</span>
                    <span className="text-xs text-slate-500">{w.location}</span>
                  </div>
                </div>
              ),
            },
            { key: 'code', header: 'Code', sortKey: 'code', render: (w) => <span className="sku">{w.code}</span> },
            {
              key: 'address',
              header: 'Address',
              sortKey: 'city',
              className: 'whitespace-normal',
              render: (w) => (
                <div className="max-w-[240px] text-[13px]">
                  <span className="flex items-start gap-1 text-slate-700"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{[w.city, w.state, w.pincode].filter(Boolean).join(', ')}</span>
                  {w.address && <span className="mt-0.5 block truncate text-xs text-slate-500">{w.address}</span>}
                </div>
              ),
            },
            {
              key: 'contact',
              header: 'Contact',
              render: (w) =>
                w.contactPerson || w.contactNumber ? (
                  <div className="text-[13px]">
                    <span className="block text-slate-700">{w.contactPerson || '—'}</span>
                    {w.contactNumber && <a href={`tel:${w.contactNumber}`} className="flex items-center gap-1 text-xs text-slate-500 hover:text-brand-700"><Phone className="h-3 w-3" />{w.contactNumber}</a>}
                  </div>
                ) : (
                  <span className="text-slate-300">—</span>
                ),
            },
            { key: 'products', header: 'Products', sortKey: 'totalProducts', align: 'right', render: (w) => <span className="num">{formatInt(w.totalProducts)}</span> },
            { key: 'stock', header: 'Total Stock', sortKey: 'totalStock', align: 'right', render: (w) => <span className="num font-semibold text-slate-900">{formatQty(w.totalStock)}</span> },
            { key: 'low', header: 'Low', align: 'right', render: (w) => (w.lowStock ? <span className="num font-medium text-amber-700">{w.lowStock}</span> : <span className="text-slate-300">0</span>) },
            { key: 'status', header: 'Status', sortKey: 'status', render: (w) => <ActiveBadge status={w.status} archived={w.isArchived} /> },
            {
              key: 'actions',
              sticky: true,
              header: <span className="sr-only">Actions</span>,
              align: 'right',
              render: (w) =>
                w.isArchived ? (
                  <Button size="xs" variant="secondary" icon={RotateCcw} onClick={() => restore(w)}>Restore</Button>
                ) : (
                  <div className="flex justify-end gap-0.5">
                    <Link to={`/inventory/warehouse/${w._id}`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="View stock" aria-label="View stock"><Boxes className="h-4 w-4" /></Link>
                    <Link to={`/warehouses/${w._id}/edit`} className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Edit" aria-label="Edit"><Pencil className="h-4 w-4" /></Link>
                    <button type="button" onClick={() => setToDelete(w)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" title="Delete" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ),
            },
          ]}
          empty={
            filtered ? (
              <EmptyState icon={WarehouseIcon} title="No warehouses match your filters" action={<Button variant="secondary" onClick={reset}>Clear filters</Button>} />
            ) : (
              <EmptyState icon={WarehouseIcon} title="No warehouses added yet" description="Add a warehouse to start receiving stock." action={<Link to="/warehouses/new"><Button icon={Plus}>Add Warehouse</Button></Link>} />
            )
          }
        />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={toDelete?.totalStock > 0 ? () => setToDelete(null) : doDelete}
        loading={busy}
        tone={toDelete?.totalStock > 0 ? 'info' : 'danger'}
        title={toDelete?.totalStock > 0 ? 'Warehouse still holds stock' : `Delete ${toDelete?.name}?`}
        confirmLabel={toDelete?.totalStock > 0 ? 'OK' : 'Delete Warehouse'}
        message={
          toDelete?.totalStock > 0
            ? `${toDelete.name} holds ${formatQty(toDelete.totalStock)} units across ${toDelete.totalProducts} product(s). Transfer or stock out everything first so no inventory is lost.`
            : 'If this warehouse has any stock history it will be archived (history is kept and it can be restored). Otherwise it will be permanently deleted.'
        }
      />
    </>
  );
}
