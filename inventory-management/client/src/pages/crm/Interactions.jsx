import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, DataTable } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';

export default function Interactions() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    crmService.interactions({}).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Interactions" description="Call, email, meeting and activity history." breadcrumbs={[{ label: 'CRM' }, { label: 'Interactions' }]} />
      <Card>
        <div className="mb-4 flex justify-end"><Button onClick={() => setCreateOpen(true)}>+ Add Interaction</Button></div>
        <DataTable loading={loading} columns={[{ key: 'type', header: 'Type' }, { key: 'subject', header: 'Subject' }, { key: 'outcome', header: 'Outcome' }, { key: 'date', header: 'Date' }, { key: 'actions', header: 'Actions', render: (row) => hasPermission('interactions.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button> }]} rows={items.map((item) => ({ ...item, date: new Date(item.date).toLocaleString() }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add interaction"
        entity="Interaction"
        create={crmService.createInteraction}
        update={crmService.updateInteraction}
        recordKey="interaction"
        onCreated={(item) => item && setItems((current) => [item, ...current])}
        onUpdated={(item) => item && setItems((current) => current.map((row) => row._id === item._id ? item : row))}
        initialValues={editing}
        fields={[
          { name: 'type', label: 'Type', type: 'select', defaultValue: 'Note', options: ['Call', 'Email', 'Meeting', 'WhatsApp', 'Visit', 'Note', 'Other'].map((value) => ({ value, label: value })) },
          { name: 'subject', label: 'Subject' },
          { name: 'outcome', label: 'Outcome' },
          { name: 'description', label: 'Description', multiline: true },
        ]}
      />
    </>
  );
}
