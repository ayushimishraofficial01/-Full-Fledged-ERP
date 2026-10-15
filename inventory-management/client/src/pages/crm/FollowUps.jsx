import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, DataTable, Badge } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';

export default function FollowUps() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    crmService.followUps({ status: 'Pending' }).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Follow-Ups" description="Calls, meetings and reminders." breadcrumbs={[{ label: 'CRM' }, { label: 'Follow-Ups' }]} />
      <Card>
        <div className="mb-4 flex justify-end"><Button onClick={() => setCreateOpen(true)}>+ Add Follow-Up</Button></div>
        <DataTable loading={loading} columns={[{ key: 'subject', header: 'Subject' }, { key: 'type', header: 'Type' }, { key: 'status', header: 'Status' }, { key: 'date', header: 'Date' }, { key: 'actions', header: 'Actions', render: (row) => hasPermission('followups.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button> }]} rows={items.map((item) => ({ ...item, status: <Badge tone={item.status === 'Pending' ? 'amber' : 'green'}>{item.status}</Badge>, date: new Date(item.date).toLocaleString() }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add follow-up"
        entity="Follow-Up"
        create={crmService.createFollowUp}
        update={crmService.updateFollowUp}
        recordKey="followUp"
        onCreated={(item) => item && setItems((current) => [item, ...current])}
        onUpdated={(item) => item && setItems((current) => current.map((row) => row._id === item._id ? item : row))}
        initialValues={editing}
        fields={[
          { name: 'subject', label: 'Subject', required: true },
          { name: 'date', label: 'Date and time', type: 'datetime-local', required: true },
          { name: 'type', label: 'Type', type: 'select', defaultValue: 'Phone Call', options: ['Phone Call', 'Email', 'Meeting', 'WhatsApp', 'Visit', 'Other'].map((value) => ({ value, label: value })) },
          { name: 'priority', label: 'Priority', type: 'select', defaultValue: 'medium', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
          { name: 'description', label: 'Description', multiline: true },
        ]}
      />
    </>
  );
}
