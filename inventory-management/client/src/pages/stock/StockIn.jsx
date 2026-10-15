import { useEffect, useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { stockService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { Button, Card, Field, Input, PageHeader, FormSection, ProductPicker, Textarea, WarehouseSelect } from '../../components/ui';
import { AvailableBox, BalancePreview, QuantityInput, SuccessPanel, validateQty } from '../../components/stock/StockWidgets';
import { useAvailable, useStockPrefill } from '../../components/stock/useStockPrefill';
import { dateInputToISO, formatQty, toDateInput } from '../../utils/format';

export default function StockIn() {
  const toast = useToast();
  const { activeWarehouses, warehouses } = useMeta();
  const prefill = useStockPrefill();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ warehouse: '', quantity: '', date: toDateInput(), referenceNumber: '', supplier: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const available = useAvailable(product?._id, form.warehouse, refreshKey);

  useEffect(() => { if (prefill.product) setProduct(prefill.product); }, [prefill.product]);
  useEffect(() => { if (prefill.warehouseId) setForm((f) => ({ ...f, warehouse: prefill.warehouseId })); }, [prefill.warehouseId]);
  useEffect(() => {
    if (!form.warehouse && activeWarehouses.length === 1) setForm((f) => ({ ...f, warehouse: activeWarehouses[0]._id }));
  }, [activeWarehouses, form.warehouse]);

  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v?.target ? v.target.value : v }));
  const warehouseName = warehouses.find((w) => w._id === form.warehouse)?.name;

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!form.warehouse) errs.warehouse = 'Please select a warehouse';
    if (!product) errs.product = 'Please select a product';
    const q = validateQty(form.quantity);
    if (q) errs.quantity = q;
    if (!form.date) errs.date = 'Date is required';
    else if (form.date > toDateInput()) errs.date = 'Date cannot be in the future';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      const res = await stockService.stockIn({ ...form, product: product._id, unit: product.stockUnit, quantity: Number(form.quantity), date: dateInputToISO(form.date) });
      toast.success(res.message);
      setDone(res);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors);
      toast.error(p.message);
    } finally {
      setSaving(false);
    }
  };

  const again = () => {
    setDone(null);
    setForm((f) => ({ ...f, quantity: '', referenceNumber: '', notes: '' }));
  };

  return (
    <>
      <PageHeader title="Stock In" description="Receive goods into a warehouse. Quantity is added to current stock." breadcrumbs={[{ label: 'Stock' }, { label: 'Stock In' }]} />
      <div className="max-w-3xl">
        {done ? (
          <SuccessPanel
            title="Stock added"
            lines={[
              { label: 'Product', value: done.transaction.product.name },
              { label: 'Warehouse', value: done.transaction.warehouse.name },
              { label: 'Quantity added', value: `+${formatQty(done.transaction.quantity)} ${done.transaction.unit}` },
              { label: 'Stock', value: `${formatQty(done.previousQuantity)} → ${formatQty(done.newQuantity)} ${done.transaction.unit}` },
            ]}
            onAgain={again}
            againLabel="Record another Stock In"
            links={[{ to: `/products/${done.transaction.product._id}`, label: 'View product' }, { to: '/stock/history?type=STOCK_IN', label: 'Stock In history' }]}
          />
        ) : (
          <form onSubmit={submit} noValidate>
            <Card padded={false}>
              <FormSection title="Stock movement">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Date" required htmlFor="date" error={errors.date}>
                  <Input id="date" type="date" max={toDateInput()} value={form.date} onChange={set('date')} error={errors.date} />
                </Field>
                <Field label="Warehouse" required htmlFor="warehouse" error={errors.warehouse}>
                  <WarehouseSelect id="warehouse" activeOnly value={form.warehouse} onChange={set('warehouse')} error={errors.warehouse} />
                </Field>
                <Field label="Product" required htmlFor="product" error={errors.product} className="sm:col-span-2">
                  <ProductPicker id="product" value={product} onChange={setProduct} error={errors.product} activeOnly />
                </Field>
                <div className="sm:col-span-2"><AvailableBox label="Current stock" state={available} warehouseName={warehouseName} /></div>
                <Field label="Quantity" required htmlFor="quantity" error={errors.quantity}>
                  <QuantityInput id="quantity" value={form.quantity} onChange={set('quantity')} unit={product?.stockUnit} error={errors.quantity} />
                </Field>
                <Field label="Unit" htmlFor="unit" hint="Stock unit of the product">
                  <Input id="unit" value={product?.stockUnit || ''} disabled placeholder="Select a product" />
                </Field>
                <div className="sm:col-span-2"><BalancePreview before={available.quantity} change={form.quantity} unit={product?.stockUnit} sign="+" /></div>
              </div>
              </FormSection>
              <FormSection title="Reference details">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Reference Number" required={false} htmlFor="ref" hint="GRN, invoice or PO number">
                  <Input id="ref" value={form.referenceNumber} onChange={set('referenceNumber')} />
                </Field>
                <Field label="Supplier" required={false} htmlFor="supplier">
                  <Input id="supplier" value={form.supplier} onChange={set('supplier')} />
                </Field>
                <Field label="Notes" required={false} htmlFor="notes" className="sm:col-span-2">
                  <Textarea id="notes" rows={2} value={form.notes} onChange={set('notes')} />
                </Field>
              </div>
              </FormSection>
            </Card>
            <div className="mt-5 flex justify-end">
              <Button type="submit" variant="success" size="lg" icon={ArrowDownToLine} loading={saving}>Add Stock</Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
