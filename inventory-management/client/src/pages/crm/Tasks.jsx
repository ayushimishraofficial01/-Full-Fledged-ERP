import { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, DataTable, Badge } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';

export default function Tasks() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const { hasPermission } = useAuth();

  useEffect(() => {
    crmService.tasks({}).then((res) => setItems(res.items || [])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Tasks" description="Operational worklist for CRM users." breadcrumbs={[{ label: 'CRM' }, { label: 'Tasks' }]} />
      <Card>
        <div className="mb-4 flex justify-end"><Button onClick={() => setCreateOpen(true)}>+ Add Task</Button></div>
        <DataTable loading={loading} columns={[{ key: 'title', header: 'Title' }, { key: 'priority', header: 'Priority' }, { key: 'status', header: 'Status' }, { key: 'dueDate', header: 'Due Date' }, { key: 'actions', header: 'Actions', render: (row) => hasPermission('tasks.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button> }]} rows={items.map((item) => ({ ...item, priority: item.priority?.toUpperCase(), status: <Badge tone={item.status === 'Completed' ? 'green' : 'amber'}>{item.status || 'Pending'}</Badge>, dueDate: item.dueDate ? new Date(item.dueDate).toLocaleDateString() : '—' }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add task"
        entity="Task"
        create={crmService.createTask}
        update={crmService.updateTask}
        recordKey="task"
        onCreated={(item) => item && setItems((current) => [item, ...current])}
        onUpdated={(item) => item && setItems((current) => current.map((row) => row._id === item._id ? item : row))}
        initialValues={editing}
        fields={[
          { name: 'title', label: 'Title', required: true },
          { name: 'dueDate', label: 'Due date', type: 'date' },
          { name: 'priority', label: 'Priority', type: 'select', defaultValue: 'medium', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'urgent', label: 'Urgent' }] },
          { name: 'status', label: 'Status', type: 'select', defaultValue: 'Pending', options: ['Pending', 'In Progress', 'Completed', 'Cancelled'].map((value) => ({ value, label: value })) },
          { name: 'description', label: 'Description', multiline: true },
        ]}
      />
    </>
  );
}
