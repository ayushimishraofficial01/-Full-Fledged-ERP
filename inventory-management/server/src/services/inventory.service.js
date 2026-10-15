const { Inventory, Product, Warehouse } = require('../models');
const { searchRegex, toObjectId, getPagination, paginated } = require('../utils/query');
const { stockStatusExpr, roundQty } = require('../utils/stock');

const INVENTORY_SORTS = {
  product: 'product.name',
  sku: 'product.sku',
  warehouse: 'warehouse.name',
  quantity: 'quantity',
  minimumStock: 'product.minimumStock',
  status: 'statusRank',
  updatedAt: 'updatedAt',
};

/** Base aggregation joining inventory -> product -> warehouse, with filters and computed stock status. */
function baseInventoryPipeline(q = {}) {
  const invMatch = {};
  const warehouseId = toObjectId(q.warehouse);
  const productId = toObjectId(q.product);
  if (q.warehouse && warehouseId) invMatch.warehouse = warehouseId;
  if (q.product && productId) invMatch.product = productId;

  const productMatch = { 'product.isArchived': { $ne: true } };
  if (q.category) productMatch['product.category'] = q.category;
  if (q.unit) productMatch.$or = [{ 'product.unit': q.unit }, { 'product.stockUnit': q.unit }];
  const rx = searchRegex(q.search);
  if (rx) {
    const searchOr = [{ 'product.name': rx }, { 'product.sku': rx }, { 'product.hsn': rx }];
    if (productMatch.$or) {
      productMatch.$and = [{ $or: productMatch.$or }, { $or: searchOr }];
      delete productMatch.$or;
    } else productMatch.$or = searchOr;
  }

  const pipeline = [
    { $match: invMatch },
    {
      $lookup: {
        from: Product.collection.name,
        localField: 'product',
        foreignField: '_id',
        as: 'product',
      },
    },
    { $unwind: '$product' },
    { $match: productMatch },
    {
      $lookup: {
        from: Warehouse.collection.name,
        localField: 'warehouse',
        foreignField: '_id',
        as: 'warehouse',
      },
    },
    { $unwind: '$warehouse' },
    { $match: { 'warehouse.isArchived': { $ne: true } } },
    {
      $project: {
        quantity: 1, unit: 1, lastTransactionAt: 1, createdAt: 1, updatedAt: 1,
        product: { _id: 1, name: 1, sku: 1, image: 1, category: 1, brand: 1, hsn: 1, size: 1, unit: 1, stockUnit: 1, minimumStock: 1, status: 1, isArchived: 1 },
        warehouse: { _id: 1, name: 1, code: 1, city: 1, status: 1, isArchived: 1 },
      },
    },
    { $addFields: { status: stockStatusExpr('$quantity', '$product.minimumStock') } },
    {
      $addFields: {
        statusRank: { $switch: { branches: [{ case: { $eq: ['$status', 'OUT_OF_STOCK'] }, then: 0 }, { case: { $eq: ['$status', 'LOW_STOCK'] }, then: 1 }], default: 2 } },
      },
    },
  ];

  if (q.stockStatus === 'LOW_OR_OUT') pipeline.push({ $match: { status: { $in: ['LOW_STOCK', 'OUT_OF_STOCK'] } } });
  else if (q.stockStatus) pipeline.push({ $match: { status: q.stockStatus } });
  return pipeline;
}

function sortStage(q, fallback = { field: 'product', order: 1 }) {
  const field = INVENTORY_SORTS[q.sort] ? q.sort : fallback.field;
  const order = q.order === 'desc' ? -1 : q.order === 'asc' ? 1 : fallback.order;
  const sort = { [INVENTORY_SORTS[field]]: order };
  if (field !== 'product') sort['product.name'] = 1;
  sort._id = 1;
  return { $sort: sort };
}

async function listInventory(q = {}, { paginate = true, maxRows } = {}) {
  const pipeline = baseInventoryPipeline(q);
  pipeline.push(sortStage(q, q.stockStatus === 'LOW_OR_OUT' ? { field: 'status', order: 1 } : undefined));

  if (!paginate) {
    if (maxRows) pipeline.push({ $limit: maxRows });
    return Inventory.aggregate(pipeline);
  }

  const pg = getPagination(q, { defaultLimit: 25 });
  pipeline.push({ $facet: { items: [{ $skip: pg.skip }, { $limit: pg.limit }], total: [{ $count: 'n' }] } });
  const [res] = await Inventory.aggregate(pipeline);
  return paginated(res.items, res.total[0]?.n || 0, pg);
}

async function inventorySummary(q = {}) {
  const pipeline = baseInventoryPipeline({ ...q, stockStatus: undefined });
  pipeline.push(
    {
      $group: {
        _id: null,
        records: { $sum: 1 },
        products: { $addToSet: '$product._id' },
        productsInStock: { $addToSet: { $cond: [{ $gt: ['$quantity', 0] }, '$product._id', '$$REMOVE'] } },
        totalQuantity: { $sum: '$quantity' },
        lowStock: { $sum: { $cond: [{ $eq: ['$status', 'LOW_STOCK'] }, 1, 0] } },
        outOfStock: { $sum: { $cond: [{ $eq: ['$status', 'OUT_OF_STOCK'] }, 1, 0] } },
      },
    },
    {
      $project: {
        _id: 0,
        records: 1,
        totalProducts: { $size: '$products' },
        productsInStock: { $size: '$productsInStock' },
        totalQuantity: 1,
        lowStock: 1,
        outOfStock: 1,
      },
    }
  );
  const byUnitPipeline = baseInventoryPipeline({ ...q, stockStatus: undefined });
  byUnitPipeline.push({ $group: { _id: '$product.stockUnit', quantity: { $sum: '$quantity' } } }, { $sort: { quantity: -1 } });

  const [[summary], byUnit] = await Promise.all([Inventory.aggregate(pipeline), Inventory.aggregate(byUnitPipeline)]);
  const base = summary || { records: 0, totalProducts: 0, productsInStock: 0, totalQuantity: 0, lowStock: 0, outOfStock: 0 };
  return {
    ...base,
    totalQuantity: roundQty(base.totalQuantity),
    quantityByUnit: byUnit.map((u) => ({ unit: u._id, quantity: roundQty(u.quantity) })),
  };
}

/** Stock of one product in every warehouse (including warehouses where it has no record yet). */
async function productStockByWarehouse(productId) {
  const rows = await Inventory.find({ product: productId }).populate('warehouse', 'name code city status isArchived').lean();
  return rows
    .filter((r) => r.warehouse && !r.warehouse.isArchived)
    .map((r) => ({ _id: r._id, warehouse: r.warehouse, quantity: roundQty(r.quantity), unit: r.unit, updatedAt: r.updatedAt, lastTransactionAt: r.lastTransactionAt }))
    .sort((a, b) => a.warehouse.name.localeCompare(b.warehouse.name));
}

module.exports = { listInventory, inventorySummary, productStockByWarehouse, baseInventoryPipeline };
