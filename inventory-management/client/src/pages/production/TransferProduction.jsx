import { useEffect, useState } from 'react';
import { ArrowLeftRight, Send } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productionService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Card, Field, Input, PageHeader, ProductPicker, Textarea, WarehouseSelect } from '../../components/ui';
import { dateInputToISO, formatQty, toDateInput } from '../../utils/format';

export default function TransferProduction() {
  const navigate = useNavigate();
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const [product, setProduct] = useState(null);
  const [available, setAvailable] = useState(null);
  const [form, setForm] = useState({ toWarehouse: '', quantity: '', transferDate: toDateInput(), referenceNumber: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    const productId = searchParams.get('product');
    if (!productId) return;
    productionService.available(productId).then((result) => { setProduct(result.product); setAvailable(result.quantity); }).catch(() => {});
  }, [searchParams]);

  useEffect(() => {
    if (!product) { setAvailable(null); return; }
    productionService.available(product._id).then((result) => setAvailable(result.quantity)).catch(() => setAvailable(null));
  }, [product]);

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!product) nextErrors.product = 'Please select a product';
    if (!form.toWarehouse) nextErrors.toWarehouse = 'Please select a destination warehouse';
    if (!form.quantity || Number(form.quantity) <= 0) nextErrors.quantity = 'Enter a quantity greater than zero';
    else if (available !== null && Number(form.quantity) > available) nextErrors.quantity = `Insufficient production stock. Available quantity is ${formatQty(available)} ${product?.stockUnit || ''}.`;
    if (!form.transferDate) nextErrors.transferDate = 'Transfer date is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const result = await productionService.transfer({
        product: product._id,
        toWarehouse: form.toWarehouse,
        unit: product.stockUnit,
        quantity: Number(form.quantity),
        transferDate: dateInputToISO(form.transferDate),
        referenceNumber: form.referenceNumber,
        notes: form.notes,
      });
      toast.success(result.message);
      navigate('/production/stock');
    } catch (error) {
      const parsed = parseError(error);
      setErrors(parsed.fieldErrors);
      toast.error(parsed.message);
      setAvailable(null);
      if (product) productionService.available(product._id).then((result) => setAvailable(result.quantity)).catch(() => {});
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Transfer Production Stock" description="Move central production stock into an active warehouse." breadcrumbs={[{ label: 'Production Stock' }, { label: 'Transfer to Warehouse' }]} />
      <div className="max-w-3xl">
        <form onSubmit={submit} noValidate>
          <Card title="Warehouse transfer" description="The source is Production Stock. The destination receives warehouse inventory and both ledger movements are recorded.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Transfer Date" required htmlFor="transferDate" error={errors.transferDate}>
                <Input id="transferDate" type="date" max={toDateInput()} value={form.transferDate} onChange={set('transferDate')} error={errors.transferDate} />
              </Field>
              <div className="hidden sm:block" />
              <Field label="From" htmlFor="fromProduction" className="sm:col-span-2">
                <Input id="fromProduction" value="Production Stock" disabled />
              </Field>
              <Field label="Product" required htmlFor="transferProduct" error={errors.product} className="sm:col-span-2">
                <ProductPicker id="transferProduct" value={product} onChange={(value) => { setProduct(value); setErrors((current) => ({ ...current, product: '' })); }} activeOnly error={errors.product} />
              </Field>
              <Field label="To Warehouse" required htmlFor="transferWarehouse" error={errors.toWarehouse}>
                <WarehouseSelect id="transferWarehouse" value={form.toWarehouse} onChange={(value) => setForm((current) => ({ ...current, toWarehouse: value }))} activeOnly error={errors.toWarehouse} />
              </Field>
              <Field label="Available Stock" htmlFor="availableProduction" hint="Live Production Stock balance">
                <Input id="availableProduction" value={available === null ? '' : `${formatQty(available)} ${product?.stockUnit || ''}`} disabled placeholder="Select a product" />
              </Field>
              <Field label="Quantity" required htmlFor="transferQuantity" error={errors.quantity}>
                <Input id="transferQuantity" type="number" min="0.001" step="0.001" value={form.quantity} onChange={set('quantity')} error={errors.quantity} placeholder="4000" />
              </Field>
              <Field label="Unit" htmlFor="transferUnit">
                <Input id="transferUnit" value={product?.stockUnit || ''} disabled placeholder="Select a product" />
              </Field>
              <Field label="Reference Number" required={false} htmlFor="transferReference">
                <Input id="transferReference" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="PTR-1001" />
              </Field>
              <div className="hidden sm:block" />
              <Field label="Notes" required={false} htmlFor="transferNotes" className="sm:col-span-2">
                <Textarea id="transferNotes" rows={2} value={form.notes} onChange={set('notes')} />
              </Field>
            </div>
          </Card>
          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="brand" size="lg" icon={saving ? undefined : Send} loading={saving}>Transfer Stock</Button>
          </div>
        </form>
      </div>
    </>
  );
}
