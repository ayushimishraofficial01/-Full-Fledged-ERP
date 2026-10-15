const { Product, Inventory } = require('../models');
const { searchRegex, getPagination, paginated } = require('../utils/query');
const { stockStatusExpr } = require('../utils/stock');

const PRODUCT_SORTS = {
  name: 'name',
  sku: 'sku',
  category: 'category',
  hsn: 'hsn',
  size: 'size',
  price: 'price',
  totalStock: 'totalStock',
  minimumStock: 'minimumStock',
  status: 'status',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
};

function productMatch(q = {}) {
  const match = {};
  if (q.archived === 'only') match.isArchived = true;
  else if (q.archived !== 'true') match.isArchived = { $ne: true };
  if (q.status) match.status = q.status;
  if (q.category) match.category = q.category;
  if (q.unit) match.$or = [{ unit: q.unit }, { stockUnit: q.unit }];
  const rx = searchRegex(q.search);
  if (rx) {
    const s = [{ name: rx }, { sku: rx }, { hsn: rx }, { brand: rx }];
    if (match.$or) {
      match.$and = [{ $or: match.$or }, { $or: s }];
      delete match.$or;
    } else match.$or = s;
  }
  return match;
}

function productPipeline(q = {}) {
  const pipeline = [
    { $match: productMatch(q) },
    {
      $lookup: {
        from: Inventory.collection.name,
        localField: '_id',
        foreignField: 'product',
        as: 'stock',
      },
    },
    {
      $addFields: {
        totalStock: { $round: [{ $sum: '$stock.quantity' }, 3] },
        warehouseCount: { $size: { $filter: { input: '$stock', as: 's', cond: { $gt: ['$$s.quantity', 0] } } } },
      },
    },
    { $addFields: { stockStatus: stockStatusExpr('$totalStock', '$minimumStock') } },
    { $project: { stock: 0 } },
  ];
  if (q.stockStatus) pipeline.push({ $match: { stockStatus: q.stockStatus } });
  return pipeline;
}

function sortStage(q) {
  const field = PRODUCT_SORTS[q.sort] ? q.sort : 'createdAt';
  const order = q.order === 'asc' ? 1 : q.order === 'desc' ? -1 : field === 'createdAt' ? -1 : 1;
  return { $sort: { [PRODUCT_SORTS[field]]: order, _id: order } };
}

async function listProducts(q = {}, { paginate = true, maxRows } = {}) {
  const pipeline = productPipeline(q);
  pipeline.push(sortStage(q));
  if (!paginate) {
    if (maxRows) pipeline.push({ $limit: maxRows });
    return Product.aggregate(pipeline);
  }
  const pg = getPagination(q, { defaultLimit: 20 });
  pipeline.push({ $facet: { items: [{ $skip: pg.skip }, { $limit: pg.limit }], total: [{ $count: 'n' }] } });
  const [res] = await Product.aggregate(pipeline);
  return paginated(res.items, res.total[0]?.n || 0, pg);
}

module.exports = { listProducts, productMatch };
