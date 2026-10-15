const { Product, Warehouse, Inventory, StockTransaction } = require('../models');
const { TRANSACTION_TYPES, roundQty, stockStatusExpr } = require('../utils/stock');
const { listInventory, inventorySummary } = require('./inventory.service');
const { TX_POPULATE } = require('./stock.service');

function todayRange(from, to) {
  const start = from ? new Date(from) : new Date(new Date().setHours(0, 0, 0, 0));
  const end = to ? new Date(to) : new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return todayRange();
  return { start, end };
}

async function warehouseSummary() {
  const warehouses = await Warehouse.find({ isArchived: { $ne: true } }).select('name code city status').sort({ name: 1 }).lean();
  const stats = await Inventory.aggregate([
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
  const byId = new Map(stats.map((s) => [String(s._id), s]));
  return warehouses.map((w) => {
    const s = byId.get(String(w._id)) || {};
    return { ...w, totalProducts: s.totalProducts || 0, totalStock: roundQty(s.totalStock || 0), lowStock: s.lowStock || 0 };
  });
}

async function getDashboardSummary({ from, to } = {}) {
  const { start, end } = todayRange(from, to);

  const [totalProducts, totalWarehouses, invSummary, todayMoves, recentTransactions, lowStock, warehouses] = await Promise.all([
    Product.countDocuments({ isArchived: { $ne: true } }),
    Warehouse.countDocuments({ isArchived: { $ne: true } }),
    inventorySummary({}),
    StockTransaction.aggregate([
      { $match: { date: { $gte: start, $lte: end }, type: { $in: [TRANSACTION_TYPES.STOCK_IN, TRANSACTION_TYPES.STOCK_OUT] } } },
      { $group: { _id: { type: '$type', unit: '$unit' }, quantity: { $sum: '$quantity' }, count: { $sum: 1 } } },
    ]),
    StockTransaction.find().sort({ createdAt: -1, _id: -1 }).limit(10).populate(TX_POPULATE).lean(),
    listInventory({ stockStatus: 'LOW_OR_OUT', limit: '8', sort: 'status', order: 'asc' }),
    warehouseSummary(),
  ]);

  const movement = (type) => {
    const rows = todayMoves.filter((r) => r._id.type === type);
    return {
      count: rows.reduce((s, r) => s + r.count, 0),
      quantity: roundQty(rows.reduce((s, r) => s + r.quantity, 0)),
      byUnit: rows.map((r) => ({ unit: r._id.unit, quantity: roundQty(r.quantity) })).sort((a, b) => b.quantity - a.quantity),
    };
  };

  return {
    range: { from: start, to: end },
    cards: {
      totalProducts,
      totalWarehouses,
      totalStock: invSummary.totalQuantity,
      totalStockByUnit: invSummary.quantityByUnit,
      todayStockIn: movement(TRANSACTION_TYPES.STOCK_IN),
      todayStockOut: movement(TRANSACTION_TYPES.STOCK_OUT),
      lowStockCount: invSummary.lowStock + invSummary.outOfStock,
      outOfStockCount: invSummary.outOfStock,
    },
    warehouses,
    recentTransactions,
    lowStock: lowStock.items,
  };
}

module.exports = { getDashboardSummary, warehouseSummary };
