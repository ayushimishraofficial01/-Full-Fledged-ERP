import { useCallback, useEffect, useState } from 'react';
import { ReceiptText } from 'lucide-react';
import { Button, Card, DataTable, EmptyState, Field, Input, PageHeader, Pagination, Textarea } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { salesExpensesService } from '../../services';
import { dateInputToISO, formatDate, toDateInput } from '../../utils/format';

const currency = (amount) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
}).format(amount);

export default function SalesExpenses() {
  const { user } = useAuth();
  const toast = useToast();
  const [expenses, setExpenses] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expenseDate, setExpenseDate] = useState(toDateInput());
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptName, setReceiptName] = useState('');

  const loadExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const result = await salesExpensesService.list({ page, limit: 25 });
      setExpenses(result.items || []);
      setPagination(result.pagination);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load your expenses.');
    } finally {
      setLoading(false);
    }
  }, [page, toast]);

  useEffect(() => { loadExpenses(); }, [loadExpenses]);

  async function submitExpense(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = receiptFile ? new FormData() : {
        expenseDate: dateInputToISO(expenseDate),
        amount: Number(amount),
        note,
      };

      if (receiptFile) {
        payload.append('expenseDate', dateInputToISO(expenseDate));
        payload.append('amount', String(Number(amount)));
        payload.append('note', note);
        payload.append('receipt', receiptFile);
      }

      await salesExpensesService.create(payload, receiptFile ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined);
      setAmount('');
      setNote('');
      setReceiptFile(null);
      setReceiptName('');
      await loadExpenses();
      toast.success('Expense saved successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save this expense.');
    } finally {
      setSaving(false);
    }
  }

  const columns = [
    { key: 'expenseDate', header: 'Date', render: (row) => formatDate(row.expenseDate) },
    { key: 'amount', header: 'Amount', render: (row) => <span className="font-semibold text-slate-900">{currency(row.amount)}</span> },
    { key: 'note', header: 'Notes', render: (row) => <span className="whitespace-normal">{row.note}</span> },
    { key: 'receipt', header: 'Receipt', render: (row) => row.receipt ? <a href={`/uploads/${row.receipt}`} target="_blank" rel="noreferrer" className="font-medium text-brand-600 underline underline-offset-2">View</a> : <span className="text-slate-400">None</span> },
    { key: 'submittedByName', header: 'Submitted by' },
  ];

  return (
    <>
      <PageHeader
        title="My Expenses"
        description="Record your daily sales expenses with the date, amount, and notes."
        breadcrumbs={[{ label: 'Sales' }, { label: 'My Expenses' }]}
      />
      <Card className="mb-5">
        <form onSubmit={submitExpense} className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Add daily expense</h2>
            <p className="mt-1 text-sm text-slate-500">Submitted by {user?.name || 'you'}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expense date" htmlFor="salesExpenseDate" required>
              <Input id="salesExpenseDate" type="date" required value={expenseDate} onChange={(event) => setExpenseDate(event.target.value)} />
            </Field>
            <Field label="Amount (INR)" htmlFor="salesExpenseAmount" required>
              <Input id="salesExpenseAmount" type="number" min="0.01" max="1000000000000" step="0.01" required value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" />
            </Field>
          </div>
          <Field label="Notes" htmlFor="salesExpenseNote" required hint="Add what the expense was for.">
            <Textarea id="salesExpenseNote" required maxLength={1000} value={note} onChange={(event) => setNote(event.target.value)} placeholder="For example, travel to customer meeting" />
          </Field>
          <div className="space-y-2">
            <label htmlFor="salesExpenseReceipt" className="block text-sm font-medium text-slate-700">Receipt (optional)</label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Input id="salesExpenseReceipt" type="file" accept=".pdf,image/*" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                setReceiptFile(file);
                setReceiptName(file ? file.name : '');
              }} />
              {receiptName && <span className="text-sm text-slate-500">Selected: {receiptName}</span>}
            </div>
            <p className="text-xs text-slate-500">Upload a PDF or image receipt if you have one.</p>
          </div>
          <div className="flex justify-end">
            <Button type="submit" icon={ReceiptText} loading={saving}>Save expense</Button>
          </div>
        </form>
      </Card>
      <Card>
        <h2 className="mb-4 text-base font-semibold text-slate-900">Your expense history</h2>
        <DataTable
          loading={loading}
          columns={columns}
          rows={expenses}
          minWidth={640}
          empty={<EmptyState title="No expenses yet" description="Add an expense above to start your daily expense record." />}
        />
        <Pagination pagination={pagination} onPageChange={setPage} />
      </Card>
    </>
  );
}
