import { AlertTriangle } from 'lucide-react';
import { inventoryService } from '../../services';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { Card, EmptyState, ExportButton, PageHeader, Pagination } from '../../components/ui';
import InventoryFilters from '../../components/inventory/InventoryFilters';
import InventoryTable from '../../components/inventory/InventoryTable';

export default function LowStock() {
  const { params, update, setSort, reset } = useListParams({ limit: '25' });
  const q = { ...params, stockStatus: params.stockStatus || 'LOW_OR_OUT', sort: params.sort || 'status', order: params.order || 'asc' };
  const { data, loading, error, reload } = useFetch(() => inventoryService.list(q), [JSON.stringify(q)]);

  return (
    <>
      <PageHeader
        title="Low Stock"
        description="Stock records below the product's minimum stock level. Out-of-stock items are listed first."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Low Stock' }]}
        actions={<ExportButton url="/export/inventory" params={q} />}
      />
      <Card padded={false}>
        <InventoryFilters params={params} update={update} reset={reset} lowOnly />
        <InventoryTable
          data={data}
          loading={loading}
          error={error}
          onRetry={reload}
          params={q}
          onSort={setSort}
          showRestock
          empty={<EmptyState icon={AlertTriangle} title="No low-stock items" description="Every stock record is at or above its minimum level." />}
        />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>
    </>
  );
}
