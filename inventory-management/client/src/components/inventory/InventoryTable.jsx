import { Link } from 'react-router-dom';
import { ArrowDownToLine, Boxes } from 'lucide-react';
import { Button, DataTable, EmptyState, ProductThumb, StockStatusBadge } from '../ui';
import { formatDate, formatQty } from '../../utils/format';

/** Inventory rows (one per product per warehouse). */
export default function InventoryTable({ data, loading, error, onRetry, params, onSort, showWarehouse = true, showRestock = false, empty }) {
  const columns = [
    {
      key: 'product',
      header: 'Product',
      sortKey: 'product',
      render: (r) => (
        <Link to={`/products/${r.product._id}`} className="flex items-center gap-3">
          <ProductThumb product={r.product} size="sm" />
          <span className="max-w-[240px] truncate font-medium text-slate-900 hover:text-brand-700">{r.product.name}</span>
        </Link>
      ),
    },
    { key: 'sku', header: 'SKU', sortKey: 'sku', render: (r) => <span className="sku">{r.product.sku}</span> },
    showWarehouse && { key: 'warehouse', header: 'Warehouse', sortKey: 'warehouse', render: (r) => <Link to={`/inventory/warehouse/${r.warehouse._id}`} className="hover:text-brand-700">{r.warehouse.name}</Link> },
    { key: 'size', header: 'Size', align: 'right', render: (r) => <span className="num">{r.product.size != null ? `${formatQty(r.product.size)} ${r.product.unit}` : r.product.unit}</span> },
    { key: 'unit', header: 'Unit', render: (r) => r.product.stockUnit },
    {
      key: 'quantity',
      header: 'Current Qty',
      sortKey: 'quantity',
      align: 'right',
      render: (r) => <span className={`num font-semibold ${r.status === 'IN_STOCK' ? 'text-slate-900' : r.status === 'LOW_STOCK' ? 'text-amber-700' : 'text-red-600'}`}>{formatQty(r.quantity)}</span>,
    },
    { key: 'min', header: 'Min Qty', sortKey: 'minimumStock', align: 'right', render: (r) => <span className="num text-slate-500">{formatQty(r.product.minimumStock)}</span> },
    { key: 'status', header: 'Status', sortKey: 'status', render: (r) => <StockStatusBadge status={r.status} /> },
    { key: 'updated', header: 'Last Movement', sortKey: 'updatedAt', render: (r) => <span className="text-[13px] text-slate-500">{formatDate(r.lastTransactionAt || r.updatedAt)}</span> },
    showRestock && {
      key: 'restock',
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (r) => (
        <Link to={`/stock/in?product=${r.product._id}&warehouse=${r.warehouse._id}`}>
          <Button size="xs" variant="secondary" icon={ArrowDownToLine}>Restock</Button>
        </Link>
      ),
    },
  ].filter(Boolean);

  return (
    <DataTable
      columns={columns}
      rows={data?.items}
      loading={loading}
      error={error}
      onRetry={onRetry}
      sort={params.sort || 'product'}
      order={params.order || 'asc'}
      onSort={onSort}
      minWidth={980}
      empty={empty || <EmptyState icon={Boxes} title="No stock records found" description="Stock appears here after a Stock In, transfer or Excel import." action={<Link to="/stock/in"><Button icon={ArrowDownToLine}>Stock In</Button></Link>} />}
    />
  );
}
