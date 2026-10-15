import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button, EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState icon={Compass} title="Page not found" description="The page you are looking for does not exist or was moved." action={<Link to="/dashboard"><Button>Back to dashboard</Button></Link>} />
    </div>
  );
}
