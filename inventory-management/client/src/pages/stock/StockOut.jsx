import { useEffect, useState } from 'react';
import { ArrowUpFromLine } from 'lucide-react';
import CustomerLookup from '../../components/CustomerLookup';
import { stockService } from '../../services';
import { parseError } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { Button, Card, ConfirmDialog, Field, Input, PageHeader, FormSection, ProductPicker, Select, Textarea, WarehouseSelect } from '../../components/ui';
import { AvailableBox, BalancePreview, QuantityInput, SuccessPanel, validateQty } from '../../components/stock/StockWidgets';
import { useAvailable, useStockPrefill } from '../../components/stock/useStockPrefill';
import { dateInputToISO, formatQty, STOCK_OUT_REASONS, toDateInput } from '../../utils/format';

export default function StockOut() {
  const toast = useToast();
  const { warehouses } = useMeta();
  const { hasPermission } = useAuth();
  const prefill = useStockPrefill();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ warehouse: '', quantity: '', date: toDateInput(), reason: '', customReason: '', referenceNumber: '', customer: '', customerName: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const available = useAvailable(product?._id, form.warehouse, refreshKey);

  useEffect(() => { if (prefill.product) setProduct(prefill.product); }, [prefill.product]);
  useEffect(() => { if (prefill.warehouseId) setForm((f) => ({ ...f, warehouse: prefill.warehouseId })); }, [prefill.warehouseId]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
  const warehouseName = warehouses.find((w) => w._id === form.warehouse)?.name;
  const reason = form.reason === 'Other' ? form.customReason.trim() : form.reason;
  const canLookupCustomers = hasPermission('customers.lookup') || hasPermission('customers.view');

  const selectCustomer = (customer) => {
    setForm((current) => ({ ...current, customer: customer._id, customerName: customer.fullName || '' }));
  };

  const review = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.warehouse) errs.warehouse = 'Please select a warehouse';
    if (!product) errs.product = 'Please select a product';
    const q = validateQty(form.quantity, { max: available.quantity ?? undefined });
    if (q) errs.quantity = q;
    if (!reason) errs.reason = 'Reason is required';
    if (!form.date) errs.date = 'Date is required';
    else if (form.date > toDateInput()) errs.date = 'Date cannot be in the future';
    setErrors(errs);
    if (!Object.keys(errs).length) setConfirming(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await stockService.stockOut({
        warehouse: form.warehouse,
        product: product._id,
        ...(form.customer ? { customer: form.customer } : {}),
        customerName: form.customerName,
        unit: product.stockUnit,
        quantity: Number(form.quantity),
        reason,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
        date: dateInputToISO(form.date),
      });
      toast.success(res.message);
      setDone(res);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors);
      toast.error(p.message);
      setRefreshKey((k) => k + 1);
    } finally {
      setSaving(false);
      setConfirming(false);
    }
  };

  const again = () => {
    setDone(null);
    setForm((f) => ({ ...f, quantity: '', referenceNumber: '', customer: '', customerName: '', notes: '' }));
  };

  return (
    <>
      <PageHeader title="Stock Out" description="Remove stock from a warehouse. Stock can never go below zero." breadcrumbs={[{ label: 'Stock' }, { label: 'Stock Out' }]} />
      <div className="max-w-3xl">
        {done ? (
          <SuccessPanel
            title="Stock removed"
            lines={[
              { label: 'Product', value: done.transaction.product.name },
              { label: 'Warehouse', value: done.transaction.warehouse.name },
              { label: 'Quantity removed', value: `−${formatQty(done.transaction.quantity)} ${done.transaction.unit}` },
              ...(done.transaction.customerName ? [{ label: 'Customer', value: done.transaction.customerName }] : []),
              ...(done.transaction.referenceNumber ? [{ label: 'Invoice number', value: done.transaction.referenceNumber }] : []),
              { label: 'Stock', value: `${formatQty(done.previousQuantity)} → ${formatQty(done.newQuantity)} ${done.transaction.unit}` },
            ]}
            onAgain={again}
            againLabel="Record another Stock Out"
            links={[{ to: `/products/${done.transaction.product._id}`, label: 'View product' }, { to: '/stock/history?type=STOCK_OUT', label: 'Stock Out history' }]}
          />
        ) : (
          <form onSubmit={review} noValidate>
            <Card padded={false}>
              <FormSection title="Stock movement">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Date" required htmlFor="date" error={errors.date}>
                  <Input id="date" type="date" max={toDateInput()} value={form.date} onChange={set('date')} error={errors.date} />
                </Field>
                <Field label="Warehouse" required htmlFor="warehouse" error={errors.warehouse}>
                  <WarehouseSelect id="warehouse" value={form.warehouse} onChange={set('warehouse')} error={errors.warehouse} />
                </Field>
                <Field label="Product" required htmlFor="product" error={errors.product} className="sm:col-span-2">
                  <ProductPicker id="product" value={product} onChange={setProduct} error={errors.product} />
                </Field>
                <div className="sm:col-span-2"><AvailableBox state={available} warehouseName={warehouseName} /></div>
                <Field label="Quantity" required htmlFor="quantity" error={errors.quantity}>
                  <QuantityInput id="quantity" value={form.quantity} onChange={set('quantity')} unit={product?.stockUnit} error={errors.quantity} max={available.quantity ?? undefined} />
                  {available.quantity > 0 && (
                    <button type="button" className="mt-1.5 text-xs font-medium text-brand-600 hover:text-brand-700" onClick={() => set('quantity')(String(available.quantity))}>
                      Use all ({formatQty(available.quantity)})
                    </button>
                  )}
                </Field>
                <Field label="Unit" htmlFor="unit" hint="Stock unit of the product">
                  <Input id="unit" value={product?.stockUnit || ''} disabled placeholder="Select a product" />
                </Field>
                <div className="sm:col-span-2"><BalancePreview before={available.quantity} change={form.quantity} unit={product?.stockUnit} sign="-" /></div>
              </div>
              </FormSection>
              <FormSection title="Reason & reference">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                {canLookupCustomers ? (
                    <CustomerLookup
                      id="customerName"
                      label=""
                      value={form.customerName}
                      onChange={(value) => setForm((current) => ({ ...current, customer: '', customerName: value }))}
                      onSelect={selectCustomer}
                      placeholder="Search existing customer or type a name"
                    />
                  ) : (
                    <Field label="Customer name" required={false} htmlFor="customerName">
                    <Input id="customerName" value={form.customerName} onChange={(event) => setForm((current) => ({ ...current, customer: '', customerName: event.target.value }))} />
                    </Field>
                  )}
                <Field label="Reason" required htmlFor="reason" error={errors.reason}>
                  <Select id="reason" value={form.reason} onChange={set('reason')} error={errors.reason} placeholder="Select a reason">
                    {STOCK_OUT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </Select>
                  {form.reason === 'Other' && <Input className="mt-2" placeholder="Describe the reason" value={form.customReason} onChange={set('customReason')} />}
                </Field>
                <Field label="Invoice Number" required={false} htmlFor="ref">
                  <Input id="ref" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="Enter invoice number" />
                </Field>
                <Field label="Notes" required={false} htmlFor="notes" className="sm:col-span-2">
                  <Textarea id="notes" rows={2} value={form.notes} onChange={set('notes')} />
                </Field>
              </div>
              </FormSection>
            </Card>
            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="danger" size="lg" icon={ArrowUpFromLine}>Review Stock Out</Button>
            </div>
          </form>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        loading={saving}
        title="Confirm Stock Out"
        confirmLabel="Confirm Stock Out"
        message={product && `Are you sure you want to remove ${formatQty(form.quantity)} ${product.stockUnit} of ${product.name} from ${warehouseName}? Reason: ${reason}.`}
      />
    </>
  );
}
