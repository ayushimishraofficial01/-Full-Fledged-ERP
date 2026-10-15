import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, DataTable } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';

export default function Notes() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    crmService.notes({}).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Customer Notes" description="Pinned notes and updates." breadcrumbs={[{ label: 'CRM' }, { label: 'Customer Notes' }]} />
      <Card>
        <div className="mb-4 flex justify-end"><Button onClick={() => setCreateOpen(true)}>+ Add Note</Button></div>
        <DataTable loading={loading} columns={[{ key: 'title', header: 'Title' }, { key: 'description', header: 'Description' }, { key: 'pinned', header: 'Pinned' }, { key: 'actions', header: 'Actions', render: (row) => hasPermission('notes.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button> }]} rows={items.map((item) => ({ ...item, pinned: item.pinned ? 'Yes' : 'No' }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add customer note"
        entity="Note"
        create={crmService.createNote}
        update={crmService.updateNote}
        recordKey="note"
        onCreated={(item) => item && setItems((current) => [item, ...current])}
        onUpdated={(item) => item && setItems((current) => current.map((row) => row._id === item._id ? item : row))}
        initialValues={editing}
        fields={[
          { name: 'title', label: 'Title', required: true },
          { name: 'description', label: 'Description', required: true, multiline: true },
          { name: 'pinned', label: 'Pin this note', type: 'checkbox' },
        ]}
      />
    </>
  );
}
