import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, SearchInput, Badge, DataTable } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';

export default function Companies() {
  const [items, setItems] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    const timer = setTimeout(() => {
      crmService.companies({ search: query }).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <>
      <PageHeader title="Companies" description="B2B company directory." breadcrumbs={[{ label: 'CRM' }, { label: 'Companies' }]} />
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search company, email or phone" />
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>+ Add Company</Button>
        </div>
        <DataTable loading={loading} columns={[{ key: 'name', header: 'Company' }, { key: 'industry', header: 'Industry' }, { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email' }, { key: 'status', header: 'Status' }, { key: 'actions', header: 'Actions', render: (row) => hasPermission('companies.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button> }]} rows={items.map((company) => ({ ...company, status: <Badge tone={company.status === 'active' ? 'green' : 'slate'}>{company.status || 'active'}</Badge> }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add company"
        entity="Company"
        create={crmService.createCompany}
        update={crmService.updateCompany}
        recordKey="company"
        onCreated={(company) => company && setItems((current) => [company, ...current])}
        onUpdated={(company) => company && setItems((current) => current.map((item) => item._id === company._id ? company : item))}
        initialValues={editing}
        fields={[
          { name: 'name', label: 'Company name', required: true },
          { name: 'industry', label: 'Industry' },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'status', label: 'Status', type: 'select', defaultValue: 'active', options: [{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }] },
        ]}
      />
    </>
  );
}
