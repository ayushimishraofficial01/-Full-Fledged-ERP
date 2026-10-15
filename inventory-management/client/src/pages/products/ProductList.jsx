import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Pencil, Trash2, History, Plus, FileUp, Package, RotateCcw } from 'lucide-react';
import { productService } from '../../services';
import { parseError } from '../../services/api';
import useFetch from '../../hooks/useFetch';
import useListParams from '../../hooks/useListParams';
import { useMeta } from '../../context/MetaContext';
import { useToast } from '../../context/ToastContext';
import { ActiveBadge, Button, Card, DataTable, EmptyState, ExportButton, FilterBar, FilterSelect, PageHeader, Pagination, ProductThumb, SearchInput, StockStatusBadge } from '../../components/ui';
import DeleteProductDialog from '../../components/inventory/DeleteProductDialog';
import { formatCurrency, formatQty } from '../../utils/format';

function IconAction({ icon: Icon, label, onClick, to, tone = 'default' }) {
  const cls = `inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 ${tone === 'danger' ? 'text-slate-500 hover:bg-red-50 hover:text-red-700' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-800'}`;
  if (to) return <Link to={to} className={cls} title={label} aria-label={label} onClick={(e) => e.stopPropagation()}><Icon className="h-4 w-4" /></Link>;
  return <button type="button" className={cls} title={label} aria-label={label} onClick={(e) => { e.stopPropagation(); onClick(); }}><Icon className="h-4 w-4" /></button>;
}

export default function ProductList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, units, refreshCategories } = useMeta();
  const { params, update, setSort, reset } = useListParams({ limit: '20' });
  const [toDelete, setToDelete] = useState(null);
  const { data, loading, error, reload } = useFetch(() => productService.list(params), [JSON.stringify(params)]);
  const archivedView = params.archived === 'only';
  const filtered = Boolean(params.search || params.category || params.unit || params.stockStatus || params.status);

  const restore = async (p) => {
    try {
      const res = await productService.restore(p._id);
      toast.success(res.message);
      reload();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  const columns = [
    { key: 'image', header: 'Image', render: (p) => <ProductThumb product={p} /> },
    {
      key: 'name',
      header: 'Product Name',
      sortKey: 'name',
      render: (p) => (
        <div className="max-w-[260px]">
          <span className="block truncate font-medium text-slate-900">{p.name}</span>
          {p.brand && <span className="text-sm text-slate-500">{p.brand}</span>}
        </div>
      ),
    },
    { key: 'sku', header: 'SKU', sortKey: 'sku', render: (p) => <span className="sku">{p.sku}</span> },
    { key: 'category', header: 'Category', sortKey: 'category' },
    { key: 'hsn', header: 'HSN', sortKey: 'hsn', render: (p) => p.hsn || <span className="text-slate-300">—</span> },
    { key: 'size', header: 'Size', sortKey: 'size', align: 'right', render: (p) => <span className="num">{p.size ?? '—'}</span> },
    { key: 'unit', header: 'Unit', render: (p) => p.unit },
    { key: 'price', header: 'Price', sortKey: 'price', align: 'right', render: (p) => p.price == null ? <span className="text-slate-400">—</span> : <span className="num">{formatCurrency(p.price)}</span> },
    {
      key: 'totalStock',
      header: 'Total Stock',
      sortKey: 'totalStock',
      align: 'right',
      render: (p) => (
        <div>
          <span className="num font-semibold text-slate-900">{formatQty(p.totalStock)}</span> <span className="text-sm text-slate-500">{p.stockUnit}</span>
          <div className="mt-0.5"><StockStatusBadge status={p.stockStatus} /></div>
        </div>
      ),
    },
    { key: 'minimumStock', header: 'Min Stock', sortKey: 'minimumStock', align: 'right', render: (p) => <span className="num">{formatQty(p.minimumStock)}</span> },
    { key: 'status', header: 'Status', render: (p) => <ActiveBadge status={p.status} archived={p.isArchived} /> },
    {
      key: 'actions',
      sticky: true,
      header: <span className="sr-only">Actions</span>,
      align: 'right',
      render: (p) =>
        p.isArchived ? (
          <Button size="xs" variant="secondary" icon={RotateCcw} onClick={(e) => { e.stopPropagation(); restore(p); }}>Restore</Button>
        ) : (
          <div className="flex items-center justify-end gap-0.5">
            <IconAction icon={Eye} label="View" to={`/products/${p._id}`} />
            <IconAction icon={Pencil} label="Edit" to={`/products/${p._id}/edit`} />
            <IconAction icon={History} label="Stock history" to={`/stock/history?product=${p._id}`} />
            <IconAction icon={Trash2} label="Delete" tone="danger" onClick={() => setToDelete(p)} />
          </div>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title={archivedView ? 'Archived Products' : 'All Products'}
        description="Products are catalogue items; their stock lives per warehouse."
        breadcrumbs={[{ label: 'Products' }]}
        actions={
          <>
            <ExportButton url="/export/products" params={params} />
            <Link to="/products/import"><Button variant="secondary" icon={FileUp}>Import</Button></Link>
            <Link to="/products/new"><Button icon={Plus}>Add Product</Button></Link>
          </>
        }
      />
      <Card padded={false}>
        <FilterBar showReset={filtered} onReset={() => reset()}>
          <SearchInput value={params.search || ''} onChange={(v) => update({ search: v })} placeholder="Search name, SKU or HSN" className="xl:col-span-2" />
          <FilterSelect value={params.category} onChange={(v) => update({ category: v })} label="Category">
            <option value="">All categories</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </FilterSelect>
          <FilterSelect value={params.unit} onChange={(v) => update({ unit: v })} label="Unit">
            <option value="">All units</option>
            {units.map((u) => <option key={u._id} value={u.name}>{u.name}</option>)}
          </FilterSelect>
          <FilterSelect value={params.stockStatus} onChange={(v) => update({ stockStatus: v })} label="Stock status">
            <option value="">Any stock status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </FilterSelect>
          <FilterSelect value={params.archived === 'only' ? 'archived' : params.status} onChange={(v) => update(v === 'archived' ? { archived: 'only', status: '' } : { status: v, archived: '' })} label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </FilterSelect>
        </FilterBar>
        <DataTable
          columns={columns}
          rows={data?.items}
          loading={loading}
          error={error}
          onRetry={reload}
          sort={params.sort || 'createdAt'}
          order={params.order || 'desc'}
          onSort={setSort}
          minWidth={1100}
          onRowClick={(p) => !p.isArchived && navigate(`/products/${p._id}`)}
          empty={
            filtered || archivedView ? (
              <EmptyState icon={Package} title="No products found" description="Try a different search term or clear the filters." action={<Button variant="secondary" onClick={() => reset()}>Clear filters</Button>} />
            ) : (
              <EmptyState icon={Package} title="No products found" description="Add your first product or import a list from Excel." action={<div className="flex gap-2"><Link to="/products/import"><Button variant="secondary" icon={FileUp}>Import Excel</Button></Link><Link to="/products/new"><Button icon={Plus}>Add Product</Button></Link></div>} />
            )
          }
        />
        <Pagination pagination={data?.pagination} onPageChange={(p) => update({ page: p }, { resetPage: false })} onLimitChange={(l) => update({ limit: l })} />
      </Card>
      {toDelete && <DeleteProductDialog product={toDelete} onClose={() => setToDelete(null)} onDone={() => { reload(); refreshCategories(); }} />}
    </>
  );
}
