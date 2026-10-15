import { useEffect, useState } from 'react';
import CustomerLookup from '../../components/CustomerLookup';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';

function fieldValue(field, initialValues) {
  const value = field.name.split('.').reduce((current, key) => current?.[key], initialValues) ?? field.defaultValue ?? '';
  if (!value) return '';
  if (field.type === 'date') return new Date(value).toISOString().slice(0, 10);
  if (field.type === 'datetime-local') {
    const date = new Date(value);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }
  return value;
}

export default function CrmCreateDialog({ open, onClose, title, entity, fields, create, update, recordKey, onCreated, onUpdated, initialValues }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerPrefill, setCustomerPrefill] = useState(null);
  const [prefillRevision, setPrefillRevision] = useState(0);
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canLookupCustomers = hasPermission('customers.lookup') || hasPermission('customers.view');
  const isEditing = Boolean(initialValues?._id);

  useEffect(() => {
    if (open) {
      setError('');
      setCustomerSearch('');
      setCustomerPrefill(null);
      setPrefillRevision((current) => current + 1);
    }
  }, [open, initialValues?._id]);

  function prefillLead(customer) {
    setCustomerSearch(customer.fullName || '');
    setCustomerPrefill({
      name: customer.fullName || '',
      phone: customer.phone || '',
      alternatePhone: customer.alternatePhone || '',
      email: customer.email || '',
      website: customer.website || '',
      address: customer.address || {},
      gstNumber: customer.gstNumber || '',
      panNumber: customer.panNumber || '',
      businessType: customer.businessType || '',
      industry: customer.industry || '',
      customerType: customer.customerType || 'B2C',
      source: customer.leadSource || '',
      productCategory: customer.productCategory || '',
      requirement: customer.requirement || '',
      expectedValue: customer.expectedValue || '',
      expectedClosingDate: customer.expectedClosingDate || '',
      priority: customer.priority || 'medium',
    });
    setPrefillRevision((current) => current + 1);
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    const payload = {};

    for (const field of fields) {
      if (field.type === 'custom-select') {
        const choice = formData.get(`${field.name}__choice`);
        const value = choice === field.customOption ? formData.get(`${field.name}__custom`) : choice;
        if (value === null || value === '') continue;
        setPayloadValue(payload, field.name, String(value).trim());
        continue;
      }
      if (field.type === 'checkbox') {
        setPayloadValue(payload, field.name, formData.get(field.name) === 'on');
        continue;
      }
      const value = formData.get(field.name);
      if (value === null || value === '') continue;
      setPayloadValue(payload, field.name, field.type === 'number' ? Number(value) : String(value).trim());
    }

    try {
      const result = isEditing ? await update(initialValues._id, payload) : await create(payload);
      const record = result?.[recordKey] || result?.item;
      if (isEditing) onUpdated(record);
      else onCreated(record);
      toast.success(`${entity} ${isEditing ? 'updated' : 'created'} successfully.`);
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || `Unable to ${isEditing ? 'update' : 'create'} ${entity.toLowerCase()}.`;
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? title.replace(/^Add/, 'Edit') : title} size="lg">
      {entity === 'Lead' && canLookupCustomers && (
        <div className="mb-4">
          <CustomerLookup
            label="Fill details from an existing customer"
            value={customerSearch}
            onChange={(value) => { setCustomerSearch(value); setCustomerPrefill(null); }}
            onSelect={prefillLead}
            placeholder="Search customer by name, phone, email or GSTIN"
          />
        </div>
      )}
      <form key={`${initialValues?._id || 'new'}-${prefillRevision}`} id="crm-create-form" onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {fields.map((field) => {
            const id = `crm-${field.name}`;
            const values = customerPrefill ? { ...initialValues, ...customerPrefill } : initialValues;
            if (field.type === 'checkbox') {
              return (
                <label key={field.name} htmlFor={id} className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
                  <input id={id} name={field.name} type="checkbox" defaultChecked={initialValues ? Boolean(initialValues[field.name]) : field.defaultChecked} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  {field.label}
                </label>
              );
            }
            if (field.type === 'custom-select') {
              return <CustomSelectField key={`${field.name}-${initialValues?._id || 'new'}-${prefillRevision}-${open}`} field={field} id={id} initialValue={fieldValue(field, values)} />;
            }
            return (
              <Field key={field.name} label={field.label} htmlFor={id} required={field.required} className={field.multiline ? 'sm:col-span-2' : ''}>
                {field.type === 'select' ? (
                  <Select id={id} name={field.name} required={field.required} defaultValue={fieldValue(field, values)} placeholder={`Select ${field.label.toLowerCase()}`}>
                    {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </Select>
                ) : field.multiline ? (
                  <Textarea id={id} name={field.name} required={field.required} defaultValue={fieldValue(field, values)} placeholder={field.placeholder || ''} />
                ) : (
                  <Input id={id} name={field.name} type={field.type || 'text'} required={field.required} min={field.min} step={field.step} defaultValue={fieldValue(field, values)} placeholder={field.placeholder || ''} />
                )}
              </Field>
            );
          })}
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </form>
      <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
        <Button type="submit" form="crm-create-form" loading={saving}>{isEditing ? 'Save changes' : `Create ${entity}`}</Button>
      </div>
    </Modal>
  );
}

function CustomSelectField({ field, id, initialValue }) {
  const isKnownValue = field.options.some((option) => option.value === initialValue);
  const [selection, setSelection] = useState(isKnownValue ? initialValue : initialValue ? field.customOption : field.defaultValue || '');
  const [customValue, setCustomValue] = useState(isKnownValue ? '' : initialValue || '');

  return (
    <>
      <Field label={field.label} htmlFor={id} required={field.required}>
        <Select id={id} name={`${field.name}__choice`} value={selection} onChange={(event) => setSelection(event.target.value)} required={field.required} placeholder={`Select ${field.label.toLowerCase()}`}>
          {field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          <option value={field.customOption}>Others</option>
        </Select>
      </Field>
      {selection === field.customOption && (
        <Field label={`${field.label} (specify)`} htmlFor={`${id}-custom`} required={field.required}>
          <Input id={`${id}-custom`} name={`${field.name}__custom`} value={customValue} onChange={(event) => setCustomValue(event.target.value)} required={field.required} placeholder="Enter source" />
        </Field>
      )}
    </>
  );
}

function setPayloadValue(payload, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const target = keys.reduce((current, key) => current[key] || (current[key] = {}), payload);
  target[lastKey] = value;
}
