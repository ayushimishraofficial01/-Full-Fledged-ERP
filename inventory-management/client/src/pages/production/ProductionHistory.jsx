import { Link } from 'react-router-dom';
import { ArrowLeftRight, Factory } from 'lucide-react';
import { productionService } from '../../services';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { Card, EmptyState, ExportButton, PageHeader, Pagination } from '../../components/ui';
import { formatDate, formatQty, sizeLabel } from '../../utils/format';

export default function ProductionHistory() {
  const { params, update } = useListParams({ limit: '25' });
  const { data, loading, error } = useFetch(() => productionService.history(params), [JSON.stringify(params)]);
  const { data: transfers } = useFetch(() => productionService.transfers({ product: params.product }), [params.product]);
  const records = data?.items || [];
  const transferRows = transfers?.items || [];

  return (
    <>
      <PageHeader title="Production History" description="Production records and transfers from central Production Stock." breadcrumbs={[{ label: 'Production Stock' }, { label: 'Production History' }]} actions={<><ExportButton url="/export/production" params={{ mode: 'history', ...params }} /><ExportButton url="/export/production" params={{ mode: 'transfers', product: params.product }} label="Export transfers" /></>} />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <input aria-label="Batch filter" className="input max-w-sm" placeholder="Filter by batch number" value={params.batch || ''} onChange={(e) => update({ batch: e.target.value })} />
          {params.batch && <button type="button" className="text-sm font-medium text-brand-700" onClick={() => update({ batch: '' })}>Clear</button>}
        </div>
        {error ? <div className="p-6 text-sm font-semibold text-red-600">Unable to load production history.</div> : loading && !data ? <div className="p-6 text-sm font-semibold text-slate-500">Loading production history…</div> : records.length === 0 ? <EmptyState icon={Factory} title="No production records" description="Production entries will appear here after goods are added." /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">Product</th><th className="th">SKU</th><th className="th">Batch</th><th className="th text-right">Produced</th><th className="th">Reference</th><th className="th">User</th></tr></thead>
              <tbody>{records.map((record) => <tr key={record._id} className="border-b border-slate-50"><td className="td">{formatDate(record.productionDate)}</td><td className="td"><Link className="font-medium text-slate-900 hover:text-brand-700" to={`/products/${record.product?._id}`}>{record.product?.name}</Link><span className="block text-xs text-slate-500">{sizeLabel(record.product || {})}</span></td><td className="td"><span className="sku">{record.product?.sku}</span></td><td className="td">{record.batchNumber || '—'}</td><td className="td text-right font-semibold">{formatQty(record.quantityProduced)} {record.unit}</td><td className="td">{record.referenceNumber || '—'}</td><td className="td">{record.createdBy?.name || '—'}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        <Pagination pagination={data?.pagination} onPageChange={(page) => update({ page }, { resetPage: false })} onLimitChange={(limit) => update({ limit })} />
      </Card>
      <Card className="mt-6" title="Production transfers" description="Every transfer out of Production Stock into a warehouse.">
        {transferRows.length === 0 ? <p className="text-sm font-semibold text-slate-500">No production transfers yet.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[700px]"><thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">Product</th><th className="th">Destination</th><th className="th text-right">Quantity</th><th className="th">Reference</th></tr></thead><tbody>{transferRows.map((transfer) => <tr key={transfer._id} className="border-b border-slate-50"><td className="td">{formatDate(transfer.transferDate)}</td><td className="td font-semibold">{transfer.product?.name}</td><td className="td">{transfer.toWarehouse?.name} ({transfer.toWarehouse?.code})</td><td className="td text-right font-bold">{formatQty(transfer.quantity)} {transfer.unit}</td><td className="td">{transfer.referenceNumber || '—'}</td></tr>)}</tbody></table></div>}
      </Card>
    </>
  );
}
