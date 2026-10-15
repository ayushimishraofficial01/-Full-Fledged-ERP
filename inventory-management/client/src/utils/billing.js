export const invoiceLineAmount = (line) =>
  Math.round(((Number(line?.qty) || 0) * (Number(line?.rate) || 0) + Number.EPSILON) * 100) / 100;

export function calculateInvoiceTotals(invoice) {
  const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
  const subtotal = lines.reduce((sum, line) => sum + invoiceLineAmount(line), 0);
  const tax = Math.round((lines.reduce((sum, line) => sum + invoiceLineAmount(line) * (Number(line?.gst) || 0) / 100, 0) + Number.EPSILON) * 100) / 100;
  const gross = Math.round((subtotal + tax + Number.EPSILON) * 100) / 100;
  return { subtotal, tax, gross, total: Math.max(0, Math.round((gross - (Number(invoice?.credits) || 0) + Number.EPSILON) * 100) / 100) };
}

export function validateInvoice(invoice) {
  if (!String(invoice?.customer || '').trim()) return 'Add a customer name before saving.';
  const lines = Array.isArray(invoice?.lines) ? invoice.lines : [];
  if (!lines.length) return 'Add at least one item to the invoice.';
  if (lines.some((line) => !String(line?.description || '').trim() || line?.qty === '' || !Number.isFinite(Number(line?.qty)) || Number(line.qty) <= 0 || line?.rate === '' || !Number.isFinite(Number(line?.rate)) || Number(line.rate) < 0 || ![0, 5, 12, 18, 28].includes(Number(line?.gst)))) {
    return 'Every item needs a description, a quantity above zero, a valid rate, and a GST rate.';
  }
  if (Number(invoice?.credits) < 0) return 'Credits applied cannot be negative.';
  return null;
}
