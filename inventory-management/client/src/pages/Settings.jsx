import { useEffect, useState } from 'react';
import { Plus, Power, Trash2, Save, Ruler } from 'lucide-react';
import { settingsService } from '../services';
import { assetUrl, parseError } from '../services/api';
import { useMeta } from '../context/MetaContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, ConfirmDialog, DataTable, Field, Input, PageHeader, Select } from '../components/ui';
import UnitSelect from '../components/inventory/UnitSelect';
import useFetch from '../hooks/useFetch';

export default function Settings() {
  const toast = useToast();
  const { settings, setSettings, refreshUnits } = useMeta();
  const [general, setGeneral] = useState(settings);
  const [savingGeneral, setSavingGeneral] = useState(false);
  const [unit, setUnit] = useState({ name: '', label: '', category: 'quantity' });
  const [unitErrors, setUnitErrors] = useState({});
  const [addingUnit, setAddingUnit] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const units = useFetch(() => settingsService.units({ all: 'true' }), []);

  useEffect(() => setGeneral(settings), [settings]);

  const saveGeneral = async (e) => {
    e.preventDefault();
    if (!general.companyName?.trim()) return toast.error('Company name is required');
    setSavingGeneral(true);
    try {
      const res = await settingsService.update({
        companyName: general.companyName.trim(),
        defaultStockUnit: general.defaultStockUnit,
      });
      setSettings(res.settings);
      toast.success(res.message);
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setSavingGeneral(false);
    }
  };

  const addUnit = async (e) => {
    e.preventDefault();
    if (!unit.name.trim()) return setUnitErrors({ name: 'Unit name is required' });
    setAddingUnit(true);
    setUnitErrors({});
    try {
      const res = await settingsService.createUnit({ ...unit, name: unit.name.trim() });
      toast.success(res.message);
      setUnit({ name: '', label: '', category: unit.category });
      units.reload();
      refreshUnits();
    } catch (err) {
      const p = parseError(err);
      setUnitErrors(p.fieldErrors);
      toast.error(p.message);
    } finally {
      setAddingUnit(false);
    }
  };

  const toggle = async (u) => {
    try {
      const res = await settingsService.toggleUnit(u._id);
      toast.success(res.message);
      units.reload();
      refreshUnits();
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  const remove = async () => {
    try {
      const res = await settingsService.deleteUnit(toDelete._id);
      toast.success(res.message);
      units.reload();
      refreshUnits();
    } catch (err) {
      toast.error(parseError(err).message);
    } finally {
      setToDelete(null);
    }
  };

  return (
    <>
      <PageHeader title="Settings" description="Organisation preferences and units of measure." breadcrumbs={[{ label: 'Settings' }]} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="General">
          <form onSubmit={saveGeneral} className="space-y-4">
            <Field label="Company name" htmlFor="company" hint="Shown in the sidebar">
              <Input id="company" value={general.companyName || ''} onChange={(e) => setGeneral((g) => ({ ...g, companyName: e.target.value }))} />
            </Field>
            <Field label="Default stock unit" htmlFor="dsu" hint="Pre-selected when adding products">
              <UnitSelect id="dsu" value={general.defaultStockUnit} onChange={(v) => setGeneral((g) => ({ ...g, defaultStockUnit: v }))} />
            </Field>
            <Field label="Company logo" hint="This logo is fixed and cannot be changed from Settings.">
              <div className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-slate-200 bg-white">
                  {general.logo ? <img src={assetUrl(general.logo)} alt="Company logo" className="h-full w-full object-contain" /> : <span className="text-xs text-slate-400">No logo</span>}
                </div>
                <p className="text-sm font-semibold text-slate-900">{general.logo ? 'Company logo' : 'No logo configured'}</p>
              </div>
            </Field>
            <Button type="submit" icon={Save} loading={savingGeneral}>Save</Button>
          </form>
        </Card>

        <Card className="xl:col-span-2" title="Units of measure" description="Built-in units can be disabled. Add custom units for anything else (e.g. Roll, Sheet, Metre)." padded={false}>
          <form onSubmit={addUnit} className="grid grid-cols-1 gap-3 border-b border-slate-100 p-4 sm:grid-cols-[1fr_1.4fr_1fr_auto] sm:items-end">
            <Field label="Unit" htmlFor="uname" error={unitErrors.name}>
              <Input id="uname" value={unit.name} onChange={(e) => setUnit((u) => ({ ...u, name: e.target.value }))} placeholder="Roll" error={unitErrors.name} maxLength={20} />
            </Field>
            <Field label="Description" required={false} htmlFor="ulabel">
              <Input id="ulabel" value={unit.label} onChange={(e) => setUnit((u) => ({ ...u, label: e.target.value }))} placeholder="Roll of film" />
            </Field>
            <Field label="Type" htmlFor="ucat">
              <Select id="ucat" value={unit.category} onChange={(e) => setUnit((u) => ({ ...u, category: e.target.value }))}>
                <option value="weight">Weight</option>
                <option value="volume">Volume</option>
                <option value="quantity">Quantity</option>
                <option value="length">Length</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Button type="submit" icon={Plus} loading={addingUnit}>Add unit</Button>
          </form>
          <DataTable
            dense
            minWidth={560}
            loading={units.loading}
            error={units.error}
            onRetry={units.reload}
            rows={units.data?.units}
            columns={[
              { key: 'name', header: 'Unit', render: (u) => <span className="font-medium text-slate-900">{u.name}</span> },
              { key: 'label', header: 'Description', render: (u) => u.label || '—' },
              { key: 'category', header: 'Type', render: (u) => <span className="capitalize">{u.category}</span> },
              { key: 'kind', header: 'Source', render: (u) => (u.isSystem ? <Badge tone="navy">Built-in</Badge> : <Badge tone="blue">Custom</Badge>) },
              { key: 'active', header: 'Status', render: (u) => (u.isActive ? <Badge tone="green" dot>Enabled</Badge> : <Badge tone="slate" dot>Disabled</Badge>) },
              {
                key: 'actions',
                header: <span className="sr-only">Actions</span>,
                align: 'right',
                render: (u) => (
                  <div className="flex justify-end gap-1">
                    <Button size="xs" variant="ghost" icon={Power} onClick={() => toggle(u)}>{u.isActive ? 'Disable' : 'Enable'}</Button>
                    {!u.isSystem && <Button size="xs" variant="danger-ghost" icon={Trash2} onClick={() => setToDelete(u)}>Delete</Button>}
                  </div>
                ),
              },
            ]}
            empty={<div className="p-6 text-center text-sm text-slate-500"><Ruler className="mx-auto mb-2 h-5 w-5" />No units</div>}
          />
        </Card>
      </div>
      <ConfirmDialog open={Boolean(toDelete)} onClose={() => setToDelete(null)} onConfirm={remove} title={`Delete unit ${toDelete?.name}?`} message="Units used by any product cannot be deleted; disable them instead." confirmLabel="Delete unit" />
    </>
  );
}
