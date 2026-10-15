import { useEffect, useState } from 'react';
import { Check, Pencil, UserRoundCheck } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, Button, SearchInput, Badge, DataTable } from '../../components/ui';
import CrmCreateDialog from './CrmCreateDialog';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function Leads() {
  const standardCategories = ['Bagasse', 'Compostable', 'Paper'];
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(standardCategories);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [reload, setReload] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [convertingId, setConvertingId] = useState('');
  const { hasPermission } = useAuth();
  const toast = useToast();
  const statusOptions = [...LEAD_STATUSES, ...(editing && !LEAD_STATUSES.includes(editing.status) ? [editing.status] : [])].map((value) => ({ value, label: value }));

  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => {
      crmService.leads({ search: query, productCategory: category || undefined, limit: 100 }).then((res) => {
        setItems(res.items || []);
        setCategories([...new Set([...standardCategories, ...(res.categories || [])])]);
      }).finally(() => setLoading(false));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, category, reload]);

  async function convertLead(lead) {
    setConvertingId(lead._id);
    try {
      const result = await crmService.convertLead(lead._id);
      toast.success(result.message || `${lead.name} converted to a customer.`);
      setReload((current) => current + 1);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to convert this lead to a customer.');
    } finally {
      setConvertingId('');
    }
  }

  return (
    <>
      <PageHeader title="Leads" description="Pipeline and lead conversion tracking." breadcrumbs={[{ label: 'CRM' }, { label: 'Leads' }]} />
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <SearchInput value={query} onChange={setQuery} placeholder="Search lead, phone or email" />
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }}>+ Add Lead</Button>
        </div>
        <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter leads by product category">
          <CategoryTab active={!category} onClick={() => setCategory('')}>All products</CategoryTab>
          {categories.map((value) => <CategoryTab key={value} active={category === value} onClick={() => setCategory(value)}>{value}</CategoryTab>)}
          <CategoryTab active={category === '__uncategorized__'} onClick={() => setCategory('__uncategorized__')}>Uncategorized</CategoryTab>
        </div>
        <DataTable loading={loading} minWidth={1040} columns={[{ key: 'name', header: 'Lead', className: 'min-w-80', render: (row) => <div><p className="font-semibold text-slate-900">{row.name}</p><LeadMilestones status={row.status} /><LeadStatusControl lead={row} canEdit={hasPermission('leads.edit')} toast={toast} onSaved={(updated) => setItems((current) => current.map((item) => item._id === updated._id ? { ...item, status: updated.status } : item))} /></div> }, { key: 'productCategory', header: 'Product category' }, { key: 'requirement', header: 'Requirement' }, { key: 'phone', header: 'Phone' }, { key: 'email', header: 'Email' }, { key: 'status', header: 'Status', render: (row) => <Badge tone={row.status === 'Converted' ? 'green' : row.status === 'Lost' || row.status === 'Unqualified' ? 'red' : 'amber'}>{row.status}</Badge> }, { key: 'source', header: 'Source' }, { key: 'actions', header: 'Actions', render: (row) => <div className="flex flex-wrap gap-2">{hasPermission('leads.edit') && <Button size="sm" variant="secondary" icon={Pencil} onClick={() => { setEditing(items.find((item) => item._id === row._id)); setCreateOpen(false); }}>Edit</Button>}{hasPermission('leads.convert') && <Button size="sm" variant="secondary" icon={UserRoundCheck} loading={convertingId === row._id} disabled={Boolean(convertingId)} onClick={() => convertLead(row)}>{row.convertedCustomer ? 'Sync customer data' : 'Convert to customer'}</Button>}</div> }]} rows={items.map((lead) => ({ ...lead, productCategory: lead.productCategory || 'Uncategorized', requirement: lead.requirement || '-' }))} />
      </Card>
      <CrmCreateDialog
        open={createOpen || Boolean(editing)}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        title="Add lead"
        entity="Lead"
        create={crmService.createLead}
        update={crmService.updateLead}
        recordKey="lead"
        onCreated={() => setReload((current) => current + 1)}
        onUpdated={() => setReload((current) => current + 1)}
        initialValues={editing}
        fields={[
          { name: 'name', label: 'Lead name', required: true },
          { name: 'productCategory', label: 'Product category', type: 'custom-select', customOption: '__custom__', required: true, options: [{ value: 'Bagasse', label: 'Bagasse' }, { value: 'Compostable', label: 'Compostable' }, { value: 'Paper', label: 'Paper' }] },
          { name: 'requirement', label: 'Product requirement', multiline: true },
          { name: 'phone', label: 'Phone', type: 'tel' },
          { name: 'alternatePhone', label: 'Alternate phone', type: 'tel' },
          { name: 'email', label: 'Email', type: 'email' },
          { name: 'website', label: 'Website', type: 'url' },
          { name: 'address.line1', label: 'Address line 1' },
          { name: 'address.line2', label: 'Address line 2' },
          { name: 'address.city', label: 'City' },
          { name: 'address.state', label: 'State' },
          { name: 'address.country', label: 'Country', defaultValue: 'India' },
          { name: 'address.pincode', label: 'PIN code' },
          { name: 'gstNumber', label: 'GST number' },
          { name: 'panNumber', label: 'PAN number' },
          { name: 'businessType', label: 'Business type' },
          { name: 'customerType', label: 'Customer type', type: 'select', defaultValue: 'B2C', options: [{ value: 'B2C', label: 'B2C' }, { value: 'B2B', label: 'B2B' }] },
          { name: 'source', label: 'Source', type: 'custom-select', customOption: '__custom__', options: [{ value: 'Website', label: 'Website' }, { value: 'India Mart', label: 'India Mart' }, { value: 'Walk-in', label: 'Walk-in' }] },
          { name: 'expectedValue', label: 'Expected value', type: 'number', min: 0, step: '0.01' },
          { name: 'priority', label: 'Priority', type: 'select', defaultValue: 'medium', options: [{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }] },
          { name: 'status', label: 'Status', type: 'select', defaultValue: 'New', options: statusOptions },
        ]}
      />
    </>
  );
}

const LEAD_MILESTONES = ['New', 'Contacted', 'Approved', 'Samples', 'Follow-up', 'Converted'];
const LEAD_STATUSES = [...LEAD_MILESTONES, 'Lost', 'Unqualified'];

function LeadMilestones({ status }) {
  const currentIndex = LEAD_MILESTONES.indexOf(status);
  const closed = status === 'Lost' || status === 'Unqualified';
  const custom = currentIndex < 0 && !closed;

  return (
    <div className="mt-2" aria-label={`Lead process milestones. Current status: ${status}`}>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Process · {closed ? 'Closed' : custom ? `Custom: ${status}` : `Current: ${status}`}</p>
      <ol className="flex items-start" aria-label="Lead process">
        {LEAD_MILESTONES.map((milestone, index) => {
          const complete = currentIndex >= 0 && index < currentIndex;
          const current = index === currentIndex;
          return (
            <li key={milestone} className="flex min-w-0 flex-1 flex-col items-center" aria-current={current ? 'step' : undefined}>
              <div className="flex w-full items-center">
                {index > 0 && <span className={`h-0.5 flex-1 ${currentIndex >= index ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${complete ? 'border-emerald-500 bg-emerald-500 text-white' : current ? 'border-brand-600 bg-brand-600 text-white ring-2 ring-brand-100' : 'border-slate-300 bg-white text-transparent'}`}>
                  {complete ? <Check className="h-2.5 w-2.5" /> : <span className="h-1 w-1 rounded-full bg-current" />}
                </span>
                {index < LEAD_MILESTONES.length - 1 && <span className={`h-0.5 flex-1 ${currentIndex > index ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
              </div>
              <span className={`mt-1 whitespace-nowrap text-[9px] ${current ? 'font-semibold text-brand-700' : complete ? 'text-emerald-700' : 'text-slate-400'}`}>{milestone}</span>
            </li>
          );
        })}
      </ol>
      {closed && <p className="mt-1 text-[10px] font-medium text-red-600">Closed as {status}</p>}
    </div>
  );
}

function LeadStatusControl({ lead, canEdit, toast, onSaved }) {
  const [selection, setSelection] = useState(LEAD_STATUSES.includes(lead.status) ? lead.status : '__custom__');
  const [customStatus, setCustomStatus] = useState(LEAD_STATUSES.includes(lead.status) ? '' : lead.status);
  const [saving, setSaving] = useState(false);
  const isCustom = selection === '__custom__' || selection === '__rename__';
  const nextStatus = (isCustom ? customStatus : selection).trim();
  const changed = nextStatus && nextStatus !== lead.status;

  useEffect(() => {
    const knownStatus = LEAD_STATUSES.includes(lead.status);
    setSelection(knownStatus ? lead.status : '__custom__');
    setCustomStatus(knownStatus ? '' : lead.status);
  }, [lead.status]);

  async function saveStatus() {
    if (!changed) return;
    setSaving(true);
    try {
      const result = await crmService.updateLead(lead._id, { status: nextStatus });
      onSaved(result.lead);
      toast.success('Lead status updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update lead status.');
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2" onClick={(event) => event.stopPropagation()}>
      <select aria-label={`Change status for ${lead.name}`} value={selection} onChange={(event) => { const value = event.target.value; setSelection(value); if (value === '__rename__') setCustomStatus(lead.status); if (value === '__custom__') setCustomStatus(''); }} className="h-8 rounded-md border border-slate-300 bg-white px-2 text-xs text-slate-700 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100">
        {LEAD_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
        <option value="__custom__">Add custom status…</option>
        <option value="__rename__">Rename current status…</option>
      </select>
      {isCustom && <input aria-label={`Status name for ${lead.name}`} value={customStatus} maxLength={60} onChange={(event) => setCustomStatus(event.target.value)} placeholder={selection === '__rename__' ? 'Enter new status name' : 'Enter status'} className="h-8 w-32 rounded-md border border-slate-300 px-2 text-xs focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100" />}
      {changed && <Button size="sm" onClick={saveStatus} loading={saving}>Save status</Button>}
    </div>
  );
}

function CategoryTab({ active, onClick, children }) {
  return (
    <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-md border px-3 py-1.5 text-sm font-medium ${active ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
      {children}
    </button>
  );
}
