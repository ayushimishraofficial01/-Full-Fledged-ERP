import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { productService } from '../../services';
import { parseError } from '../../services/api';
import { useMeta } from '../../context/MetaContext';
import { useToast } from '../../context/ToastContext';
import { Button, Card, ErrorState, Field, Input, PageHeader, PageLoader, Textarea } from '../../components/ui';
import UnitSelect from '../../components/inventory/UnitSelect';
import WarehouseSelect from '../../components/ui/WarehouseSelect';
import ImageUpload from '../../components/inventory/ImageUpload';

const EMPTY = { name: '', sku: '', category: '', brand: '', hsn: '', size: '', unit: '', stockUnit: '', price: '', minimumStock: '0', quantity: '', warehouse: '', description: '', status: 'active' };

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Product name is required';
  if (!f.sku.trim()) e.sku = 'SKU is required';
  else if (!/^[A-Za-z0-9][A-Za-z0-9._\-/]*$/.test(f.sku.trim())) e.sku = 'Use letters, numbers, ".", "-", "_" or "/"';
  if (!f.category.trim()) e.category = 'Category is required';
  if (f.hsn && !/^(\d{4}|\d{6}|\d{8})$/.test(f.hsn.trim())) e.hsn = 'HSN must be 4, 6 or 8 digits';
  if (f.size !== '' && (Number.isNaN(Number(f.size)) || Number(f.size) < 0)) e.size = 'Size must be a positive number';
  if (!f.unit) e.unit = 'Unit is required';
  if (!f.stockUnit) e.stockUnit = 'Stock unit is required';
  if (f.price !== '' && (!Number.isFinite(Number(f.price)) || Number(f.price) < 0 || Number(f.price) > 1e12)) e.price = 'Enter a price between 0 and 1,000,000,000,000';
  if (f.minimumStock === '' || Number.isNaN(Number(f.minimumStock)) || Number(f.minimumStock) < 0) e.minimumStock = 'Enter 0 or a positive number';
  if (f.quantity !== '' && (Number.isNaN(Number(f.quantity)) || Number(f.quantity) < 0)) e.quantity = 'Enter 0 or a positive number';
  if (f.quantity !== '' && !f.warehouse) e.warehouse = 'Choose a warehouse for the initial stock';
  return e;
}

export default function ProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { categories, settings, refreshCategories } = useMeta();
  const [form, setForm] = useState({ ...EMPTY, stockUnit: settings.defaultStockUnit || 'PCS' });
  const [original, setOriginal] = useState(null);
  const [file, setFile] = useState(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [imageError, setImageError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    productService
      .get(id)
      .then(({ product }) => {
        setOriginal(product);
        setForm({
          name: product.name,
          sku: product.sku,
          category: product.category,
          brand: product.brand || '',
          hsn: product.hsn || '',
          size: product.size ?? '',
          unit: product.unit,
          stockUnit: product.stockUnit,
          price: product.price ?? '',
          minimumStock: String(product.minimumStock ?? 0),
          quantity: '',
          warehouse: '',
          description: product.description || '',
          status: product.status,
        });
      })
      .catch((err) => setLoadError(parseError(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? e.target.value : e }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length || imageError) {
      toast.error('Please fix the highlighted fields.');
      return;
    }
    const fd = new FormData();
    Object.entries(form).forEach(([k, v]) => {
      if (k === 'warehouse' && !v) return;
      if (k === 'quantity' && v === '') return;
      fd.append(k, typeof v === 'string' ? v.trim() : v);
    });
    if (file) fd.append('image', file);
    if (removeImage && !file) fd.append('removeImage', 'true');
    setSaving(true);
    try {
      const res = isEdit ? await productService.update(id, fd) : await productService.create(fd);
      toast.success(res.message);
      refreshCategories();
      navigate(`/products/${res.product._id}`);
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors);
      if (p.fieldErrors.image) setImageError(p.fieldErrors.image);
      toast.error(p.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (loadError) return <ErrorState message={loadError.message} />;

  return (
    <>
      <PageHeader
        title={isEdit ? `Edit ${original?.name}` : 'Add Product'}
        breadcrumbs={[{ label: 'Products', to: '/products' }, { label: isEdit ? 'Edit' : 'Add Product' }]}
      />
      <form onSubmit={submit} noValidate className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card title="Product details">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Product Name" required htmlFor="name" error={errors.name} className="sm:col-span-2">
                <Input id="name" value={form.name} onChange={set('name')} error={errors.name} placeholder="e.g. Product 1" autoFocus={!isEdit} />
              </Field>
              <Field label="SKU / Product Code" required htmlFor="sku" error={errors.sku} hint="Unique. Stored in upper case.">
                <Input id="sku" value={form.sku} onChange={set('sku')} error={errors.sku} placeholder="P001" className="font-mono uppercase" />
              </Field>
              <Field label="HSN Number" required={false} htmlFor="hsn" error={errors.hsn}>
                <Input id="hsn" inputMode="numeric" value={form.hsn} onChange={set('hsn')} error={errors.hsn} placeholder="3923" />
              </Field>
              <Field label="Category" required htmlFor="category" error={errors.category}>
                <Input id="category" list="category-options" value={form.category} onChange={set('category')} error={errors.category} placeholder="e.g. Cups" />
                <datalist id="category-options">{categories.map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Brand" required={false} htmlFor="brand">
                <Input id="brand" value={form.brand} onChange={set('brand')} />
              </Field>
              <Field label="Description" required={false} htmlFor="description" className="sm:col-span-2">
                <Textarea id="description" value={form.description} onChange={set('description')} rows={3} />
              </Field>
            </div>
          </Card>

          <Card title="Size, unit & stock" description="Size and unit describe the item; the stock unit is how quantity is counted in warehouses.">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Selling price (INR)" required={false} htmlFor="price" error={errors.price} hint="Per stock unit; can be adjusted on each order.">
                <Input id="price" type="number" min="0" max="1000000000000" step="0.01" value={form.price} onChange={set('price')} error={errors.price} placeholder="Optional" />
              </Field>
              <Field label="Size" required={false} htmlFor="size" error={errors.size}>
                <Input id="size" type="number" min="0" step="any" value={form.size} onChange={set('size')} error={errors.size} placeholder="250" />
              </Field>
              <Field label="Unit" required htmlFor="unit" error={errors.unit}>
                <UnitSelect id="unit" value={form.unit} onChange={set('unit')} error={errors.unit} />
              </Field>
              <Field label="Stock Unit" required htmlFor="stockUnit" error={errors.stockUnit} hint={isEdit ? 'Locked once stock has moved' : 'e.g. PCS for a product measured in ML'}>
                <UnitSelect id="stockUnit" value={form.stockUnit} onChange={set('stockUnit')} error={errors.stockUnit} />
              </Field>
              <Field label="Minimum Stock Level" required htmlFor="minimumStock" error={errors.minimumStock} hint="Per warehouse, for alerts">
                <Input id="minimumStock" type="number" min="0" step="any" value={form.minimumStock} onChange={set('minimumStock')} error={errors.minimumStock} />
              </Field>
              <Field label="Initial stock warehouse" required={false} htmlFor="warehouse" error={errors.warehouse}>
                <WarehouseSelect id="warehouse" value={form.warehouse} onChange={set('warehouse')} error={errors.warehouse} placeholder="Select warehouse" activeOnly />
              </Field>
              <Field label="Initial quantity" required={false} htmlFor="quantity" error={errors.quantity} hint="Optional — added to the selected warehouse">
                <Input id="quantity" type="number" min="0" step="any" value={form.quantity} onChange={set('quantity')} error={errors.quantity} placeholder="0" />
              </Field>
            </div>
            {form.unit && (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[13px] text-slate-600">
                Preview: <span className="font-medium text-slate-900">{form.name || 'Product'} {form.size !== '' ? `${form.size} ${form.unit}` : form.unit}</span>
                {form.stockUnit && <> · stock counted in <span className="font-medium text-slate-900">{form.stockUnit}</span></>}
                {form.warehouse && form.quantity !== '' && Number(form.quantity) > 0 && <> · initial stock {form.quantity} {form.stockUnit}</>}
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Product image">
            <ImageUpload
              existing={original?.image}
              file={file}
              onFile={(f) => { setFile(f); if (f) setRemoveImage(false); }}
              removed={removeImage}
              onRemove={() => setRemoveImage(true)}
              error={imageError}
              onError={setImageError}
            />
          </Card>
          <Card title="Status">
            <div className="grid grid-cols-2 gap-2">
              {['active', 'inactive'].map((s) => (
                <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm capitalize ${form.status === s ? 'border-brand-500 bg-brand-50/60 font-medium text-brand-800' : 'border-slate-200 text-slate-600'}`}>
                  <input type="radio" name="status" value={s} checked={form.status === s} onChange={set('status')} className="accent-brand-600" />
                  {s}
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">Inactive products cannot receive new stock but existing stock can still be moved out.</p>
          </Card>
          <div className="flex gap-2 xl:flex-col">
            <Button type="submit" size="lg" icon={Save} loading={saving} className="flex-1 xl:w-full xl:flex-none">{isEdit ? 'Save changes' : 'Create product'}</Button>
            <Link to={isEdit ? `/products/${id}` : '/products'} className="flex-1 xl:flex-none"><Button variant="secondary" size="lg" className="w-full">Cancel</Button></Link>
          </div>
        </div>
      </form>
    </>
  );
}
