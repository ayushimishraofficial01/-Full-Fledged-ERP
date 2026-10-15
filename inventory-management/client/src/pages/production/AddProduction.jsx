import { useState } from 'react';
import { Factory, Save } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { productionService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { Button, Card, Field, Input, PageHeader, ProductPicker, Textarea } from '../../components/ui';
import { dateInputToISO, toDateInput } from '../../utils/format';

export default function AddProduction() {
  const navigate = useNavigate();
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [form, setForm] = useState({ productionDate: toDateInput(), quantityProduced: '', batchNumber: '', referenceNumber: '', notes: '' });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    const nextErrors = {};
    if (!product) nextErrors.product = 'Please select a product';
    if (!form.quantityProduced || Number(form.quantityProduced) <= 0) nextErrors.quantityProduced = 'Enter a quantity greater than zero';
    if (!form.productionDate) nextErrors.productionDate = 'Production date is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSaving(true);
    try {
      const result = await productionService.add({
        product: product._id,
        unit: product.stockUnit,
        quantityProduced: Number(form.quantityProduced),
        productionDate: dateInputToISO(form.productionDate),
        batchNumber: form.batchNumber,
        referenceNumber: form.referenceNumber,
        notes: form.notes,
      });
      toast.success(result.message);
      navigate('/production/stock');
    } catch (error) {
      const parsed = parseError(error);
      setErrors(parsed.fieldErrors);
      toast.error(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageHeader title="Add Production" description="Record manufactured goods into central Production Stock." breadcrumbs={[{ label: 'Production Stock' }, { label: 'Add Production' }]} />
      <div className="max-w-3xl">
        <form onSubmit={submit} noValidate>
          <Card title="Production entry" description="This increases Production Stock and creates a PRODUCTION_IN ledger entry.">
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <Field label="Production Date" required htmlFor="productionDate" error={errors.productionDate}>
                <Input id="productionDate" type="date" max={toDateInput()} value={form.productionDate} onChange={set('productionDate')} error={errors.productionDate} />
              </Field>
              <div className="hidden sm:block" />
              <Field label="Product" required htmlFor="productionProduct" error={errors.product} className="sm:col-span-2">
                <ProductPicker id="productionProduct" value={product} onChange={setProduct} activeOnly error={errors.product} />
              </Field>
              <Field label="Size" htmlFor="productionSize" hint="Taken from the selected product">
                <Input id="productionSize" value={product?.size ?? ''} disabled placeholder="Select a product" />
              </Field>
              <Field label="Unit" htmlFor="productionUnit" hint="Product stock unit">
                <Input id="productionUnit" value={product?.stockUnit || ''} disabled placeholder="Select a product" />
              </Field>
              <Field label="Quantity Produced" required htmlFor="quantityProduced" error={errors.quantityProduced}>
                <Input id="quantityProduced" type="number" min="0.001" step="0.001" value={form.quantityProduced} onChange={set('quantityProduced')} error={errors.quantityProduced} placeholder="10000" />
              </Field>
              <Field label="Batch Number" required={false} htmlFor="batchNumber">
                <Input id="batchNumber" value={form.batchNumber} onChange={set('batchNumber')} placeholder="BATCH-250-001" />
              </Field>
              <Field label="Production Reference Number" required={false} htmlFor="referenceNumber">
                <Input id="referenceNumber" value={form.referenceNumber} onChange={set('referenceNumber')} placeholder="PROD-1001" />
              </Field>
              <Field label="Notes" required={false} htmlFor="productionNotes" className="sm:col-span-2">
                <Textarea id="productionNotes" rows={3} value={form.notes} onChange={set('notes')} placeholder="Optional production notes" />
              </Field>
            </div>
          </Card>
          <div className="mt-5 flex justify-end">
            <Button type="submit" variant="brand" size="lg" icon={saving ? undefined : Save} loading={saving}>
              Add Production
            </Button>
          </div>
        </form>
      </div>
    </>
  );
}
