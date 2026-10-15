import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck } from 'lucide-react';
import { crmService } from '../../services';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Badge, Button, Card, DataTable, EmptyState, PageHeader } from '../../components/ui';

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—';
const formatCurrency = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value || 0);
const quantity = (items = []) => items.map((item) => `${item.quantity} ${item.unit}`).join(', ');
const tone = (status) => ({ Pending: 'amber', Dispatched: 'blue', Delivered: 'green', Cancelled: 'slate' }[status] || 'slate');

export default function CustomerProfile() {
  const { id } = useParams();
  const [customer, setCustomer] = useState(null);
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingDispatches, setLoadingDispatches] = useState(true);
  const { hasPermission } = useAuth();
  const toast = useToast();
  const canViewDispatches = hasPermission('sample_dispatch.view');

  useEffect(() => {
    let active = true;
    setLoading(true);
    crmService.customer(id)
      .then((result) => active && setCustomer(result.customer))
      .catch((error) => active && toast.error(error.response?.data?.message || 'Unable to load customer.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [id, toast]);

  useEffect(() => {
    if (!canViewDispatches) { setLoadingDispatches(false); return undefined; }
    let active = true;
    setLoadingDispatches(true);
    crmService.customerSampleDispatches(id)
      .then((result) => active && setDispatches(result.items || []))
      .catch((error) => active && toast.error(error.response?.data?.message || 'Unable to load sample dispatch history.'))
      .finally(() => active && setLoadingDispatches(false));
    return () => { active = false; };
  }, [id, canViewDispatches, toast]);

  const dispatchColumns = [
    { key: 'dispatchId', header: 'Dispatch ID' },
    { key: 'products', header: 'Sample products', render: (row) => row.sampleProducts?.map((item) => item.productName || item.product?.name).join(', ') || '—' },
    { key: 'quantity', header: 'Quantity', render: (row) => quantity(row.sampleProducts) || '—' },
    { key: 'dispatchDate', header: 'Date', render: (row) => formatDate(row.dispatchDate) },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={tone(row.status)}>{row.status}</Badge> },
  ];

  if (loading) return <PageHeader title="Customer profile" description="Loading customer…" breadcrumbs={[{ label: 'CRM' }, { label: 'Customers', to: '/crm/customers' }]} />;
  if (!customer) return <PageHeader title="Customer not found" breadcrumbs={[{ label: 'CRM' }, { label: 'Customers', to: '/crm/customers' }]} />;
  const address = customer.address || {};

  return (
    <>
      <PageHeader
        title={customer.fullName}
        description={customer.customerId || 'Customer profile'}
        breadcrumbs={[{ label: 'CRM' }, { label: 'Customers', to: '/crm/customers' }, { label: customer.fullName }]}
        actions={<Link to="/crm/customers"><Button variant="secondary" icon={ArrowLeft}>Customers</Button></Link>}
      />
      <Card title="Customer details" className="mb-6">
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          {[
            ['Company', customer.company?.name || customer.company || '—'], ['Phone', customer.phone || '—'], ['Email', customer.email || '—'],
            ['Address', [address.line1, address.line2].filter(Boolean).join(', ') || '—'],
            ['City / State / PIN', [address.city, address.state, address.pincode].filter(Boolean).join(', ') || '—'],
            ['Status', customer.status || '—'],
          ].map(([label, value]) => <div key={label}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 text-slate-800">{value}</dd></div>)}
        </dl>
      </Card>
      {(customer.originatingLead || customer.leadId) && (
        <Card title="Converted lead details" description="Information carried over from the original lead." className="mb-6">
          <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Lead ID', customer.leadId || '—'], ['Lead stage before conversion', customer.leadStage || '—'],
              ['Lead source', customer.leadSource || '—'], ['Product category', customer.productCategory || '—'],
              ['Industry', customer.industry || '—'], ['Priority', customer.priority || '—'],
              ['Alternate phone', customer.alternatePhone || '—'], ['Website', customer.website || '—'],
              ['GST number', customer.gstNumber || '—'], ['PAN number', customer.panNumber || '—'],
              ['Business type', customer.businessType || '—'], ['Customer type', customer.customerType || '—'],
              ['Expected value', formatCurrency(customer.expectedValue)], ['Expected closing date', formatDate(customer.expectedClosingDate)],
              ['Assigned user', customer.assignedUser?.name || '—'], ['Requirement', customer.requirement || '—'],
              ['Notes', customer.notes || '—'],
            ].map(([label, value]) => <div key={label} className={['Requirement', 'Notes'].includes(label) ? 'sm:col-span-2 lg:col-span-3' : ''}><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-slate-800">{value}</dd></div>)}
          </dl>
        </Card>
      )}
      {canViewDispatches && (
        <Card
          title="Sample Dispatch History"
          description="Samples previously sent to this customer."
          actions={<Link to={`/crm/sample-dispatch?customer=${customer._id}`}><Button size="sm" icon={PackageCheck}>Sample dispatches</Button></Link>}
        >
          <DataTable
            loading={loadingDispatches}
            columns={dispatchColumns}
            rows={dispatches}
            empty={<EmptyState compact title="No samples dispatched yet" />}
          />
        </Card>
      )}
    </>
  );
}
