import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Pencil, Trash2, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, History, Warehouse } from 'lucide-react';
import { productService, stockService } from '../../services';
import useFetch from '../../hooks/useFetch';
import { ActiveBadge, Button, Card, DataTable, EmptyState, ErrorState, PageHeader, PageLoader, Pagination, ProductThumb, StockStatusBadge } from '../../components/ui';
import TransactionTimeline from '../../components/stock/TransactionTimeline';
import DeleteProductDialog from '../../components/inventory/DeleteProductDialog';
import { formatCurrency, formatDate, formatQty, sizeLabel } from '../../utils/format';

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm text-slate-900">{children || <span className="text-slate-400">—</span>}</dd>
    </div>
  );
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState(false);
  const { data, loading, error, reload } = useFetch(() => productService.get(id), [id]);
  const history = useFetch(() => stockService.transactions({ product: id, page, limit: 15 }), [id, page]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error.message} onRetry={reload} />;
  const { product, stock } = data;
  const q = `?product=${product._id}`;

  return (
    <>
      <PageHeader
        title={product.name}
        breadcrumbs={[{ label: 'Products', to: '/products' }, { label: product.sku }]}
        actions={
          !product.isArchived && (
            <>
              <Link to={`/stock/in${q}`}><Button variant="secondary" icon={ArrowDownToLine}>Stock In</Button></Link>
              <Link to={`/stock/out${q}`}><Button variant="secondary" icon={ArrowUpFromLine}>Stock Out</Button></Link>
              <Link to={`/stock/transfer${q}`}><Button variant="secondary" icon={ArrowLeftRight}>Transfer</Button></Link>
              <Link to={`/products/${product._id}/edit`}><Button icon={Pencil}>Edit</Button></Link>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-1">
          <div className="flex items-start gap-4">
            <ProductThumb product={product} size="lg" />
            <div className="min-w-0">
              <span className="sku">{product.sku}</span>
              <h2 className="mt-2 text-lg font-semibold leading-snug text-slate-900">{product.name}</h2>
              <p className="text-sm text-slate-500">{sizeLabel(product)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <ActiveBadge status={product.status} archived={product.isArchived} />
                <StockStatusBadge status={product.stockStatus} />
              </div>
            </div>
          </div>
          <div className="mt-5 rounded-xl bg-navy-900 p-4 text-white ring-1 ring-inset ring-white/10">
            <p className="text-xs font-medium text-navy-300">Total stock (all warehouses)</p>
            <p className="num font-display mt-1 text-3xl font-bold">{formatQty(product.totalStock)} <span className="text-base font-normal text-navy-200">{product.stockUnit}</span></p>
            <p className="mt-1 text-xs text-navy-300">Minimum per warehouse: {formatQty(product.minimumStock)} {product.stockUnit}</p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-4">
            <Detail label="Category">{product.category}</Detail>
            <Detail label="Brand">{product.brand}</Detail>
            <Detail label="HSN">{product.hsn}</Detail>
            <Detail label="Size">{product.size != null ? formatQty(product.size) : null}</Detail>
            <Detail label="Unit">{product.unit}</Detail>
            <Detail label="Stock unit">{product.stockUnit}</Detail>
            <Detail label="Selling price">{product.price == null ? null : `${formatCurrency(product.price)} / ${product.stockUnit}`}</Detail>
            <Detail label="Created">{formatDate(product.createdAt)}{product.createdBy?.name ? ` · ${product.createdBy.name}` : ''}</Detail>
            <Detail label="Updated">{formatDate(product.updatedAt)}{product.updatedBy?.name ? ` · ${product.updatedBy.name}` : ''}</Detail>
          </dl>
          {product.description && <p className="mt-5 border-t border-slate-100 pt-4 text-sm leading-relaxed text-slate-600">{product.description}</p>}
          {!product.isArchived && (
            <Button variant="danger-ghost" size="sm" icon={Trash2} className="mt-4" onClick={() => setDeleting(true)}>Delete product</Button>
          )}
        </Card>

        <div className="space-y-6 xl:col-span-2">
          <Card title="Stock by warehouse" padded={false}>
            <DataTable
              minWidth={520}
              rows={stock}
              columns={[
                { key: 'warehouse', header: 'Warehouse', render: (s) => <Link to={`/inventory/warehouse/${s.warehouse._id}`} className="font-medium text-slate-900 hover:text-brand-700">{s.warehouse.name} <span className="text-xs font-normal text-slate-500">{s.warehouse.code}</span></Link> },
                { key: 'qty', header: 'Quantity', align: 'right', render: (s) => <span className="num font-semibold">{formatQty(s.quantity)} <span className="text-xs font-normal text-slate-500">{s.unit}</span></span> },
                { key: 'status', header: 'Status', render: (s) => <StockStatusBadge status={s.status} /> },
                { key: 'updated', header: 'Last movement', render: (s) => formatDate(s.lastTransactionAt || s.updatedAt) },
              ]}
              empty={<EmptyState compact icon={Warehouse} title="Not stocked in any warehouse yet" description="Use Stock In to add this product to a warehouse." action={<Link to={`/stock/in${q}`}><Button icon={ArrowDownToLine}>Stock In</Button></Link>} />}
            />
          </Card>

          <Card title="Stock history" description="Every movement of this product" actions={<Link to={`/stock/history${q}`} className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700"><History className="h-4 w-4" /> Open in history</Link>} padded={false}>
            <div className="p-5">
              {history.error ? (
                <ErrorState message={history.error.message} onRetry={history.reload} />
              ) : !history.data ? (
                <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded bg-slate-100" />)}</div>
              ) : history.data.items.length ? (
                <TransactionTimeline items={history.data.items} />
              ) : (
                <EmptyState compact icon={History} title="No transactions available" description="Stock movements for this product will appear here." />
              )}
            </div>
            <Pagination pagination={history.data?.pagination} onPageChange={setPage} />
          </Card>
        </div>
      </div>
      {deleting && <DeleteProductDialog product={product} onClose={() => setDeleting(false)} onDone={() => navigate('/products')} />}
    </>
  );
}
