import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapPin, Pencil, Warehouse as WarehouseIcon } from 'lucide-react';
import { inventoryService } from '../../services';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { useMeta } from '../../context/MetaContext';
import { ActiveBadge, Button, Card, EmptyState, ExportButton, PageHeader, Pagination, Select } from '../../components/ui';
import InventoryFilters from '../../components/inventory/InventoryFilters';
import InventoryTable from '../../components/inventory/InventoryTable';
import SummaryTiles from '../../components/inventory/SummaryTiles';

export default function WarehouseStock() {
  const { warehouseId } = useParams();
  const navigate = useNavigate();
  const { warehouses, loaded } = useMeta();
  const { params, update, setSort, reset } = useListParams({ limit: '25' });
  const q = { ...params, warehouse: warehouseId };
  const { data, loading, error, reload } = useFetch(
    () => (warehouseId ? inventoryService.byWarehouse(warehouseId, params) : inventoryService.list({ ...params, withSummary: 'true' })),
    [warehouseId, JSON.stringify(params)]
  );
  const current = warehouses.find((w) => w._id === warehouseId) || data?.warehouse;

  const picker = (
    <Select value={warehouseId || ''} onChange={(e) => navigate(e.target.value ? `/inventory/warehouse/${e.target.value}` : '/inventory/warehouse')} className="w-full sm:w-72" aria-label="Warehouse">
      <option value="">All Warehouses</option>
      {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name} ({w.code})</option>)}
    </Select>
  );

  if (loaded && !warehouses.length) {
    return (
      <>
        <PageHeader title="Warehouse Stock" breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouse Stock' }]} />
        <Card><EmptyState icon={WarehouseIcon} title="No warehouses added yet" action={<Link to="/warehouses/new"><Button>Add Warehouse</Button></Link>} /></Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={current ? current.name : 'Warehouse Stock'}
        description={current ? undefined : 'Pick a warehouse to see only its stock.'}
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Warehouse Stock', to: '/inventory/warehouse' }, ...(current ? [{ label: current.code }] : [])]}
        actions={
          <>
            {picker}
            <ExportButton url="/export/inventory" params={q} />
          </>
        }
      />
      {current && data?.warehouse && (
        <div className="-mt-3 mb-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-slate-500">
          <span className="sku">{current.code}</span>
          <ActiveBadge status={data.warehouse.status} archived={data.warehouse.isArchived} />
          {data.warehouse.city && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{data.warehouse.city}</span>}
          <Link to={`/warehouses/${current._id}/edit`} className="flex items-center gap-1 font-medium text-brand-600 hover:text-brand-700"><Pencil className="h-3.5 w-3.5" />Edit warehouse</Link>
        </div>
      )}
      <SummaryTiles summary={data?.summary} loading={loading} />
      <Card padded={false}>
        <InventoryFilters params={params} update={update} reset={reset} showWarehouse={false} />
        <InventoryTable data={data} loading={loading} error={error} onRetry={reload} params={params} onSort={setSort} showWarehouse={!warehouseId} />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>
    </>
  );
}
