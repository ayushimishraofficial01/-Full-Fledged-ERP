import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Button, Card, PageHeader } from '../components/ui';

export default function AccessDenied() {
  return (
    <>
      <PageHeader title="403 — Access Denied" description="You don't have permission to access this page." breadcrumbs={[{ label: 'Access Denied' }]} />
      <Card className="mx-auto max-w-xl text-center">
        <ShieldX className="mx-auto h-12 w-12 text-amber-500" />
        <h2 className="mt-4 text-xl font-bold text-slate-950">Permission required</h2>
        <p className="mt-2 text-sm font-medium text-slate-600">Ask an administrator to enable the required permission for your role.</p>
        <Link to="/dashboard" className="mt-5 inline-flex"><Button>Back to Dashboard</Button></Link>
      </Card>
    </>
  );
}
