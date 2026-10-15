const mongoose = require('mongoose');
const { Product, Warehouse } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { getStockStatus } = require('../utils/stock');
const { listInventory, inventorySummary, productStockByWarehouse } = require('../services/inventory.service');
const { availableQty } = require('../services/stock.service');

function assertId(id, label) {
  if (!mongoose.isValidObjectId(id)) throw ApiError.badRequest(`Invalid ${label} id`);
}

exports.list = asyncHandler(async (req, res) => {
  const [data, summary] = await Promise.all([
    listInventory(req.query),
    req.query.withSummary === 'true' ? inventorySummary(req.query) : null,
  ]);
  res.json({ success: true, ...data, summary });
});

exports.byWarehouse = asyncHandler(async (req, res) => {
  assertId(req.params.warehouseId, 'warehouse');
  const warehouse = await Warehouse.findById(req.params.warehouseId).select('name code city status isArchived').lean();
  if (!warehouse) throw ApiError.notFound('Warehouse not found');
  const q = { ...req.query, warehouse: req.params.warehouseId };
  const [data, summary] = await Promise.all([listInventory(q), inventorySummary(q)]);
  res.json({ success: true, warehouse, summary, ...data });
});

exports.byProduct = asyncHandler(async (req, res) => {
  assertId(req.params.productId, 'product');
  const product = await Product.findById(req.params.productId).select('name sku size unit stockUnit minimumStock image').lean();
  if (!product) throw ApiError.notFound('Product not found');
  const stock = await productStockByWarehouse(product._id);
  res.json({ success: true, product, items: stock.map((s) => ({ ...s, status: getStockStatus(s.quantity, product.minimumStock) })) });
});

exports.lowStock = asyncHandler(async (req, res) => {
  const q = { ...req.query, stockStatus: req.query.stockStatus || 'LOW_OR_OUT' };
  res.json({ success: true, ...(await listInventory(q)) });
});

/** Available quantity of a product in a warehouse (used live by the stock forms). */
exports.available = asyncHandler(async (req, res) => {
  const { product, warehouse } = req.query;
  assertId(product, 'product');
  assertId(warehouse, 'warehouse');
  const p = await Product.findById(product).select('stockUnit minimumStock').lean();
  if (!p) throw ApiError.notFound('Product not found');
  const quantity = await availableQty(product, warehouse);
  res.json({ success: true, quantity, unit: p.stockUnit, status: getStockStatus(quantity, p.minimumStock) });
});
