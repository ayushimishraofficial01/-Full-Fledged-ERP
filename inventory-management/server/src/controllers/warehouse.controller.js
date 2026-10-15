const { Warehouse, Inventory, StockTransaction, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { searchRegex, getPagination, paginated } = require('../utils/query');
const { roundQty, stockStatusExpr } = require('../utils/stock');
const { inventorySummary } = require('../services/inventory.service');

const SORTS = { name: 'name', code: 'code', city: 'city', state: 'state', status: 'status', createdAt: 'createdAt', totalStock: 'totalStock', totalProducts: 'totalProducts' };

function warehouseMatch(q) {
  const match = {};
  if (q.archived === 'only') match.isArchived = true;
  else if (q.archived !== 'true') match.isArchived = { $ne: true };
  if (q.status === 'active' || q.status === 'inactive') match.status = q.status;
  const rx = searchRegex(q.search);
  if (rx) match.$or = [{ name: rx }, { code: rx }, { city: rx }, { location: rx }, { state: rx }];
  return match;
}

async function warehouseStats(ids) {
  const rows = await Inventory.aggregate([
    { $match: { warehouse: { $in: ids } } },
    { $lookup: { from: Product.collection.name, localField: 'product', foreignField: '_id', as: 'p' } },
    { $unwind: '$p' },
    { $match: { 'p.isArchived': { $ne: true } } },
    { $addFields: { status: stockStatusExpr('$quantity', '$p.minimumStock') } },
    {
      $group: {
        _id: '$warehouse',
        totalProducts: { $sum: { $cond: [{ $gt: ['$quantity', 0] }, 1, 0] } },
        totalStock: { $sum: '$quantity' },
        lowStock: { $sum: { $cond: [{ $in: ['$status', ['LOW_STOCK', 'OUT_OF_STOCK']] }, 1, 0] } },
      },
    },
  ]);
  return new Map(rows.map((r) => [String(r._id), r]));
}

async function withStats(warehouses) {
  const stats = await warehouseStats(warehouses.map((w) => w._id));
  return warehouses.map((w) => {
    const s = stats.get(String(w._id)) || {};
    return { ...w, totalProducts: s.totalProducts || 0, totalStock: roundQty(s.totalStock || 0), lowStock: s.lowStock || 0 };
  });
}

async function listWarehouses(q, { paginate = true } = {}) {
  const field = SORTS[q.sort] ? q.sort : 'name';
  const order = q.order === 'desc' ? -1 : 1;
  const match = warehouseMatch(q);
  const statSort = field === 'totalStock' || field === 'totalProducts';

  // Stock-based sorting needs the stats first; warehouse counts are small, so sort in memory.
  if (!paginate || statSort) {
    let all = await withStats(await Warehouse.find(match).sort(statSort ? { name: 1 } : { [SORTS[field]]: order, _id: 1 }).lean());
    if (statSort) all.sort((a, b) => (a[field] - b[field]) * order || a.name.localeCompare(b.name));
    if (!paginate) return all;
    const pg = getPagination(q, { defaultLimit: 20 });
    return paginated(all.slice(pg.skip, pg.skip + pg.limit), all.length, pg);
  }

  const pg = getPagination(q, { defaultLimit: 20 });
  const [items, total] = await Promise.all([
    Warehouse.find(match).sort({ [SORTS[field]]: order, _id: 1 }).skip(pg.skip).limit(pg.limit).lean(),
    Warehouse.countDocuments(match),
  ]);
  return paginated(await withStats(items), total, pg);
}

exports.listWarehouses = listWarehouses;

exports.list = asyncHandler(async (req, res) => {
  if (req.query.all === 'true') {
    // Lightweight list for dropdowns.
    const filter = { isArchived: { $ne: true } };
    if (req.query.status) filter.status = req.query.status;
    const items = await Warehouse.find(filter).select('name code city status').sort({ name: 1 }).lean();
    return res.json({ success: true, items });
  }
  res.json({ success: true, ...(await listWarehouses(req.query)) });
});

exports.get = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id).populate('createdBy updatedBy', 'name').lean();
  if (!warehouse) throw ApiError.notFound('Warehouse not found');
  const summary = await inventorySummary({ warehouse: String(warehouse._id) });
  res.json({ success: true, warehouse, summary });
});

exports.create = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.create({ ...req.body, createdBy: req.user._id, updatedBy: req.user._id });
  res.status(201).json({ success: true, message: 'Warehouse created', warehouse });
});

exports.update = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw ApiError.notFound('Warehouse not found');
  Object.assign(warehouse, req.body, { updatedBy: req.user._id });
  await warehouse.save();
  res.json({ success: true, message: 'Warehouse updated', warehouse });
});

/**
 * A warehouse holding stock cannot be removed (move the stock first). With history it is archived;
 * without any history it is deleted.
 */
exports.remove = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw ApiError.notFound('Warehouse not found');

  const stock = await Inventory.aggregate([{ $match: { warehouse: warehouse._id, quantity: { $gt: 0 } } }, { $group: { _id: null, n: { $sum: 1 }, qty: { $sum: '$quantity' } } }]);
  if (stock.length) {
    throw ApiError.conflict(
      `${warehouse.name} still holds stock of ${stock[0].n} product(s) (${roundQty(stock[0].qty)} units in total). Transfer or stock out all items before deleting this warehouse.`
    );
  }

  if (await StockTransaction.exists({ warehouse: warehouse._id })) {
    warehouse.isArchived = true;
    warehouse.archivedAt = new Date();
    warehouse.status = 'inactive';
    warehouse.updatedBy = req.user._id;
    await warehouse.save();
    return res.json({ success: true, mode: 'archived', message: `${warehouse.name} was archived. Its history is preserved.` });
  }

  await Inventory.deleteMany({ warehouse: warehouse._id });
  await warehouse.deleteOne();
  res.json({ success: true, mode: 'deleted', message: `${warehouse.name} was deleted.` });
});

exports.restore = asyncHandler(async (req, res) => {
  const warehouse = await Warehouse.findById(req.params.id);
  if (!warehouse) throw ApiError.notFound('Warehouse not found');
  warehouse.isArchived = false;
  warehouse.archivedAt = undefined;
  warehouse.status = 'active';
  warehouse.updatedBy = req.user._id;
  await warehouse.save();
  res.json({ success: true, message: `${warehouse.name} restored`, warehouse });
});
