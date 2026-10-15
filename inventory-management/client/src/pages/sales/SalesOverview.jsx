import { useCallback, useEffect, useState } from 'react';
import { MapPinned, RefreshCw, ReceiptText, ShoppingCart } from 'lucide-react';
import { Badge, Button, Card, DataTable, EmptyState, PageHeader, Pagination, StatCard, StatGroup } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { salesOverviewService } from '../../services';
import { formatDate, rangeToParams } from '../../utils/format';

const currency = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
}).format(amount || 0);

const durationText = (seconds) => {
  if (seconds == null) return 'In progress';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
};

const weekLabel = (week) => {
  const [year, weekNumber] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNumber - 1) * 7);
  return monday.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', timeZone: 'UTC' });
};

const fillMissingWeeks = (weeks) => {
  if (!weeks.length) return [];
  const byWeek = new Map(weeks.map((week) => [week.week, week]));
  const first = new Date(`${weekLabelDate(weeks[0].week)}T00:00:00Z`);
  const last = new Date(`${weekLabelDate(weeks[weeks.length - 1].week)}T00:00:00Z`);
  const result = [];
  for (let monday = first; monday <= last; monday = new Date(monday.getTime() + 7 * 24 * 60 * 60 * 1000)) {
    const thursday = new Date(monday);
    thursday.setUTCDate(thursday.getUTCDate() + 3);
    const year = thursday.getUTCFullYear();
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const firstMonday = new Date(jan4);
    firstMonday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7));
    const weekNumber = Math.round((monday - firstMonday) / (7 * 24 * 60 * 60 * 1000)) + 1;
    const key = `${year}-W${String(weekNumber).padStart(2, '0')}`;
    result.push(byWeek.get(key) || { week: key, orders: 0, visits: 0 });
  }
  return result;
};

function weekLabelDate(week) {
  const [year, weekNumber] = week.split('-W').map(Number);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (weekNumber - 1) * 7);
  return monday.toISOString().slice(0, 10);
}

const STATUS_TONES = { Pending: 'amber', Confirmed: 'blue', Processing: 'violet', Completed: 'green', Cancelled: 'slate' };
const PAGE_SIZE = 10;

export default function SalesOverview() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState({
    expenses: { count: 0, amount: 0 },
    orders: { count: 0 },
    visits: { count: 0 },
  });
  const [expenses, setExpenses] = useState({ items: [], pagination: null });
  const [orders, setOrders] = useState({ items: [], pagination: null });
  const [visits, setVisits] = useState({ items: [], pagination: null });
  const [activityByEmployee, setActivityByEmployee] = useState([]);
  const [activityByWeek, setActivityByWeek] = useState([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [userId, setUserId] = useState('');
  const [expensesPage, setExpensesPage] = useState(1);
  const [ordersPage, setOrdersPage] = useState(1);
  const [visitsPage, setVisitsPage] = useState(1);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await salesOverviewService.get({
        ...rangeToParams(from, to),
        userId: userId || undefined,
        expensesPage,
        ordersPage,
        visitsPage,
        limit: PAGE_SIZE,
      });
      setEmployees(result.employees || []);
      setSummary(result.summary);
      setExpenses(result.expenses);
      setOrders(result.orders);
      setVisits(result.visits);
      setActivityByEmployee(result.activityByEmployee || []);
      setActivityByWeek(result.activityByWeek || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load the sales overview.');
    } finally {
      setLoading(false);
    }
  }, [expensesPage, from, ordersPage, to, toast, userId, visitsPage]);

  useEffect(() => { load(); }, [load]);

  function resetPages() {
    setExpensesPage(1);
    setOrdersPage(1);
    setVisitsPage(1);
  }

  const maxActivityCount = Math.max(...activityByEmployee.flatMap((employee) => [employee.visits, employee.orders]), 1);
  const weeklyChartData = fillMissingWeeks(activityByWeek);
  const maxWeeklyCount = Math.max(...weeklyChartData.flatMap((week) => [week.visits, week.orders]), 1);

  const expenseColumns = [
    { key: 'expenseDate', header: 'Date', render: (row) => formatDate(row.expenseDate) },
    { key: 'submittedByName', header: 'Employee' },
    { key: 'amount', header: 'Amount', render: (row) => <span className="font-semibold">{currency(row.amount)}</span> },
    { key: 'note', header: 'Notes', render: (row) => <span className="whitespace-normal">{row.note}</span> },
  ];
  const orderColumns = [
    { key: 'orderNumber', header: 'Order' },
    { key: 'orderDate', header: 'Date', render: (row) => formatDate(row.orderDate) },
    { key: 'createdBy', header: 'Employee', render: (row) => row.createdBy?.name || '—' },
    { key: 'customerName', header: 'Customer', render: (row) => <div><p className="font-medium">{row.customerName}</p>{row.address && <p className="max-w-48 whitespace-normal text-xs text-slate-500">{row.address}</p>}</div> },
    { key: 'items', header: 'Products', render: (row) => <div className="max-w-64 space-y-1">{row.items.map((item) => <p key={`${item.product}-${item.unit}`} className="truncate">{item.productName} · {item.quantity} {item.unit}</p>)}</div> },
    { key: 'totalAmount', header: 'Total', render: (row) => <span className="font-semibold">{row.totalAmount == null ? '—' : currency(row.totalAmount)}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge tone={STATUS_TONES[row.status] || 'slate'}>{row.status}</Badge> },
  ];
  const visitColumns = [
    { key: 'checkIn', header: 'Date', render: (row) => formatDate(row.checkIn?.at, { time: true }) },
    { key: 'user', header: 'Employee', render: (row) => row.user?.name || '—' },
    { key: 'placeName', header: 'Customer / place' },
    { key: 'durationSeconds', header: 'Duration', render: (row) => durationText(row.durationSeconds) },
    { key: 'notes', header: 'Notes', render: (row) => <span className="whitespace-normal">{row.notes || '—'}</span> },
  ];

  return (
    <>
      <PageHeader
        title="Sales Overview"
        description="Review all sales users' expenses, orders, and field visits in one place."
        breadcrumbs={[{ label: 'Sales' }, { label: 'Sales Overview' }]}
        actions={<Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>}
      />
      <Card className="mb-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-sm font-medium text-slate-700">
            From
            <input type="date" value={from} onChange={(event) => { setFrom(event.target.value); resetPages(); }} className="input mt-1.5" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            To
            <input type="date" value={to} onChange={(event) => { setTo(event.target.value); resetPages(); }} className="input mt-1.5" />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Employee
            <select value={userId} onChange={(event) => { setUserId(event.target.value); resetPages(); }} className="input mt-1.5">
              <option value="">All employees</option>
              {employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name} · {employee.email}</option>)}
            </select>
          </label>
        </div>
      </Card>

      <StatGroup title="Filtered sales activity" className="mb-6">
        <StatCard bare label="Expenses" value={summary.expenses.count} sub={currency(summary.expenses.amount)} icon={ReceiptText} accent="amber" loading={loading} />
        <StatCard bare label="Orders" value={summary.orders.count} icon={ShoppingCart} accent="blue" loading={loading} />
        <StatCard bare label="Field visits" value={summary.visits.count} icon={MapPinned} accent="green" loading={loading} />
      </StatGroup>

      <Card
        title={userId ? 'Weekly orders and field visits' : 'Orders and field visits by sales user'}
        description={userId ? 'Weekly activity for the selected sales user in the selected date range.' : "Compare each sales user's orders and visits in the selected date range."}
        className="mb-5"
      >
        {loading ? <p className="py-6 text-center text-sm text-slate-500">Loading sales activity…</p> : userId ? weeklyChartData.length === 0 ? (
          <EmptyState title="No weekly activity found" description="No orders or field visits match the selected user and date range." />
        ) : (
          <>
            <div className="mb-4 flex gap-5 text-xs font-medium text-slate-600" aria-label="Chart legend">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-blue-500" />Orders</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Field visits</span>
            </div>
            <div className="overflow-x-auto pb-2" role="list" aria-label="Weekly orders and field visits for selected sales user">
              <div className="flex min-h-64 min-w-max items-end gap-3 border-b border-l border-slate-200 px-4 pt-5 sm:gap-5">
                {weeklyChartData.map((week) => {
                  const ordersHeight = week.orders ? Math.max((week.orders / maxWeeklyCount) * 100, 4) : 0;
                  const visitsHeight = week.visits ? Math.max((week.visits / maxWeeklyCount) * 100, 4) : 0;
                  return (
                    <div key={week.week} role="listitem" className="flex h-56 w-16 flex-col items-center justify-end sm:w-20">
                      <div className="flex h-40 w-full items-end justify-center gap-1 rounded-t-md bg-slate-50 px-1" role="img" aria-label={`${weekLabel(week.week)}: ${week.orders} orders and ${week.visits} field visits`}>
                        <div className="flex h-full w-1/2 flex-col items-center justify-end gap-1">
                          <span className="text-[10px] font-semibold tabular-nums text-slate-700">{week.orders}</span>
                          <div className="w-full rounded-t-sm bg-blue-500 transition-[height]" style={{ height: `${ordersHeight}%` }} />
                        </div>
                        <div className="flex h-full w-1/2 flex-col items-center justify-end gap-1">
                          <span className="text-[10px] font-semibold tabular-nums text-slate-700">{week.visits}</span>
                          <div className="w-full rounded-t-sm bg-emerald-500 transition-[height]" style={{ height: `${visitsHeight}%` }} />
                        </div>
                      </div>
                      <span className="mt-2 w-full text-center text-xs font-medium text-slate-600">{weekLabel(week.week)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        ) : activityByEmployee.length === 0 ? (
          <EmptyState title="No sales users found" description="There are no sales users to show for this overview." />
        ) : (
          <>
            <div className="mb-4 flex gap-5 text-xs font-medium text-slate-600" aria-label="Chart legend">
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-blue-500" />Orders</span>
              <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-sm bg-emerald-500" />Field visits</span>
            </div>
            <div className="overflow-x-auto pb-2" role="list" aria-label="Orders and field visits by sales user">
              <div className="flex min-h-64 min-w-max items-end gap-4 border-b border-l border-slate-200 px-4 pt-5 sm:gap-7">
                {activityByEmployee.map((employee) => {
                  const ordersHeight = employee.orders ? Math.max((employee.orders / maxActivityCount) * 100, 4) : 0;
                  const visitsHeight = employee.visits ? Math.max((employee.visits / maxActivityCount) * 100, 4) : 0;
                return (
                  <div key={employee.userId} role="listitem" className="flex h-56 w-16 flex-col items-center justify-end sm:w-20">
                    <div className="flex h-40 w-full items-end justify-center gap-1 rounded-t-md bg-slate-50 px-1" role="img" aria-label={`${employee.name}: ${employee.orders} orders and ${employee.visits} field visits`}>
                      <div className="flex h-full w-1/2 flex-col items-center justify-end gap-1">
                        <span className="text-[10px] font-semibold tabular-nums text-slate-700">{employee.orders}</span>
                        <div className="w-full rounded-t-sm bg-blue-500 transition-[height]" style={{ height: `${ordersHeight}%` }} />
                      </div>
                      <div className="flex h-full w-1/2 flex-col items-center justify-end gap-1">
                        <span className="text-[10px] font-semibold tabular-nums text-slate-700">{employee.visits}</span>
                        <div className="w-full rounded-t-sm bg-emerald-500 transition-[height]" style={{ height: `${visitsHeight}%` }} />
                      </div>
                    </div>
                    <span className="mt-2 w-full truncate text-center text-xs font-medium text-slate-600" title={employee.name}>{employee.name}</span>
                  </div>
                );
                })}
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="space-y-5">
        <Card title="Sales expenses" description="Submitted expense amount, notes, date, and employee.">
          <DataTable
            loading={loading}
            columns={expenseColumns}
            rows={expenses.items}
            minWidth={640}
            empty={<EmptyState title="No expenses found" description="No expenses match the selected filters." />}
          />
          <Pagination pagination={expenses.pagination} onPageChange={setExpensesPage} />
        </Card>
        <Card title="Sales orders" description="Orders created by sales users and orders from field-visit requirements.">
          <DataTable
            loading={loading}
            columns={orderColumns}
            rows={orders.items}
            minWidth={900}
            empty={<EmptyState title="No orders found" description="No orders match the selected filters." />}
          />
          <Pagination pagination={orders.pagination} onPageChange={setOrdersPage} />
        </Card>
        <Card title="Field visits" description="Customer visits with check-in time, duration, notes, and employee.">
          <DataTable
            loading={loading}
            columns={visitColumns}
            rows={visits.items}
            minWidth={700}
            empty={<EmptyState title="No visits found" description="No field visits match the selected filters." />}
          />
          <Pagination pagination={visits.pagination} onPageChange={setVisitsPage} />
        </Card>
      </div>
    </>
  );
}
