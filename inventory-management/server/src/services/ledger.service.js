const { Product, StockTransaction, StockTransfer } = require('../models');
const { searchRegex, toObjectId, getPagination, paginated, dateRange } = require('../utils/query');
const { TRANSACTION_TYPES, roundQty } = require('../utils/stock');
const { TX_POPULATE } = require('./stock.service');

const TRANSFER_POPULATE = [
  { path: 'product', select: 'name sku size unit stockUnit image' },
  { path: 'fromWarehouse', select: 'name code' },
  { path: 'toWarehouse', select: 'name code' },
  { path: 'performedBy', select: 'name email' },
];

async function productIdsForSearch(search) {
  const rx = searchRegex(search);
  if (!rx) return null;
  const products = await Product.find({ $or: [{ name: rx }, { sku: rx }, { hsn: rx }] }).select('_id').limit(2000).lean();
  return { rx, ids: products.map((p) => p._id) };
}

async function transactionFilter(q = {}) {
  const filter = {};
  const types = String(q.type || '')
    .split(',')
    .map((t) => t.trim().toUpperCase())
    .filter((t) => TRANSACTION_TYPES[t]);
  if (types.length === 1) filter.type = types[0];
  else if (types.length > 1) filter.type = { $in: types };

  const warehouse = toObjectId(q.warehouse);
  if (q.warehouse && warehouse) filter.warehouse = warehouse;
  const product = toObjectId(q.product);
  if (q.product && product) filter.product = product;
  const range = dateRange(q.from, q.to);
  if (range) filter.date = range;

  const search = await productIdsForSearch(q.search);
  if (search) filter.$or = [{ product: { $in: search.ids } }, { referenceNumber: search.rx }, { supplier: search.rx }, { reason: search.rx }, { customerName: search.rx }];
  return filter;
}

function txSort(q) {
  const order = q.order === 'asc' ? 1 : -1;
  if (q.sort === 'quantity') return { quantity: order, date: -1, _id: -1 };
  return { date: order, createdAt: order, _id: order };
}

async function listTransactions(q = {}, { paginate = true, maxRows } = {}) {
  const filter = await transactionFilter(q);
  const query = StockTransaction.find(filter).sort(txSort(q)).populate(TX_POPULATE).lean();
  if (!paginate) return query.limit(maxRows || 50000);
  const pg = getPagination(q, { defaultLimit: 25 });
  const [items, total] = await Promise.all([query.skip(pg.skip).limit(pg.limit), StockTransaction.countDocuments(filter)]);
  return paginated(items, total, pg);
}

/** Total quantity per unit and number of movements for the current filter (units are never mixed). */
async function transactionTotals(q = {}) {
  const filter = await transactionFilter(q);
  const rows = await StockTransaction.aggregate([
    { $match: filter },
    { $group: { _id: '$unit', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
    { $sort: { quantity: -1 } },
  ]);
  return {
    count: rows.reduce((s, r) => s + r.count, 0),
    byUnit: rows.map((r) => ({ unit: r._id, quantity: roundQty(r.quantity), count: r.count })),
  };
}

async function transferFilter(q = {}) {
  const filter = {};
  const product = toObjectId(q.product);
  if (q.product && product) filter.product = product;
  const from = toObjectId(q.fromWarehouse);
  if (q.fromWarehouse && from) filter.fromWarehouse = from;
  const to = toObjectId(q.toWarehouse);
  if (q.toWarehouse && to) filter.toWarehouse = to;
  const either = toObjectId(q.warehouse);
  if (q.warehouse && either) filter.$or = [{ fromWarehouse: either }, { toWarehouse: either }];
  const range = dateRange(q.from, q.to);
  if (range) filter.date = range;
  const search = await productIdsForSearch(q.search);
  if (search) {
    const s = [{ product: { $in: search.ids } }, { referenceNumber: search.rx }];
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, { $or: s }];
      delete filter.$or;
    } else filter.$or = s;
  }
  return filter;
}

async function listTransfers(q = {}, { paginate = true, maxRows } = {}) {
  const filter = await transferFilter(q);
  const order = q.order === 'asc' ? 1 : -1;
  const sort = q.sort === 'quantity' ? { quantity: order, date: -1 } : { date: order, createdAt: order, _id: order };
  const query = StockTransfer.find(filter).sort(sort).populate(TRANSFER_POPULATE).lean();
  if (!paginate) return query.limit(maxRows || 50000);
  const pg = getPagination(q, { defaultLimit: 25 });
  const [items, total] = await Promise.all([query.skip(pg.skip).limit(pg.limit), StockTransfer.countDocuments(filter)]);
  return paginated(items, total, pg);
}

async function transferTotals(q = {}) {
  const filter = await transferFilter(q);
  const rows = await StockTransfer.aggregate([
    { $match: filter },
    { $group: { _id: '$unit', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
    { $sort: { quantity: -1 } },
  ]);
  return {
    count: rows.reduce((s, r) => s + r.count, 0),
    byUnit: rows.map((r) => ({ unit: r._id, quantity: roundQty(r.quantity), count: r.count })),
  };
}

module.exports = { listTransactions, transactionTotals, listTransfers, transferTotals, transactionFilter };
