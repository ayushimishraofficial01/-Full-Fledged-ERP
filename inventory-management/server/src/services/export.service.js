const XLSX = require('xlsx');
const env = require('../config/env');

const STATUS_LABEL = { IN_STOCK: 'In Stock', LOW_STOCK: 'Low Stock', OUT_OF_STOCK: 'Out of Stock' };
const TYPE_LABEL = { STOCK_IN: 'Stock In', STOCK_OUT: 'Stock Out', TRANSFER_IN: 'Transfer In', TRANSFER_OUT: 'Transfer Out', PRODUCTION_IN: 'Production In', PRODUCTION_TRANSFER_OUT: 'Production Transfer Out', WAREHOUSE_TRANSFER_IN: 'Warehouse Transfer In' };

function fmtDate(d, withTime = true) {
  if (!d) return '';
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: env.timezone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t)?.value || '';
  const day = `${get('day')}-${get('month')}-${get('year')}`;
  return withTime ? `${day} ${get('hour')}:${get('minute')}` : day;
}

/**
 * columns: [{ header, value: (row) => any, width }]
 * Returns an .xlsx Buffer.
 */
function buildWorkbook(sheets) {
  const wb = XLSX.utils.book_new();
  sheets.forEach(({ name, columns, rows }) => {
    const aoa = [columns.map((c) => c.header), ...rows.map((r) => columns.map((c) => {
      const v = c.value(r);
      return v === undefined || v === null ? '' : v;
    }))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = columns.map((c) => ({ wch: c.width || Math.max(10, c.header.length + 2) }));
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(rows.length, 1), c: columns.length - 1 } }) };
    XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
  });
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx', compression: true });
}

function sendWorkbook(res, buffer, baseName) {
  const stamp = new Date().toISOString().slice(0, 10);
  const safe = String(baseName).replace(/[^a-z0-9_-]+/gi, '-').replace(/-+/g, '-').toLowerCase();
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}-${stamp}.xlsx"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(buffer);
}

const productColumns = [
  { header: 'Product Name', value: (r) => r.name, width: 30 },
  { header: 'SKU', value: (r) => r.sku, width: 14 },
  { header: 'Category', value: (r) => r.category, width: 18 },
  { header: 'Brand', value: (r) => r.brand, width: 14 },
  { header: 'HSN', value: (r) => r.hsn, width: 10 },
  { header: 'Size', value: (r) => r.size ?? '', width: 8 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Stock Unit', value: (r) => r.stockUnit, width: 10 },
  { header: 'Price (INR)', value: (r) => r.price ?? '', width: 14 },
  { header: 'Total Stock', value: (r) => r.totalStock ?? 0, width: 12 },
  { header: 'Minimum Stock', value: (r) => r.minimumStock ?? 0, width: 14 },
  { header: 'Stock Status', value: (r) => STATUS_LABEL[r.stockStatus] || '', width: 13 },
  { header: 'Warehouses With Stock', value: (r) => r.warehouseCount ?? 0, width: 12 },
  { header: 'Status', value: (r) => (r.isArchived ? 'Archived' : r.status === 'active' ? 'Active' : 'Inactive'), width: 10 },
  { header: 'Description', value: (r) => r.description, width: 40 },
];

const inventoryColumns = [
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Category', value: (r) => r.product?.category, width: 16 },
  { header: 'Warehouse', value: (r) => r.warehouse?.name, width: 22 },
  { header: 'Warehouse Code', value: (r) => r.warehouse?.code, width: 12 },
  { header: 'Size', value: (r) => (r.product?.size != null ? `${r.product.size} ${r.product.unit}` : r.product?.unit), width: 12 },
  { header: 'Unit', value: (r) => r.product?.stockUnit || r.unit, width: 8 },
  { header: 'Current Stock', value: (r) => r.quantity, width: 14 },
  { header: 'Minimum Stock', value: (r) => r.product?.minimumStock ?? 0, width: 14 },
  { header: 'Status', value: (r) => STATUS_LABEL[r.status], width: 13 },
  { header: 'Last Movement', value: (r) => fmtDate(r.lastTransactionAt || r.updatedAt), width: 17 },
];

const transactionColumns = [
  { header: 'Date', value: (r) => fmtDate(r.date), width: 17 },
  { header: 'Type', value: (r) => TYPE_LABEL[r.type] || r.type, width: 13 },
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Warehouse', value: (r) => r.warehouse?.name, width: 22 },
  { header: 'Quantity', value: (r) => (['STOCK_OUT', 'TRANSFER_OUT'].includes(r.type) ? -r.quantity : r.quantity), width: 11 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Balance After', value: (r) => r.balanceAfter, width: 13 },
  { header: 'From / To Warehouse', value: (r) => r.counterpartWarehouse?.name || '', width: 22 },
  { header: 'Reference', value: (r) => r.referenceNumber, width: 16 },
  { header: 'Supplier', value: (r) => r.supplier, width: 18 },
  { header: 'Reason', value: (r) => r.reason, width: 18 },
  { header: 'Notes', value: (r) => r.notes, width: 30 },
  { header: 'User', value: (r) => r.performedBy?.name, width: 18 },
  { header: 'Recorded At', value: (r) => fmtDate(r.createdAt), width: 17 },
];

const stockInColumns = [
  { header: 'Date', value: (r) => fmtDate(r.date), width: 17 },
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Warehouse', value: (r) => r.warehouse?.name, width: 22 },
  { header: 'Quantity', value: (r) => r.quantity, width: 11 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Reference', value: (r) => r.referenceNumber, width: 16 },
  { header: 'Supplier', value: (r) => r.supplier, width: 18 },
  { header: 'Notes', value: (r) => r.notes, width: 30 },
  { header: 'User', value: (r) => r.performedBy?.name, width: 18 },
];

const stockOutColumns = [
  { header: 'Date', value: (r) => fmtDate(r.date), width: 17 },
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Warehouse', value: (r) => r.warehouse?.name, width: 22 },
  { header: 'Quantity', value: (r) => r.quantity, width: 11 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Reason', value: (r) => r.reason, width: 18 },
  { header: 'Reference', value: (r) => r.referenceNumber, width: 16 },
  { header: 'Notes', value: (r) => r.notes, width: 30 },
  { header: 'User', value: (r) => r.performedBy?.name, width: 18 },
];

const transferColumns = [
  { header: 'Date', value: (r) => fmtDate(r.date), width: 17 },
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'From Warehouse', value: (r) => r.fromWarehouse?.name, width: 22 },
  { header: 'To Warehouse', value: (r) => r.toWarehouse?.name, width: 22 },
  { header: 'Quantity', value: (r) => r.quantity, width: 11 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Reference', value: (r) => r.referenceNumber, width: 16 },
  { header: 'Notes', value: (r) => r.notes, width: 30 },
  { header: 'User', value: (r) => r.performedBy?.name, width: 18 },
];

const warehouseColumns = [
  { header: 'Warehouse Name', value: (r) => r.name, width: 24 },
  { header: 'Code', value: (r) => r.code, width: 10 },
  { header: 'Location', value: (r) => r.location, width: 16 },
  { header: 'Address', value: (r) => r.address, width: 36 },
  { header: 'City', value: (r) => r.city, width: 14 },
  { header: 'State', value: (r) => r.state, width: 16 },
  { header: 'Pincode', value: (r) => r.pincode, width: 10 },
  { header: 'Contact Person', value: (r) => r.contactPerson, width: 18 },
  { header: 'Contact Number', value: (r) => r.contactNumber, width: 16 },
  { header: 'Products In Stock', value: (r) => r.totalProducts ?? 0, width: 12 },
  { header: 'Total Stock', value: (r) => r.totalStock ?? 0, width: 12 },
  { header: 'Status', value: (r) => (r.isArchived ? 'Archived' : r.status === 'active' ? 'Active' : 'Inactive'), width: 10 },
];

const productionStockColumns = [
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Size', value: (r) => (r.product?.size != null ? `${r.product.size} ${r.product.unit}` : r.product?.unit), width: 12 },
  { header: 'Available Quantity', value: (r) => r.quantity, width: 18 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Total Produced', value: (r) => r.totalProduced, width: 14 },
  { header: 'Total Transferred', value: (r) => r.totalTransferred, width: 16 },
  { header: 'Last Production Date', value: (r) => fmtDate(r.lastProductionDate, false), width: 18 },
];

const productionHistoryColumns = [
  { header: 'Date', value: (r) => fmtDate(r.productionDate), width: 17 },
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Batch Number', value: (r) => r.batchNumber, width: 18 },
  { header: 'Quantity Produced', value: (r) => r.quantityProduced, width: 18 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Reference', value: (r) => r.referenceNumber, width: 18 },
  { header: 'Notes', value: (r) => r.notes, width: 30 },
  { header: 'User', value: (r) => r.createdBy?.name, width: 18 },
];

const productionTransferColumns = [
  { header: 'Date', value: (r) => fmtDate(r.transferDate), width: 17 },
  { header: 'Product', value: (r) => r.product?.name, width: 30 },
  { header: 'SKU', value: (r) => r.product?.sku, width: 14 },
  { header: 'Destination Warehouse', value: (r) => r.toWarehouse?.name, width: 24 },
  { header: 'Quantity', value: (r) => r.quantity, width: 12 },
  { header: 'Unit', value: (r) => r.unit, width: 8 },
  { header: 'Reference', value: (r) => r.referenceNumber, width: 18 },
  { header: 'Notes', value: (r) => r.notes, width: 30 },
  { header: 'User', value: (r) => r.transferredBy?.name, width: 18 },
];

module.exports = {
  buildWorkbook,
  sendWorkbook,
  fmtDate,
  columns: { productColumns, inventoryColumns, transactionColumns, stockInColumns, stockOutColumns, transferColumns, warehouseColumns, productionStockColumns, productionHistoryColumns, productionTransferColumns },
};
