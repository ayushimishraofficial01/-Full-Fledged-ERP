import { Factory, ArrowDownToLine, ArrowLeftRight, AlertTriangle, Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productionService } from '../../services';
import useFetch from '../../hooks/useFetch';
import { Card, PageHeader, PageLoader, StatCard } from '../../components/ui';
import { formatQty } from '../../utils/format';

function Metric({ label, value, hint, icon, accent = 'navy' }) {
  return <StatCard label={label} value={value} sub={hint} icon={icon} accent={accent} />;
}

export default function ProductionDashboard() {
  const { data, loading, error } = useFetch(() => productionService.dashboard(), []);
  if (loading && !data) return <PageLoader />;
  if (error) return <Card title="Production Dashboard">Unable to load production data.</Card>;
  const d = data?.dashboard || {};
  const todayProduction = (d.todayProduction || []).reduce((sum, row) => sum + row.quantity, 0);
  const todayTransfers = (d.todayTransfers || []).reduce((sum, row) => sum + row.quantity, 0);

  return (
    <>
      <PageHeader title="Production Dashboard" description="Central production stock before it is distributed to warehouses." breadcrumbs={[{ label: 'Production Stock' }, { label: 'Dashboard' }]} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Production Stock" value={formatQty(d.totalQuantity || 0)} hint="Total available quantity" icon={Factory} />
        <Metric label="Today's Production" value={formatQty(todayProduction)} hint="Across all units" icon={ArrowDownToLine} accent="green" />
        <Metric label="Today's Transfers" value={formatQty(todayTransfers)} hint="Sent to warehouses" icon={ArrowLeftRight} accent="blue" />
        <Metric label="Products in Stock" value={d.productsInStock || 0} hint={`${d.totalProducts || 0} tracked products`} icon={Boxes} accent="navy" />
        <Metric label="Low Production Stock" value={d.lowStock || 0} hint="Below minimum level" icon={AlertTriangle} accent="amber" />
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card title="Production workflow" description="Keep manufacturing stock separate from warehouse stock.">
          <div className="space-y-2.5 text-[13px] font-medium">
            <Link to="/production/new" className="block rounded-md border border-slate-200 px-3.5 py-3 text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700">+ Add production</Link>
            <Link to="/production/transfer" className="block rounded-md border border-slate-200 px-3.5 py-3 text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700">Transfer to warehouse</Link>
            <Link to="/production/stock" className="block rounded-md border border-slate-200 px-3.5 py-3 text-slate-700 transition hover:border-brand-300 hover:bg-slate-50 hover:text-brand-700">View production stock</Link>
          </div>
        </Card>
        <Card className="md:col-span-2" title="Stock separation" description="Production quantities never appear as warehouse stock until an explicit transfer is completed.">
          <div className="flex flex-col items-center justify-center gap-3 py-5 text-center text-sm font-bold text-slate-700 sm:flex-row">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-5 py-3.5 text-slate-700">Production</span>
            <ArrowLeftRight className="h-5 w-5 rotate-90 text-brand-500 sm:rotate-0" />
            <span className="rounded-md border border-slate-200 bg-slate-50 px-5 py-3.5 text-slate-700">Production Stock</span>
            <ArrowLeftRight className="h-5 w-5 rotate-90 text-brand-500 sm:rotate-0" />
            <span className="rounded-md border border-slate-200 bg-slate-50 px-5 py-3.5 text-slate-700">Warehouses</span>
          </div>
        </Card>
      </div>
    </>
  );
}
