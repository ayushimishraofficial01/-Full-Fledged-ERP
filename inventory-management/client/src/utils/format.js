const qtyFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });
const intFmt = new Intl.NumberFormat('en-IN');

export const formatQty = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : qtyFmt.format(Number(n)));
export const formatInt = (n) => intFmt.format(Number(n) || 0);
export const formatCurrency = (n) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
}).format(Number(n) || 0);

export function formatDate(value, { time = false } = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    ...(time ? { hour: '2-digit', minute: '2-digit', hour12: true } : {}),
  });
}

export function formatTime(value) {
  if (!value) return '';
  return new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
}

export function relativeDay(value) {
  const d = new Date(value);
  const today = new Date();
  const diff = Math.round((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(value);
}

export const sizeLabel = (p) => (p ? (p.size !== null && p.size !== undefined && p.size !== '' ? `${formatQty(p.size)} ${p.unit}` : p.unit) : '—');

export const STOCK_STATUS = {
  IN_STOCK: { label: 'In Stock', tone: 'green' },
  LOW_STOCK: { label: 'Low Stock', tone: 'amber' },
  OUT_OF_STOCK: { label: 'Out of Stock', tone: 'red' },
};

export const TX_TYPES = {
  STOCK_IN: { label: 'Stock In', sign: '+', tone: 'green' },
  STOCK_OUT: { label: 'Stock Out', sign: '−', tone: 'red' },
  TRANSFER_IN: { label: 'Transfer In', sign: '+', tone: 'blue' },
  TRANSFER_OUT: { label: 'Transfer Out', sign: '−', tone: 'violet' },
  PRODUCTION_IN: { label: 'Production In', sign: '+', tone: 'green' },
  PRODUCTION_TRANSFER_OUT: { label: 'Production Transfer Out', sign: '−', tone: 'violet' },
  WAREHOUSE_TRANSFER_IN: { label: 'Warehouse Transfer In', sign: '+', tone: 'blue' },
};

export const STOCK_OUT_REASONS = ['Customer dispatch', 'Sale', 'Production use', 'Damaged', 'Expired', 'Sample', 'Returned to supplier', 'Stock adjustment', 'Other'];

/** Local YYYY-MM-DD for <input type="date"> */
export function toDateInput(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/** Combine a picked local date with the current time so same-day entries keep their order. */
export function dateInputToISO(value) {
  if (!value) return undefined;
  const [y, m, d] = value.split('-').map(Number);
  const now = new Date();
  const picked = new Date(y, m - 1, d, now.getHours(), now.getMinutes(), now.getSeconds());
  return picked.toISOString();
}

/** Local day boundaries for date-range filters, sent to the API as ISO timestamps. */
export function rangeToParams(from, to) {
  const params = {};
  if (from) {
    const [y, m, d] = from.split('-').map(Number);
    params.from = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
  }
  if (to) {
    const [y, m, d] = to.split('-').map(Number);
    params.to = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();
  }
  return params;
}

export function todayParams() {
  const t = toDateInput();
  return rangeToParams(t, t);
}
