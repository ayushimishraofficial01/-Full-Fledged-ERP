import { useEffect, useState } from 'react';
import { crmService } from '../../services';
import { useToast } from '../../context/ToastContext';
import { Button, Field, Modal, Textarea } from '../../components/ui';

export default function CustomerNotesDialog({ customer, onClose, canCreate }) {
  const [items, setItems] = useState([]);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    let active = true;
    setLoading(true);
    crmService.notes({ customer: customer._id })
      .then((res) => active && setItems(res.items || []))
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load customer notes.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [customer._id, toast]);

  async function submit(event) {
    event.preventDefault();
    const text = description.trim();
    if (!text) return;
    setSaving(true);
    try {
      const result = await crmService.createNote({ customer: customer._id, title: 'Customer conversation', description: text });
      const note = result.note || result.item;
      if (note) setItems((current) => [note, ...current]);
      setDescription('');
      toast.success('Customer note saved.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save customer note.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={Boolean(customer)} onClose={onClose} title={`${customer.fullName} · Notes`} description="Conversation history for this customer." size="lg">
      <div className="max-h-64 space-y-3 overflow-y-auto">
        {loading && <p className="text-sm text-slate-500">Loading notes…</p>}
        {!loading && items.length === 0 && <p className="text-sm text-slate-500">No conversation notes yet.</p>}
        {items.map((note) => (
          <article key={note._id} className="border-b border-slate-100 pb-3 last:border-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-800">{note.title}</h3>
              <time className="text-xs text-slate-500">{new Date(note.createdAt).toLocaleString()}</time>
            </div>
            <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{note.description}</p>
          </article>
        ))}
      </div>
      {canCreate && (
        <form id="customer-note-form" onSubmit={submit} className="mt-4 border-t border-slate-100 pt-4">
          <Field label="What did you discuss with this customer?" htmlFor="customer-note-description" required>
            <Textarea id="customer-note-description" name="description" value={description} onChange={(event) => setDescription(event.target.value)} required placeholder="Add the conversation summary…" />
          </Field>
          <div className="mt-3 flex justify-end">
            <Button type="submit" loading={saving}>Add note</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
