import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Check, Eye, PackageCheck, Pencil, Printer, Trash2 } from 'lucide-react';
import { crmService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, ConfirmDialog, DataTable, DateRange, EmptyState, ExportButton, Field, Modal, PageHeader, SearchInput, Select } from '../../components/ui';
import SampleDispatchForm from './SampleDispatchForm';

const STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
const dateText = (value) => value ? new Date(value).toLocaleDateString() : '—';
const statusTone = (status) => ({ Pending: 'amber', Dispatched: 'blue', Delivered: 'green', Cancelled: 'slate' }[status] || 'slate');
const dispatchFilters = ({ dispatchId, customerSearch, productSearch, status, range }) => ({ dispatchId, customerSearch, productSearch, status, from: range.from, to: range.to });

function quantityText(items = []) {
  return items.map((item) => `${item.quantity} ${item.unit}`).join(', ') || '—';
}

export default function SampleDispatches() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [dispatchId, setDispatchId] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [status, setStatus] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const customerFilter = searchParams.get('customer') || '';
  const { hasPermission } = useAuth();
  const toast = useToast();

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setLoading(true);
      crmService.sampleDispatches({ ...dispatchFilters({ dispatchId, customerSearch, productSearch, status, range }), customer: customerFilter, page, limit: 25 })
        .then((result) => {
          if (!active) return;
          setItems(result.items || []);
          setPagination(result.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
        })
        .catch((error) => active && toast.error(error.response?.data?.message || 'Unable to load sample dispatches.'))
        .finally(() => active && setLoading(false));
    }, 220);
    return () => { active = false; clearTimeout(timer); };
  }, [dispatchId, customerSearch, productSearch, status, range, page, reload, customerFilter, toast]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(item) {
    setEditing(item);
    setFormOpen(true);
  }

  function saved() {
    setFormOpen(false);
    setEditing(null);
    setReload((value) => value + 1);
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await crmService.deleteSampleDispatch(deleting._id);
      toast.success(`Dispatch ${deleting.dispatchId} deleted.`);
      setDeleting(null);
      setReload((value) => value + 1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to delete dispatch.');
    } finally {
      setBusy(false);
    }
  }

  async function markDelivered(item) {
    try {
      await crmService.markSampleDispatchDelivered(item._id);
      toast.success(`Dispatch ${item.dispatchId} marked delivered.`);
      setReload((value) => value + 1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update dispatch status.');
    }
  }

  const columns = [
    { key: 'dispatchId', header: 'Dispatch ID', render: (row) => <span className="font-mono text-xs font-semibold">{row.dispatchId}</span> },
    { key: 'customerName', header: 'Customer', render: (row) => row.customer?._id ? <Link className="text-brand-700 hover:underline" to={`/crm/customers/${row.customer._id}`}>{row.customerName}</Link> : row.customerName },
    { key: 'phone', header: 'Phone' },
    { key: 'products', header: 'Sample Products', className: 'whitespace-normal min-w-[180px]', render: (row) => <span>{row.sampleProducts?.map((item) => item.productName || item.product?.name || item.sku).join(', ') || '—'}</span> },
    { key: 'quantity', header: 'Quantity', render: (row) => quantityText(row.sampleProducts) },
    { key: 'dispatchDate', header: 'Dispatch Date', render: (row) => dateText(row.dispatchDate) },
    { key: 'status', header: 'Delivery Status', render: (row) => <Badge tone={statusTone(row.status)}>{row.status}</Badge> },
    { key: 'trackingNumber', header: 'Tracking Number', render: (row) => row.trackingNumber || '—' },
    { key: 'assignedUser', header: 'Assigned User', render: (row) => row.assignedUser?.name || '—' },
    { key: 'actions', header: 'Actions', render: (row) => {
      const item = items.find((entry) => entry._id === row._id);
      return (
        <div className="flex items-center gap-1">
          <Button size="icon" variant="ghost" icon={Eye} title="View details" aria-label="View details" onClick={() => setViewing(item)} />
          {hasPermission('sample_dispatch.edit') && <Button size="icon" variant="ghost" icon={Pencil} title="Edit dispatch" aria-label="Edit dispatch" onClick={() => openEdit(item)} />}
          {hasPermission('sample_dispatch.edit') && row.status !== 'Delivered' && row.status !== 'Cancelled' && <Button size="icon" variant="ghost" icon={Check} title="Mark as delivered" aria-label="Mark as delivered" onClick={() => markDelivered(item)} />}
          {hasPermission('sample_dispatch.delete') && <Button size="icon" variant="danger-ghost" icon={Trash2} title="Delete dispatch" aria-label="Delete dispatch" onClick={() => setDeleting(item)} />}
        </div>
      );
    } },
  ];

  const printDetails = () => window.print();
  const printFooter = viewing && (
    <Button icon={Printer} onClick={printDetails}>Print / Save as PDF</Button>
  );

  return (
    <>
      <PageHeader
        title="Sample Dispatch"
        description="Track customer samples from dispatch through delivery."
        breadcrumbs={[{ label: 'CRM' }, { label: 'Sample Dispatch' }]}
        actions={(
          <div className="flex flex-wrap gap-2">
            {hasPermission('sample_dispatch.create') && <Link to="/crm/sample-dispatch/import"><Button variant="secondary" icon={PackageCheck}>Import Excel</Button></Link>}
            {hasPermission('sample_dispatch.export') && <ExportButton url="/crm/sample-dispatch/export" params={dispatchFilters({ dispatchId, customerSearch, productSearch, status, range })} label="Export Excel" />}
            {hasPermission('sample_dispatch.create') && <Button onClick={openCreate}>+ Add Dispatch</Button>}
          </div>
        )}
      />
      <Card>
        {customerFilter && <div className="mb-3 flex items-center justify-between gap-3 rounded-md border border-brand-100 bg-brand-50/60 px-3 py-2 text-[13px] text-brand-800"><span>Showing dispatches linked to a customer profile.</span><Button size="sm" variant="ghost" onClick={() => setSearchParams({})}>Clear customer filter</Button></div>}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <SearchInput value={dispatchId} onChange={(value) => { setDispatchId(value); setPage(1); }} placeholder="Search dispatch ID" />
          <SearchInput value={customerSearch} onChange={(value) => { setCustomerSearch(value); setPage(1); }} placeholder="Search customer" />
          <SearchInput value={productSearch} onChange={(value) => { setProductSearch(value); setPage(1); }} placeholder="Search product / SKU" />
          <Field label="Status" htmlFor="dispatch-filter-status" className="min-w-0">
            <Select id="dispatch-filter-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
              <option value="">All statuses</option>
              {STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Dispatch date range" className="min-w-0">
            <DateRange from={range.from} to={range.to} onChange={(value) => { setRange(value); setPage(1); }} />
          </Field>
        </div>
        <DataTable
          loading={loading}
          minWidth={1250}
          columns={columns}
          rows={items}
          empty={<EmptyState compact title="No sample dispatches found" description="Change the filters or add a dispatch." />}
        />
        {pagination.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between gap-3">
            <span className="text-sm text-slate-500">{pagination.total} dispatches</span>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
              <span className="self-center text-sm text-slate-600">{page} / {pagination.totalPages}</span>
              <Button size="sm" variant="secondary" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>

      <SampleDispatchForm open={formOpen} onClose={() => { setFormOpen(false); setEditing(null); }} dispatch={editing} onSaved={saved} />
      <Modal open={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.dispatchId || 'Dispatch details'} description={viewing?.customerName || ''} size="lg" footer={printFooter}>
        {viewing && (
          <div className="sample-dispatch-print space-y-5">
            <div><h1 className="text-xl font-bold">Sample Dispatch {viewing.dispatchId}</h1><p className="mt-1 text-sm text-slate-600">{viewing.customerName}</p></div>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {[
                ['Company', viewing.companyName], ['Phone', viewing.phone], ['Email', viewing.email], ['Complete address', viewing.completeAddress],
                ['City / State / PIN', [viewing.city, viewing.state, viewing.pincode].filter(Boolean).join(', ')], ['Dispatch date', dateText(viewing.dispatchDate)],
                ['Method / Courier', viewing.dispatchMethod], ['Tracking number', viewing.trackingNumber], ['Expected delivery', dateText(viewing.expectedDeliveryDate)],
                ['Status', viewing.status], ['Assigned user', viewing.assignedUser?.name], ['Remarks', viewing.remarks],
              ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm text-slate-800">{value || '—'}</dd></div>)}
            </dl>
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-900">Sample products</h3>
              <ul className="divide-y divide-slate-100 border-y border-slate-100">
                {viewing.sampleProducts?.map((item, index) => <li key={item._id || index} className="flex justify-between gap-4 py-2 text-sm"><span>{item.productName || item.product?.name} <span className="font-mono text-xs text-slate-500">{item.sku || item.product?.sku}</span></span><span>{item.quantity} {item.unit}</span></li>)}
              </ul>
            </div>
          </div>
        )}
      </Modal>
      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={remove}
        loading={busy}
        title={`Delete ${deleting?.dispatchId || 'sample dispatch'}?`}
        message="This dispatch and its customer history entry will be removed. This cannot be undone."
        confirmLabel="Delete dispatch"
      />
    </>
  );
}
