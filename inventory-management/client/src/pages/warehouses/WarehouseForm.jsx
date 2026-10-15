import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Save } from 'lucide-react';
import { warehouseService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useMeta } from '../../context/MetaContext';
import { Button, Card, ErrorState, Field, Input, PageHeader, PageLoader, Textarea } from '../../components/ui';

const EMPTY = { name: '', code: '', location: '', address: '', city: '', state: '', pincode: '', contactPerson: '', contactNumber: '', status: 'active' };

function validate(f) {
  const e = {};
  if (!f.name.trim()) e.name = 'Warehouse name is required';
  if (!f.code.trim()) e.code = 'Warehouse code is required';
  else if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(f.code.trim())) e.code = 'Use letters, numbers, "-" or "_"';
  if (!f.location.trim()) e.location = 'Location is required';
  if (!f.city.trim()) e.city = 'City is required';
  if (!f.state.trim()) e.state = 'State is required';
  if (f.pincode && !/^\d{6}$/.test(f.pincode.trim())) e.pincode = 'Pincode must be 6 digits';
  if (f.contactNumber && !/^\+?[0-9\s-]{7,20}$/.test(f.contactNumber.trim())) e.contactNumber = 'Enter a valid phone number';
  return e;
}

export default function WarehouseForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const toast = useToast();
  const { refreshWarehouses } = useMeta();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isEdit) return;
    warehouseService
      .get(id)
      .then(({ warehouse }) => setForm(Object.fromEntries(Object.keys(EMPTY).map((k) => [k, warehouse[k] ?? '']))))
      .catch((err) => setLoadError(parseError(err)))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length) return toast.error('Please fix the highlighted fields.');
    setSaving(true);
    try {
      const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));
      const res = isEdit ? await warehouseService.update(id, body) : await warehouseService.create(body);
      toast.success(res.message);
      refreshWarehouses();
      navigate('/warehouses');
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors);
      toast.error(p.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageLoader />;
  if (loadError) return <ErrorState message={loadError.message} />;

  return (
    <>
      <PageHeader title={isEdit ? `Edit ${form.name}` : 'Add Warehouse'} breadcrumbs={[{ label: 'Warehouses', to: '/warehouses' }, { label: isEdit ? 'Edit' : 'Add Warehouse' }]} />
      <form onSubmit={submit} noValidate className="max-w-4xl space-y-6">
        <Card title="Warehouse details">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Warehouse Name" required htmlFor="name" error={errors.name} className="lg:col-span-2">
              <Input id="name" value={form.name} onChange={set('name')} error={errors.name} placeholder="Kanpur Warehouse" autoFocus={!isEdit} />
            </Field>
            <Field label="Warehouse Code" required htmlFor="code" error={errors.code} hint="Unique, e.g. KNP-01">
              <Input id="code" value={form.code} onChange={set('code')} error={errors.code} placeholder="KNP-01" className="font-mono uppercase" />
            </Field>
            <Field label="Location" required htmlFor="location" error={errors.location}>
              <Input id="location" value={form.location} onChange={set('location')} error={errors.location} placeholder="Kanpur" />
            </Field>
            <Field label="City" required htmlFor="city" error={errors.city}>
              <Input id="city" value={form.city} onChange={set('city')} error={errors.city} />
            </Field>
            <Field label="State" required htmlFor="state" error={errors.state}>
              <Input id="state" value={form.state} onChange={set('state')} error={errors.state} placeholder="Uttar Pradesh" />
            </Field>
            <Field label="Address" required={false} htmlFor="address" error={errors.address} className="sm:col-span-2">
              <Textarea id="address" rows={2} value={form.address} onChange={set('address')} />
            </Field>
            <Field label="Pincode" required={false} htmlFor="pincode" error={errors.pincode}>
              <Input id="pincode" inputMode="numeric" maxLength={6} value={form.pincode} onChange={set('pincode')} error={errors.pincode} />
            </Field>
          </div>
        </Card>
        <Card title="Contact & status">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Contact Person" required={false} htmlFor="contactPerson">
              <Input id="contactPerson" value={form.contactPerson} onChange={set('contactPerson')} />
            </Field>
            <Field label="Contact Number" required={false} htmlFor="contactNumber" error={errors.contactNumber}>
              <Input id="contactNumber" type="tel" value={form.contactNumber} onChange={set('contactNumber')} error={errors.contactNumber} placeholder="+91 98765 43210" />
            </Field>
            <Field label="Status" htmlFor="status" hint="Inactive warehouses cannot receive stock">
              <div className="grid grid-cols-2 gap-2">
                {['active', 'inactive'].map((s) => (
                  <label key={s} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm capitalize ${form.status === s ? 'border-brand-500 bg-brand-50/60 font-medium text-brand-800' : 'border-slate-200 text-slate-600'}`}>
                    <input type="radio" name="status" value={s} checked={form.status === s} onChange={set('status')} className="accent-brand-600" />
                    {s}
                  </label>
                ))}
              </div>
            </Field>
          </div>
        </Card>
        <div className="flex gap-2">
          <Button type="submit" icon={Save} loading={saving}>{isEdit ? 'Save changes' : 'Create warehouse'}</Button>
          <Link to="/warehouses"><Button variant="secondary">Cancel</Button></Link>
        </div>
      </form>
    </>
  );
}
