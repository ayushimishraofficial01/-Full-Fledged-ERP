import { useEffect, useState } from 'react';
import { crmService } from '../../services';
import { PageHeader, Card } from '../../components/ui';

export default function ActivityTimeline() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    crmService.activity().then((res) => setItems(res.items || [])).finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader title="Activity Timeline" description="Recent CRM activity across customers and leads." breadcrumbs={[{ label: 'CRM' }, { label: 'Timeline' }]} />
      <Card title="Recent activity" loading={loading}>
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item._id} className="border-l-2 border-slate-200 pl-4">
              <div className="text-sm font-semibold text-slate-800">{item.action}</div>
              <div className="mt-1 text-sm text-slate-600">{item.description}</div>
              <div className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          ))}
          {!loading && items.length === 0 && <div className="text-sm text-slate-500">No activity found.</div>}
        </div>
      </Card>
    </>
  );
}
