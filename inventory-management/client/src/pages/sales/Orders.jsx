import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import CustomerLookup from '../../components/CustomerLookup';
import { Badge, Button, Card, DataTable, EmptyState, Modal, PageHeader, SearchInput } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { ordersService } from '../../services';
import { formatCurrency } from '../../utils/format';

const ORDER_STATUSES = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'];
const STATUS_TONES = { Pending: 'amber', Confirmed: 'blue', Processing: 'violet', Completed: 'green', Cancelled: 'slate' };
const inputClass = 'mt-1.5 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100';
const dateText = (value) => value ? new Date(value).toLocaleDateString() : '—';
const newItem = () => ({ productId: '', quantity: '', unit: '', unitPrice: '', note: '' });
const lineAmount = (quantity, unitPrice) => Math.round(((Number(quantity) || 0) * (Number(unitPrice) || 0) + Number.EPSILON) * 100) / 100;

export default function Orders() {
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [orderItems, setOrderItems] = useState([newItem()]);
  const { hasPermission } = useAuth();
  const canLookupCustomers = hasPermission('customers.lookup') || hasPermission('customers.view');
  const toast = useToast();

  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const result = await ordersService.list({ search: query || undefined, status: status || undefined, limit: 100 });
      setItems(result.items || []);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load orders.');
    } finally {
      setLoading(false);
    }
  }, [query, status, toast]);

  useEffect(() => {
    let cancelled = false;
    ordersService.options()
      .then((result) => {
        if (!cancelled) {
          setProducts(result.products || []);
          setUnits(result.units || []);
        }
      })
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load order products.'));
    return () => { cancelled = true; };
  }, [toast]);

  useEffect(() => {
    const timer = setTimeout(loadOrders, 250);
    return () => clearTimeout(timer);
  }, [loadOrders]);

  function openCreate() {
    setCustomerName('');
    setCustomerId('');
    setPhone('');
    setEmail('');
    setGstNumber('');
    setAddress('');
    setNotes('');
    setOrderItems([newItem()]);
    setCreateOpen(true);
  }

  function selectCustomer(customer) {
    setCustomerId(customer._id);
    setCustomerName(customer.fullName || '');
    setPhone(customer.phone || customer.alternatePhone || '');
    setEmail(customer.email || '');
    setGstNumber(customer.gstNumber || '');
    setAddress([
      customer.address?.line1,
      customer.address?.line2,
      [customer.address?.city, customer.address?.state, customer.address?.pincode].filter(Boolean).join(', '),
      customer.address?.country,
    ].filter(Boolean).join(', '));
  }

  function changeItem(index, change) {
    setOrderItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...change } : item));
  }

  async function createOrder(event) {
    event.preventDefault();
    const productIds = orderItems.map((item) => item.productId);
    if (productIds.some((id) => !id) || orderItems.some((item) => !Number(item.quantity) || Number(item.quantity) <= 0 || (item.unitPrice !== '' && (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0)))) {
      toast.error('Select a product and enter a valid quantity and price for every order item.');
      return;
    }
    if (new Set(productIds).size !== productIds.length) {
      toast.error('Choose each product only once per order.');
      return;
    }
    setBusy(true);
    try {
      await ordersService.create({
        ...(customerId ? { customerId } : {}),
        customerName,
        phone,
        email,
        gstNumber,
        address,
        notes,
        items: orderItems.map(({ productId, quantity, unit, unitPrice, note }) => ({
          productId,
          quantity: Number(quantity),
          unit,
          ...(unitPrice !== '' ? { unitPrice: Number(unitPrice) } : {}),
          note,
        })),
      });
      setCreateOpen(false);
      await loadOrders();
      toast.success('Order added successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create this order.');
    } finally {
      setBusy(false);
    }
  }

  async function changeStatus(orderId, nextStatus) {
    try {
      await ordersService.updateStatus(orderId, nextStatus);
      await loadOrders();
      toast.success('Order status updated.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update the order status.');
    }
  }

  const columns = [
    { key: 'orderNumber', header: 'Order' },
    { key: 'orderDate', header: 'Date', render: (row) => dateText(row.orderDate) },
    { key: 'customerName', header: 'Customer', render: (row) => <div><p className="font-medium text-slate-900">{row.customerName}</p>{row.phone && <p className="text-xs text-slate-500">{row.phone}</p>}{row.email && <p className="text-xs text-slate-500">{row.email}</p>}{row.gstNumber && <p className="text-xs text-slate-500">GSTIN {row.gstNumber}</p>}{row.address && <p className="max-w-56 whitespace-normal text-xs text-slate-500">{row.address}</p>}</div> },
    { key: 'products', header: 'Products', render: (row) => <div className="max-w-xs space-y-1">{row.items.map((item) => <p key={`${item.product}-${item.unit}`} className="truncate">{item.productName} · {item.quantity} {item.unit} × {item.unitPrice == null ? '—' : formatCurrency(item.unitPrice)}{item.lineTotal == null ? '' : ` = ${formatCurrency(item.lineTotal)}`}</p>)}</div> },
    { key: 'totalAmount', header: 'Order total', align: 'right', render: (row) => <span className="font-semibold">{row.totalAmount == null ? '—' : formatCurrency(row.totalAmount)}</span> },
    { key: 'source', header: 'Source', render: (row) => row.source === 'Sales Visit' ? <span title={row.salesVisit?.placeName}>Sales visit</span> : 'Manual' },
    { key: 'status', header: 'Status', render: (row) => hasPermission('orders.edit')
      ? <select aria-label={`Status for ${row.orderNumber}`} className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm" value={row.status} onChange={(event) => changeStatus(row._id, event.target.value)}>{ORDER_STATUSES.map((value) => <option key={value}>{value}</option>)}</select>
      : <Badge tone={STATUS_TONES[row.status] || 'slate'}>{row.status}</Badge> },
    { key: 'createdBy', header: 'Added by', render: (row) => row.createdBy?.name || '—' },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="Orders from sales-visit customer requirements and manually entered orders."
        breadcrumbs={[{ label: 'Sales' }, { label: 'Orders' }]}
        actions={hasPermission('orders.create') && <Button icon={Plus} onClick={openCreate}>Add order</Button>}
      />
      <Card>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="Search order, customer or product" />
          <select aria-label="Filter orders by status" className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {ORDER_STATUSES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>
        <DataTable
          loading={loading}
          columns={columns}
          rows={items}
          minWidth={1180}
          empty={<EmptyState title="No orders found" description={query || status ? 'Try changing your search or status filter.' : 'Add an order manually or record product requirements during a sales visit.'} />}
        />
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add order"
        description="Enter the customer and requested products. Saving an order does not change stock."
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button type="submit" form="create-order-form" loading={busy}>Save order</Button>
        </>}
      >
        <form id="create-order-form" onSubmit={createOrder} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {canLookupCustomers ? <CustomerLookup label="Customer name" value={customerName} onChange={(value) => { setCustomerName(value); setCustomerId(''); }} onSelect={selectCustomer} /> : <label className="text-sm font-medium text-slate-700">Customer name
              <input required maxLength={160} className={inputClass} value={customerName} onChange={(event) => { setCustomerName(event.target.value); setCustomerId(''); }} />
            </label>}
            <label className="text-sm font-medium text-slate-700">Phone
              <input type="tel" maxLength={40} className={inputClass} value={phone} onChange={(event) => setPhone(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">Email
              <input type="email" maxLength={254} className={inputClass} value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className="text-sm font-medium text-slate-700">GSTIN
              <input maxLength={30} className={inputClass} value={gstNumber} onChange={(event) => setGstNumber(event.target.value)} />
            </label>
          </div>
          <label className="block text-sm font-medium text-slate-700">Customer address
            <textarea maxLength={500} rows={2} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Street, city, state, PIN code" />
          </label>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-800">Products</h3>
              <Button type="button" variant="secondary" size="sm" icon={Plus} disabled={orderItems.length >= 50} onClick={() => setOrderItems((current) => [...current, newItem()])}>Add product</Button>
            </div>
            {orderItems.map((item, index) => (
              <div key={index} className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(90px,1fr)_minmax(110px,1fr)_minmax(120px,1fr)_auto]">
                <label className="text-xs font-medium text-slate-600">Product
                  <select required className={inputClass} value={item.productId} onChange={(event) => {
                    const product = products.find((candidate) => candidate.id === event.target.value);
                    changeItem(index, { productId: event.target.value, unit: product?.unit || '', unitPrice: product?.price == null ? '' : String(product.price) });
                  }}>
                    <option value="">Select product</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} · {product.sku}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">Quantity
                  <input required type="number" min="0.001" max="1000000000000" step="0.001" className={inputClass} value={item.quantity} onChange={(event) => changeItem(index, { quantity: event.target.value })} />
                </label>
                <label className="text-xs font-medium text-slate-600">Unit
                  <select required className={inputClass} value={item.unit} onChange={(event) => changeItem(index, { unit: event.target.value })} disabled={!item.productId}>
                    <option value="">Select unit</option>
                    {units.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">Unit price (INR)
                  <input type="number" min="0" max="1000000000000" step="0.01" className={inputClass} value={item.unitPrice} onChange={(event) => changeItem(index, { unitPrice: event.target.value })} placeholder="Use product price" />
                </label>
                <button type="button" aria-label={`Remove product ${index + 1}`} onClick={() => setOrderItems((current) => current.filter((_, itemIndex) => itemIndex !== index))} disabled={orderItems.length === 1} className="mt-5 flex h-10 items-center justify-center rounded-lg px-3 text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40">
                  <Trash2 className="h-4 w-4" />
                </button>
                <label className="text-xs font-medium text-slate-600 sm:col-span-5">Item note
                  <input maxLength={500} className={inputClass} value={item.note} onChange={(event) => changeItem(index, { note: event.target.value })} placeholder="Optional specifications or customer request" />
                </label>
                <p className="text-right text-xs font-medium text-slate-600 sm:col-span-5">
                  Line total: {formatCurrency(lineAmount(item.quantity, item.unitPrice === '' ? (products.find((product) => product.id === item.productId)?.price ?? 0) : item.unitPrice))}
                </p>
              </div>
            ))}
            <p className="text-right text-sm font-semibold text-slate-900">
              Order total: {formatCurrency(orderItems.reduce((total, item) => {
                const catalogPrice = products.find((product) => product.id === item.productId)?.price ?? 0;
                return total + lineAmount(item.quantity, item.unitPrice === '' ? catalogPrice : item.unitPrice);
              }, 0))}
            </p>
          </div>
          <label className="block text-sm font-medium text-slate-700">Order notes
            <textarea maxLength={2000} rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
        </form>
      </Modal>
    </>
  );
}
