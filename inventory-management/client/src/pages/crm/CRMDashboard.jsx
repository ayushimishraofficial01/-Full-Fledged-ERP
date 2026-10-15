import { useEffect, useState } from 'react';
import { BarChart3, Users, UserRoundPlus, CircleDashed, BriefcaseBusiness, Target, NotebookPen, CheckCircle2 } from 'lucide-react';
import { crmService } from '../../services';
import { PageHeader, Card, StatCard, Badge } from '../../components/ui';

export default function CRMDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmService.dashboard().then((res) => { setData(res.dashboard); }).finally(() => setLoading(false));
  }, []);

  const summary = [
    { label: 'Total Customers', value: data?.totalCustomers ?? 0, icon: Users },
    { label: 'New Leads', value: data?.newLeads ?? 0, icon: UserRoundPlus },
    { label: 'Converted Leads', value: data?.convertedLeads ?? 0, icon: CheckCircle2 },
    { label: 'Pending Follow-Ups', value: data?.pendingFollowUps ?? 0, icon: NotebookPen },
    { label: 'Open Tasks', value: data?.openTasks ?? 0, icon: Target },
    { label: 'Total Leads', value: data?.totalLeads ?? 0, icon: BriefcaseBusiness },
  ];

  return (
    <>
      <PageHeader title="CRM Dashboard" description="Customer and sales pipeline overview." breadcrumbs={[{ label: 'CRM' }, { label: 'Dashboard' }]} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summary.map((item) => <StatCard key={item.label} title={item.label} value={String(item.value)} icon={item.icon} loading={loading} />)}
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card title="CRM Snapshot"><div className="space-y-3 text-sm text-slate-600"><div className="flex items-center justify-between"><span>Active customers</span><Badge>{data?.activeCustomers ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Inactive customers</span><Badge tone="slate">{data?.inactiveCustomers ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Today follow-ups</span><Badge tone="amber">{data?.todayFollowUps ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Overdue follow-ups</span><Badge tone="red">{data?.overdueFollowUps ?? 0}</Badge></div></div></Card>
        <Card title="Pipeline Summary"><div className="space-y-3 text-sm text-slate-600"><div className="flex items-center justify-between"><span>New leads</span><Badge>{data?.newLeads ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Converted</span><Badge tone="green">{data?.convertedLeads ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Open tasks</span><Badge tone="blue">{data?.openTasks ?? 0}</Badge></div><div className="flex items-center justify-between"><span>Completed tasks</span><Badge tone="slate">{data?.completedTasks ?? 0}</Badge></div></div></Card>
      </div>
      <div className="mt-6 flex items-center gap-2 text-slate-500"><BarChart3 className="h-5 w-5" /><span>Dashboard data is drawn from live CRM and stock transaction records.</span></div>
    </>
  );
}
