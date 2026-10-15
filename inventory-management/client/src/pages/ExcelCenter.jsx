import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FileUp, Package, Boxes, Warehouse, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, History, Download, PackageCheck } from 'lucide-react';
import { useMeta } from '../context/MetaContext';
import { downloadFile, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Button, Card, DateRange, ExportButton, Field, PageHeader, Select } from '../components/ui';
import { rangeToParams } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function ExcelCenter() {
  const { warehouses } = useMeta();
  const { hasPermission } = useAuth();
  const toast = useToast();
  const [warehouse, setWarehouse] = useState('');
  const [range, setRange] = useState({ from: '', to: '' });
  const dates = rangeToParams(range.from, range.to);

  const EXPORTS = [
    { icon: Package, title: 'All Products', desc: 'Catalogue with total stock and status', url: '/export/products', params: {}, usesWarehouse: false, usesDates: false },
    { icon: Boxes, title: 'Current Inventory', desc: 'Stock per product per warehouse', url: '/export/inventory', params: {}, usesWarehouse: false, usesDates: false },
    { icon: Warehouse, title: 'Warehouse Inventory', desc: 'Stock of the selected warehouse', url: '/export/inventory', params: { warehouse }, usesWarehouse: true, usesDates: false, needsWarehouse: true },
    { icon: ArrowDownToLine, title: 'Stock In', desc: 'Receipts in the date range', url: '/export/transactions', params: { type: 'STOCK_IN', warehouse, ...dates }, usesWarehouse: true, usesDates: true },
    { icon: ArrowUpFromLine, title: 'Stock Out', desc: 'Issues in the date range', url: '/export/transactions', params: { type: 'STOCK_OUT', warehouse, ...dates }, usesWarehouse: true, usesDates: true },
    { icon: ArrowLeftRight, title: 'Stock Transfer', desc: 'Transfers in the date range', url: '/export/transfers', params: { warehouse, ...dates }, usesWarehouse: true, usesDates: true },
    { icon: History, title: 'Transaction History', desc: 'Every movement in the date range', url: '/export/transactions', params: { warehouse, ...dates }, usesWarehouse: true, usesDates: true },
  ];

  const template = async () => {
    try {
      await downloadFile('/import/template');
    } catch (err) {
      toast.error(parseError(err).message);
    }
  };

  return (
    <>
      <PageHeader title="Excel Import / Export" description="Bring products and opening stock in from Excel, or export any list with filters." breadcrumbs={[{ label: 'Excel' }]} />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card title="Import" description="Validated preview before anything is saved">
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-3 rounded-xl bg-emerald-50 p-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-xs"><FileUp className="h-5 w-5" /></span>
              <p className="text-sm text-emerald-900">Upload products with warehouse quantities. Errors are shown row by row.</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link to="/products/import"><Button icon={FileUp}>Import Excel</Button></Link>
              {hasPermission('sample_dispatch.create') && <Link to="/crm/sample-dispatch/import"><Button variant="secondary" icon={PackageCheck}>Import Sample Dispatch</Button></Link>}
              <Button variant="secondary" icon={Download} onClick={template}>Template</Button>
            </div>
          </div>
        </Card>
        <Card className="xl:col-span-2" title="Export" description="Filters apply to the exports marked with them">
          <div className="mb-5 grid grid-cols-1 gap-4 rounded-xl bg-slate-50 p-4 md:grid-cols-[16rem_1fr]">
            <Field label="Warehouse" htmlFor="xw">
              <Select id="xw" value={warehouse} onChange={(e) => setWarehouse(e.target.value)}>
                <option value="">All warehouses</option>
                {warehouses.map((w) => <option key={w._id} value={w._id}>{w.name}</option>)}
              </Select>
            </Field>
            <Field label="Date range">
              <DateRange from={range.from} to={range.to} onChange={setRange} />
            </Field>
          </div>
          <ul className="divide-y divide-slate-100">
            {EXPORTS.map((e) => (
              <li key={e.title} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy-600"><e.icon className="h-4.5 w-4.5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900">{e.title}</p>
                  <p className="text-xs text-slate-500">
                    {e.desc}
                    {e.usesWarehouse && ' · warehouse filter'}
                    {e.usesDates && ' · date filter'}
                  </p>
                </div>
                {e.needsWarehouse && !warehouse ? (
                  <span className="text-xs text-slate-400">Select a warehouse above</span>
                ) : (
                  <ExportButton url={e.url} params={e.params} size="sm" label="Export" />
                )}
              </li>
            ))}
            {hasPermission('sample_dispatch.export') && (
              <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700"><PackageCheck className="h-4.5 w-4.5" /></span>
                <div className="min-w-0 flex-1"><p className="text-sm font-medium text-slate-900">Sample Dispatch</p><p className="text-xs text-slate-500">Dispatch records and delivery status</p></div>
                <ExportButton url="/crm/sample-dispatch/export" size="sm" label="Export" />
              </li>
            )}
          </ul>
        </Card>
      </div>
    </>
  );
}
