import { useEffect, useState } from 'react';
import { ArrowLeftRight, ArrowDown } from 'lucide-react';
import { stockService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { Button, Card, ConfirmDialog, Field, Input, PageHeader, FormSection, ProductPicker, Textarea, WarehouseSelect } from '../../components/ui';
import { AvailableBox, QuantityInput, SuccessPanel, validateQty } from '../../components/stock/StockWidgets';
import { useAvailable, useStockPrefill } from '../../components/stock/useStockPrefill';
import { dateInputToISO, formatQty, toDateInput } from '../../utils/format';

function Projection({ label, before, after, unit, tone }) {
  return (
    <div className="flex-1 rounded-lg border border-slate-200 bg-white p-3">
      <p className="truncate text-xs font-medium text-slate-500">{label}</p>
      <p className="num mt-1 text-sm">
        {formatQty(before)} → <span className={`font-semibold ${tone}`}>{formatQty(after)}</span> <span className="text-xs text-slate-500">{unit}</span>
      </p>
    </div>
  );
}

export default function StockTransfer() {
  const toast = useToast();
  const { warehouses } = useMeta();
  const prefill = useStockPrefill();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ fromWarehouse: '', toWarehouse: '', quantity: '', date: toDateInput(), referenceNumber: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const source = useAvailable(product?._id, form.fromWarehouse, refreshKey);
  const dest = useAvailable(product?._id, form.toWarehouse, refreshKey);

  useEffect(() => { if (prefill.product) setProduct(prefill.product); }, [prefill.product]);
  useEffect(() => { if (prefill.warehouseId) setForm((f) => ({ ...f, fromWarehouse: prefill.warehouseId })); }, [prefill.warehouseId]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
  const name = (id) => warehouses.find((w) => w._id === id)?.name;
  const qty = Number(form.quantity);
  const validQty = form.quantity !== '' && qty > 0;

  const swap = () => setForm((f) => ({ ...f, fromWarehouse: f.toWarehouse, toWarehouse: f.fromWarehouse }));

  const review = (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.fromWarehouse) errs.fromWarehouse = 'Please select the source warehouse';
    if (!form.toWarehouse) errs.toWarehouse = 'Please select the destination warehouse';
    if (form.fromWarehouse && form.fromWarehouse === form.toWarehouse) errs.toWarehouse = 'Source and destination warehouse must be different';
    if (!product) errs.product = 'Please select a product';
    const q = validateQty(form.quantity, { max: source.quantity ?? undefined });
    if (q) errs.quantity = q;
    if (!form.date) errs.date = 'Date is required';
    else if (form.date > toDateInput()) errs.date = 'Date cannot be in the future';
    setErrors(errs);
    if (!Object.keys(errs).length) setConfirming(true);
  };

  const submit = async () => {
    setSaving(true);
    try {
      const res = await stockService.transfer({ ...form, product: product._id, unit: product.stockUnit, quantity: qty, date: dateInputToISO(form.date) });
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

  return (
    <>
      <PageHeader title="Stock Transfer" description="Move stock between warehouses. Both sides update together; nothing is lost." breadcrumbs={[{ label: 'Stock' }, { label: 'Stock Transfer' }]} />
      <div className="max-w-3xl">
        {done ? (
          <SuccessPanel
            title="Transfer completed"
            lines={[
              { label: 'Product', value: done.transfer.product.name },
              { label: 'Quantity', value: `${formatQty(done.transfer.quantity)} ${done.transfer.unit}` },
              { label: done.source.warehouse, value: `${formatQty(done.source.previousQuantity)} → ${formatQty(done.source.newQuantity)}` },
              { label: done.destination.warehouse, value: `${formatQty(done.destination.previousQuantity)} → ${formatQty(done.destination.newQuantity)}` },
            ]}
            onAgain={() => { setDone(null); setForm((f) => ({ ...f, quantity: '', referenceNumber: '', notes: '' })); }}
            againLabel="New transfer"
            links={[{ to: '/reports/transfers', label: 'Transfer report' }]}
          />
        ) : (
          <form onSubmit={review} noValidate>
            <Card padded={false}>
              <FormSection title="Transfer details">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Date" required htmlFor="date" error={errors.date}>
                  <Input id="date" type="date" max={toDateInput()} value={form.date} onChange={set('date')} error={errors.date} />
                </Field>
                <div className="hidden sm:block" />
                <Field label="Product" required htmlFor="product" error={errors.product} className="sm:col-span-2">
                  <ProductPicker id="product" value={product} onChange={setProduct} error={errors.product} />
                </Field>

                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 sm:col-span-2">
                  <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-[1fr_auto_1fr]">
                    <Field label="From Warehouse" required htmlFor="from" error={errors.fromWarehouse}>
                      <WarehouseSelect id="from" value={form.fromWarehouse} onChange={set('fromWarehouse')} error={errors.fromWarehouse} placeholder="Source" />
                      <div className="mt-2"><AvailableBox label="Available" state={source} /></div>
                    </Field>
                    <button type="button" onClick={swap} className="mx-auto mt-0 rounded-full border border-slate-300 bg-white p-2 text-slate-500 shadow-xs hover:text-slate-800 sm:mt-7" title="Swap warehouses" aria-label="Swap warehouses">
                      <ArrowLeftRight className="hidden h-4 w-4 sm:block" />
                      <ArrowDown className="h-4 w-4 sm:hidden" />
                    </button>
                    <Field label="To Warehouse" required htmlFor="to" error={errors.toWarehouse}>
                      <WarehouseSelect id="to" activeOnly value={form.toWarehouse} onChange={set('toWarehouse')} exclude={form.fromWarehouse} error={errors.toWarehouse} placeholder="Destination" />
                      <div className="mt-2"><AvailableBox label="Currently" state={dest} /></div>
                    </Field>
                  </div>
                </div>

                <Field label="Quantity" required htmlFor="quantity" error={errors.quantity}>
                  <QuantityInput id="quantity" value={form.quantity} onChange={set('quantity')} unit={product?.stockUnit} error={errors.quantity} max={source.quantity ?? undefined} />
                </Field>
                <Field label="Unit" htmlFor="unit" hint="Stock unit of the product">
                  <Input id="unit" value={product?.stockUnit || ''} disabled placeholder="Select a product" />
                </Field>

                {validQty && source.quantity !== null && dest.quantity !== null && form.fromWarehouse !== form.toWarehouse && (
                  <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row">
                    <Projection label={name(form.fromWarehouse)} before={source.quantity} after={source.quantity - qty} unit={product?.stockUnit} tone={source.quantity - qty < 0 ? 'text-red-600' : 'text-slate-900'} />
                    <Projection label={name(form.toWarehouse)} before={dest.quantity} after={dest.quantity + qty} unit={product?.stockUnit} tone="text-emerald-700" />
                  </div>
                )}

              </div>
              </FormSection>
              <FormSection title="Reference details">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Reference Number" required={false} htmlFor="ref">
                  <Input id="ref" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="e.g. TRF-1001" />
                </Field>
                <div className="hidden sm:block" />
                <Field label="Notes" required={false} htmlFor="notes" className="sm:col-span-2">
                  <Textarea id="notes" rows={2} value={form.notes} onChange={set('notes')} />
                </Field>
              </div>
              </FormSection>
            </Card>
            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="brand" size="lg" icon={ArrowLeftRight}>Review Transfer</Button>
            </div>
          </form>
        )}
      </div>
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={submit}
        loading={saving}
        tone="info"
        title="Confirm Stock Transfer"
        confirmLabel="Confirm Transfer"
        message={product && `Are you sure you want to transfer ${formatQty(qty)} ${product.stockUnit} of ${product.name} from ${name(form.fromWarehouse)} to ${name(form.toWarehouse)}?`}
      />
    </>
  );
}
