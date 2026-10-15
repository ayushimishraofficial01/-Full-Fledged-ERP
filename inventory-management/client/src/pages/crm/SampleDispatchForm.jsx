import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { crmService } from '../../services';
import { useToast } from '../../context/ToastContext';
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';

const STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
const localDate = (value) => {
  if (!value) return new Date().toISOString().slice(0, 10);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};
const localAddress = (address = {}) => [address.line1, address.line2].filter(Boolean).join(', ');

function initialForm(dispatch) {
  return {
    customer: dispatch?.customer?._id || dispatch?.customer || '',
    customerName: dispatch?.customerName || '',
    companyName: dispatch?.companyName || '',
    phone: dispatch?.phone || '',
    email: dispatch?.email || '',
    completeAddress: dispatch?.completeAddress || '',
    city: dispatch?.city || '',
    state: dispatch?.state || '',
    pincode: dispatch?.pincode || '',
    sampleProducts: dispatch?.sampleProducts?.length ? dispatch.sampleProducts.map((item) => ({ product: item.product?._id || item.product || '', quantity: item.quantity, unit: item.unit || item.product?.stockUnit || '' })) : [{ product: '', quantity: 1, unit: '' }],
    dispatchDate: localDate(dispatch?.dispatchDate),
    dispatchMethod: dispatch?.dispatchMethod || '',
    trackingNumber: dispatch?.trackingNumber || '',
    expectedDeliveryDate: dispatch?.expectedDeliveryDate ? localDate(dispatch.expectedDeliveryDate) : '',
    status: dispatch?.status || 'Pending',
    remarks: dispatch?.remarks || '',
  };
}

export default function SampleDispatchForm({ open, onClose, dispatch, onSaved }) {
  const [form, setForm] = useState(() => initialForm(dispatch));
  const [options, setOptions] = useState({ customers: [], products: [], units: [] });
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();
  const editing = Boolean(dispatch?._id);

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(dispatch));
    setError('');
  }, [open, dispatch]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    setLoadingOptions(true);
    crmService.sampleDispatchOptions()
      .then((data) => active && setOptions(data))
      .catch((err) => active && setError(err.response?.data?.message || 'Unable to load customers and products.'))
      .finally(() => active && setLoadingOptions(false));
    return () => { active = false; };
  }, [open]);

  const setValue = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  function selectCustomer(id) {
    const customer = options.customers.find((item) => item._id === id);
    setForm((current) => ({
      ...current,
      customer: id,
      ...(customer ? {
        customerName: customer.fullName || '',
        companyName: customer.company?.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        completeAddress: localAddress(customer.address),
        city: customer.address?.city || '',
        state: customer.address?.state || '',
        pincode: customer.address?.pincode || '',
      } : {}),
    }));
  }

  function updateItem(index, name, value) {
    setForm((current) => ({
      ...current,
      sampleProducts: current.sampleProducts.map((item, itemIndex) => {
        if (itemIndex !== index) return item;
        if (name === 'product') {
          const product = options.products.find((entry) => entry._id === value);
          return { ...item, product: value, unit: product?.stockUnit || item.unit || '' };
        }
        return { ...item, [name]: value };
      }),
    }));
  }

  function addItem() {
    setForm((current) => ({ ...current, sampleProducts: [...current.sampleProducts, { product: '', quantity: 1, unit: '' }] }));
  }

  function removeItem(index) {
    setForm((current) => ({ ...current, sampleProducts: current.sampleProducts.filter((_, itemIndex) => itemIndex !== index) }));
  }

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    const payload = {
      ...form,
      customer: form.customer || null,
      expectedDeliveryDate: form.expectedDeliveryDate || null,
      sampleProducts: form.sampleProducts.map((item) => ({ ...item, quantity: Number(item.quantity) })),
    };
    try {
      const result = editing ? await crmService.updateSampleDispatch(dispatch._id, payload) : await crmService.createSampleDispatch(payload);
      toast.success(result.message || `Sample dispatch ${editing ? 'updated' : 'created'}.`);
      onSaved(result.dispatch);
      onClose();
    } catch (err) {
      const message = err.response?.data?.message || 'Unable to save sample dispatch.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  const footer = (
    <>
      <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
      <Button type="submit" form="sample-dispatch-form" loading={saving} disabled={loadingOptions}>{editing ? 'Save changes' : 'Create dispatch'}</Button>
    </>
  );

  return (
    <Modal open={open} onClose={onClose} title={editing ? `Edit ${dispatch.dispatchId}` : 'Add Sample Dispatch'} description="Record a sample shipment for a CRM customer or new contact." size="xl" footer={footer}>
      <form id="sample-dispatch-form" onSubmit={submit} className="space-y-5">
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Existing CRM customer" htmlFor="dispatch-customer" hint="Selecting a customer fills in their contact details.">
            <Select id="dispatch-customer" value={form.customer} onChange={(event) => selectCustomer(event.target.value)}>
              <option value="">Manual customer / no CRM link</option>
              {options.customers.map((customer) => <option key={customer._id} value={customer._id}>{customer.fullName}{customer.phone ? ` · ${customer.phone}` : ''}</option>)}
            </Select>
          </Field>
          <Field label="Customer name" htmlFor="dispatch-customer-name" required>
            <Input id="dispatch-customer-name" value={form.customerName} onChange={(event) => setValue('customerName', event.target.value)} required maxLength={160} />
          </Field>
          <Field label="Company name" htmlFor="dispatch-company"><Input id="dispatch-company" value={form.companyName} onChange={(event) => setValue('companyName', event.target.value)} /></Field>
          <Field label="Phone number" htmlFor="dispatch-phone"><Input id="dispatch-phone" type="tel" value={form.phone} onChange={(event) => setValue('phone', event.target.value)} /></Field>
          <Field label="Email" htmlFor="dispatch-email"><Input id="dispatch-email" type="email" value={form.email} onChange={(event) => setValue('email', event.target.value)} /></Field>
          <Field label="Complete address" htmlFor="dispatch-address"><Input id="dispatch-address" value={form.completeAddress} onChange={(event) => setValue('completeAddress', event.target.value)} /></Field>
          <Field label="City" htmlFor="dispatch-city"><Input id="dispatch-city" value={form.city} onChange={(event) => setValue('city', event.target.value)} /></Field>
          <Field label="State" htmlFor="dispatch-state"><Input id="dispatch-state" value={form.state} onChange={(event) => setValue('state', event.target.value)} /></Field>
          <Field label="PIN code" htmlFor="dispatch-pincode"><Input id="dispatch-pincode" value={form.pincode} onChange={(event) => setValue('pincode', event.target.value)} /></Field>
        </section>

        <section className="border-t border-slate-100 pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div><h3 className="text-sm font-semibold text-slate-900">Sample products</h3><p className="text-xs text-slate-500">Add one or more product and quantity lines.</p></div>
            <Button type="button" variant="secondary" size="sm" icon={Plus} onClick={addItem}>Add product</Button>
          </div>
          <div className="space-y-3">
            {form.sampleProducts.map((item, index) => (
              <div key={index} className="grid grid-cols-1 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(12rem,1fr)_8rem_8rem_auto]">
                <Field label={index === 0 ? 'Product' : `Product ${index + 1}`} htmlFor={`dispatch-product-${index}`} required>
                  <Select id={`dispatch-product-${index}`} value={item.product} onChange={(event) => updateItem(index, 'product', event.target.value)} required>
                    <option value="">Select product</option>
                    {options.products.map((product) => <option key={product._id} value={product._id}>{product.name} · {product.sku}</option>)}
                  </Select>
                </Field>
                <Field label={index === 0 ? 'Sample quantity' : 'Quantity'} htmlFor={`dispatch-quantity-${index}`} required>
                  <Input id={`dispatch-quantity-${index}`} type="number" min="0.001" step="0.001" value={item.quantity} onChange={(event) => updateItem(index, 'quantity', event.target.value)} required />
                </Field>
                <Field label={index === 0 ? 'Unit' : 'Unit'} htmlFor={`dispatch-unit-${index}`} required>
                  <Select id={`dispatch-unit-${index}`} value={item.unit} onChange={(event) => updateItem(index, 'unit', event.target.value)} required>
                    <option value="">Select unit</option>
                    {item.unit && !options.units.includes(item.unit) && <option value={item.unit}>{item.unit}</option>}
                    {options.units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </Select>
                </Field>
                <Button type="button" size="icon" variant="danger-ghost" icon={Trash2} onClick={() => removeItem(index)} disabled={form.sampleProducts.length === 1} title="Remove product" aria-label="Remove product" />
              </div>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2">
          <Field label="Dispatch date" htmlFor="dispatch-date" required><Input id="dispatch-date" type="date" value={form.dispatchDate} onChange={(event) => setValue('dispatchDate', event.target.value)} required /></Field>
          <Field label="Status" htmlFor="dispatch-status" required>
            <Select id="dispatch-status" value={form.status} onChange={(event) => setValue('status', event.target.value)} required>
              {STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
            </Select>
          </Field>
          <Field label="Dispatch method / courier" htmlFor="dispatch-method"><Input id="dispatch-method" value={form.dispatchMethod} onChange={(event) => setValue('dispatchMethod', event.target.value)} /></Field>
          <Field label="Tracking number" htmlFor="dispatch-tracking"><Input id="dispatch-tracking" value={form.trackingNumber} onChange={(event) => setValue('trackingNumber', event.target.value)} /></Field>
          <Field label="Expected delivery date" htmlFor="dispatch-expected"><Input id="dispatch-expected" type="date" value={form.expectedDeliveryDate} onChange={(event) => setValue('expectedDeliveryDate', event.target.value)} /></Field>
          <Field label="Remarks / notes" htmlFor="dispatch-remarks" className="sm:col-span-2"><Textarea id="dispatch-remarks" value={form.remarks} onChange={(event) => setValue('remarks', event.target.value)} /></Field>
        </section>
      </form>
    </Modal>
  );
}
