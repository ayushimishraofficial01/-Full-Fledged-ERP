import { useEffect, useState } from 'react';
import { crmService } from '../../services';
import { PageHeader, Card, Badge } from '../../components/ui';

export default function CRMReports() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmService.reports().then((res) => setData(res.reports)).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="CRM Reports" description="High-level customer, lead and task performance." breadcrumbs={[{ label: 'CRM' }, { label: 'Reports' }]} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card title="Customers" loading={loading}><div className="space-y-2 text-sm text-slate-600"><div className="flex items-center justify-between"><span>Total</span><Badge>{data?.customers?.total ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Active</span><Badge tone="green">{data?.customers?.active ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Inactive</span><Badge tone="slate">{data?.customers?.inactive ?? 0}</Badge></div></div></Card>
        <Card title="Leads" loading={loading}><div className="space-y-2 text-sm text-slate-600"><div className="flex items-center justify-between"><span>Total</span><Badge>{data?.leads?.total ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Converted</span><Badge tone="green">{data?.leads?.converted ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Open</span><Badge tone="amber">{data?.leads?.open ?? 0}</Badge></div></div></Card>
        <Card title="Follow-Ups" loading={loading}><div className="space-y-2 text-sm text-slate-600"><div className="flex items-center justify-between"><span>Pending</span><Badge tone="amber">{data?.followUps?.Pending ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Completed</span><Badge tone="green">{data?.followUps?.Completed ?? 0}</Badge></div></div></Card>
        <Card title="Tasks" loading={loading}><div className="space-y-2 text-sm text-slate-600"><div className="flex items-center justify-between"><span>Pending</span><Badge tone="amber">{data?.tasks?.Pending ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Completed</span><Badge tone="green">{data?.tasks?.Completed ?? 0}</Badge></div></div></Card>
      </div>
    </>
  );
}
