import { Link } from 'react-router-dom';
import { ArrowLeftRight, Factory, History, Plus } from 'lucide-react';
import { productionService } from '../../services';
import useFetch from '../../hooks/useFetch';
import { Badge, Button, Card, EmptyState, ExportButton, PageHeader, Pagination } from '../../components/ui';
import { formatDate, formatQty, sizeLabel } from '../../utils/format';
import useListParams from '../../hooks/useListParams';

function statusTone(status) {
  if (status === 'LOW_STOCK') return 'amber';
  if (status === 'OUT_OF_STOCK') return 'red';
  return 'green';
}

export default function ProductionStock() {
  const { params, update } = useListParams({ limit: '25' });
  const { data, loading, error } = useFetch(() => productionService.stock(params), [JSON.stringify(params)]);
  const items = data?.items || [];

  return (
    <>
      <PageHeader
        title="Production Stock"
        description="Available manufactured stock before distribution to warehouses."
        breadcrumbs={[{ label: 'Production Stock' }, { label: 'Production Stock' }]}
        actions={<><ExportButton url="/export/production" params={{ mode: 'stock', ...params }} /><Link to="/production/new"><Button icon={Plus}>Add Production</Button></Link></>}
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4">
          <input aria-label="Search production stock" className="input max-w-sm" placeholder="Search product or SKU" value={params.search || ''} onChange={(e) => update({ search: e.target.value })} />
          {params.search && <button type="button" className="text-sm font-medium text-brand-700" onClick={() => update({ search: '' })}>Clear</button>}
        </div>
        {error ? <div className="p-6 text-sm font-semibold text-red-600">Unable to load production stock.</div> : loading && !data ? <div className="p-6 text-sm font-semibold text-slate-500">Loading production stock…</div> : items.length === 0 ? <EmptyState icon={Factory} title="No production stock" description="Add production to create your central stock balance." action={<Link to="/production/new"><Button icon={Plus}>Add Production</Button></Link>} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead><tr className="border-b border-slate-100"><th className="th">Product</th><th className="th">SKU</th><th className="th">Size</th><th className="th text-right">Available</th><th className="th text-right">Produced</th><th className="th text-right">Transferred</th><th className="th">Last Production</th><th className="th">Status</th><th className="th">Actions</th></tr></thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row._id} className="border-b border-slate-50">
                    <td className="td font-semibold text-slate-900">{row.product.name}</td>
                    <td className="td"><span className="sku">{row.product.sku}</span></td>
                    <td className="td">{sizeLabel(row.product)}</td>
                    <td className="td text-right font-bold">{formatQty(row.quantity)} {row.unit}</td>
                    <td className="td text-right">{formatQty(row.totalProduced)} {row.unit}</td>
                    <td className="td text-right">{formatQty(row.totalTransferred)} {row.unit}</td>
                    <td className="td">{row.lastProductionDate ? formatDate(row.lastProductionDate) : '—'}</td>
                    <td className="td"><Badge tone={statusTone(row.status)}>{row.status.replaceAll('_', ' ')}</Badge></td>
                    <td className="td"><div className="flex items-center gap-2"><Link title="Transfer" to={`/production/transfer?product=${row.product._id}`} className="rounded-md p-1.5 text-brand-700 hover:bg-brand-50"><ArrowLeftRight className="h-4 w-4" /></Link><Link title="History" to={`/production/history?product=${row.product._id}`} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"><History className="h-4 w-4" /></Link></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination pagination={data?.pagination} onPageChange={(page) => update({ page }, { resetPage: false })} onLimitChange={(limit) => update({ limit })} />
      </Card>
    </>
  );
}
