import { inventoryService } from '../../services';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { Card, ExportButton, PageHeader, Pagination } from '../../components/ui';
import InventoryFilters from '../../components/inventory/InventoryFilters';
import InventoryTable from '../../components/inventory/InventoryTable';
import SummaryTiles from '../../components/inventory/SummaryTiles';

export default function CurrentStock() {
  const { params, update, setSort, reset } = useListParams({ limit: '25' });
  const { data, loading, error, reload } = useFetch(() => inventoryService.list({ ...params, withSummary: 'true' }), [JSON.stringify(params)]);

  return (
    <>
      <PageHeader
        title="Current Stock"
        description="Live quantity of every product in every warehouse."
        breadcrumbs={[{ label: 'Inventory' }, { label: 'Current Stock' }]}
        actions={<ExportButton url="/export/inventory" params={params} />}
      />
      <SummaryTiles summary={data?.summary} loading={loading} />
      <Card padded={false}>
        <InventoryFilters params={params} update={update} reset={reset} />
        <InventoryTable data={data} loading={loading} error={error} onRetry={reload} params={params} onSort={setSort} />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>
    </>
  );
}
