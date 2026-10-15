import { Package, Boxes, AlertTriangle, XCircle } from 'lucide-react';
import { StatCard } from '../ui';
import { formatInt, formatQty } from '../../utils/format';

export default function SummaryTiles({ summary, loading }) {
  const s = summary;
  const byUnit = s?.quantityByUnit || [];
  return (
    <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total Products" value={formatInt(s?.totalProducts)} sub={s ? `${formatInt(s.productsInStock)} currently in stock` : ''} icon={Package} loading={loading && !s} />
      <StatCard
        label="Total Quantity"
        value={formatQty(s?.totalQuantity)}
        sub={byUnit.length ? byUnit.slice(0, 3).map((u) => `${formatQty(u.quantity)} ${u.unit}`).join(' · ') : 'No stock'}
        icon={Boxes}
        accent="violet"
        loading={loading && !s}
      />
      <StatCard label="Low Stock" value={formatInt(s?.lowStock)} sub="Below minimum level" icon={AlertTriangle} accent="amber" loading={loading && !s} />
      <StatCard label="Out of Stock" value={formatInt(s?.outOfStock)} sub="Zero quantity" icon={XCircle} accent="red" loading={loading && !s} />
    </div>
  );
}
