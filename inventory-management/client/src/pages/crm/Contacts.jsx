import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, SearchInput, DataTable } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';

export default function Contacts() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      crmService.contacts({ search: query }).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      <PageHeader title="Contacts" description="Decision-makers and contact directory." breadcrumbs={[{ label: 'CRM' }, { label: 'Contacts' }]} />
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search contact, phone or email" />
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>+ Add Contact</Button>
        </div>
        <DataTable loading={loading} columns={[{ key: 'firstName', header: 'Name' }, { key: 'designation', header: 'Designation' }, { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email' }, { key: 'contactType', header: 'Contact Type' }, { key: 'actions', header: 'Actions', render: (row) => hasPermission('contacts.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button> }]} rows={items.map((contact) => ({ ...contact, firstName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || '—' }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add contact"
        entity="Contact"
        create={crmService.createContact}
        update={crmService.updateContact}
        recordKey="contact"
        onCreated={(contact) => contact && setItems((current) => [contact, ...current])}
        onUpdated={(contact) => contact && setItems((current) => current.map((item) => item._id === contact._id ? contact : item))}
        initialValues={editing}
        fields={[
          { name: 'firstName', label: 'First name', required: true },
          { name: 'lastName', label: 'Last name' },
          { name: 'designation', label: 'Designation' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'contactType', label: 'Contact type', type: 'select', defaultValue: 'Other', options: ['Owner', 'Manager', 'Purchase Manager', 'Sales', 'Accounts', 'Other'].map((value) => ({ value, label: value })) },
        ]}
      />
    </>
  );
}
