import { useEffect, useState } from 'react';
import { NotebookPen, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { crmService } from '../../services';
import { PageHeader, Card, Button, SearchInput, Badge, DataTable } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import CustomerNotesDialog from './CustomerNotesDialog';
import { useAuth } from '../../context/AuthContext';

export default function Customers() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [notesCustomer, setNotesCustomer] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      crmService.customers({ search: query }).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      <PageHeader title="Customers" description="Customer directory and purchase-linked records." breadcrumbs={[{ label: 'CRM' }, { label: 'Customers' }]} />
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search customer, phone or email" />
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>+ Add Customer</Button>
        </div>
        <DataTable loading={loading} columns={[{ key: 'fullName', header: 'Name', render: (row) => <Link className="text-brand-700 hover:underline" to={`/crm/customers/${row._id}`}>{row.fullName}</Link> }, { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email' }, { key: 'customerType', header: 'Type' }, { key: 'status', header: 'Status' }, { key: 'actions', header: 'Actions', render: (row) => {
          const customer = items.find((item) => item._id === row._id);
          return (
            <div className="flex items-center gap-2">
              {(hasPermission('notes.view') || hasPermission('notes.create')) && <Button size="sm" variant="secondary" icon={NotebookPen} onClick={() => setNotesCustomer(customer)}>Notes</Button>}
              {hasPermission('customers.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(customer); setCreateOpen(false); }}>Edit</Button>}
            </div>
          );
        } }]} rows={items.map((customer) => ({ ...customer, status: <Badge tone={customer.status === 'active' ? 'green' : 'slate'}>{customer.status}</Badge>, customerType: customer.customerType || 'B2C' }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add customer"
        entity="Customer"
        create={crmService.createCustomer}
        update={crmService.updateCustomer}
        recordKey="customer"
        onCreated={(customer) => customer && setItems((current) => [customer, ...current])}
        onUpdated={(customer) => customer && setItems((current) => current.map((item) => item._id === customer._id ? customer : item))}
        initialValues={editing}
        fields={[
          { name: 'fullName', label: 'Customer name', required: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'leadSource', label: 'Source', type: 'custom-select', customOption: '__custom__', options: [{ value: 'Website', label: 'Website' }, { value: 'India Mart', label: 'India Mart' }, { value: 'Walk-in', label: 'Walk-in' }] },
          { name: 'address.line1', label: 'Address line 1' },
          { name: 'address.line2', label: 'Address line 2' },
          { name: 'address.city', label: 'City' },
          { name: 'address.state', label: 'State' },
          { name: 'address.country', label: 'Country', defaultValue: 'India' },
          { name: 'address.pincode', label: 'PIN code', type: 'text' },
          { name: 'customerType', label: 'Customer type', type: 'select', defaultValue: 'B2C', options: [{ value: 'B2C', label: 'B2C' }, { value: 'B2B', label: 'B2B' }] },
          { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
        ]}
      />
      {notesCustomer && <CustomerNotesDialog customer={notesCustomer} onClose={() => setNotesCustomer(null)} canCreate={hasPermission('notes.create')} />}
    </>
  );
}
