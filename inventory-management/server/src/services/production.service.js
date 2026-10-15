const mongoose = require('mongoose');
const { Product, Inventory, ProductionStock, ProductionRecord, ProductionTransfer, StockTransaction } = require('../models');
const ApiError = require('../utils/ApiError');
const { TRANSACTION_TYPES, EPSILON, roundQty, formatQty } = require('../utils/stock');
const { runAtomic } = require('./transaction.service');
const { adjustInventory, createTransactions, loadProduct, loadWarehouse, assertUnit } = require('./stock.service');
const { dateRange, getPagination, paginated, searchRegex, toObjectId } = require('../utils/query');

const PRODUCT_SELECT = 'name sku size unit stockUnit image minimumStock status isArchived';

async function getProductionBalance(productId, session) {
  const row = await ProductionStock.findOne({ product: productId }).session(session || null).lean();
  return row ? roundQty(row.quantity) : 0;
}

async function productionIn(input, user) {
  const product = await loadProduct(input.product, { requireActive: true });
  assertUnit(product, input.unit);
  const quantity = roundQty(input.quantityProduced);
  const date = input.productionDate || new Date();

  const result = await runAtomic(async (session, undo) => {
    const stock = await ProductionStock.findOneAndUpdate(
      { product: product._id },
      {
        $inc: { quantity, totalProduced: quantity },
        $set: { unit: product.stockUnit, lastProductionDate: date, lastTransactionAt: date },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, session: session || undefined }
    );
    if (undo) undo.push(() => ProductionStock.updateOne({ _id: stock._id }, { $inc: { quantity: -quantity, totalProduced: -quantity } }));

    const [record] = await ProductionRecord.create([{
      product: product._id,
      productionStock: stock._id,
      quantityProduced: quantity,
      unit: product.stockUnit,
      batchNumber: input.batchNumber,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      productionDate: date,
      createdBy: user._id,
    }], { session: session || undefined });
    if (undo) undo.push(() => ProductionRecord.deleteOne({ _id: record._id }));

    const [tx] = await createTransactions([{
      product: product._id,
      productionStock: stock._id,
      type: TRANSACTION_TYPES.PRODUCTION_IN,
      quantity,
      unit: product.stockUnit,
      balanceAfter: stock.quantity,
      batchNumber: input.batchNumber,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      source: 'manual',
      performedBy: user._id,
      date,
    }], session, undo);

    return { recordId: record._id, txId: tx._id, previousQuantity: roundQty(stock.quantity - quantity), newQuantity: stock.quantity };
  });

  const record = await ProductionRecord.findById(result.recordId).populate('product', PRODUCT_SELECT).populate('createdBy', 'name email').lean();
  return { record, previousQuantity: result.previousQuantity, newQuantity: result.newQuantity };
}

async function transferToWarehouse(input, user) {
  const product = await loadProduct(input.product, { requireActive: false });
  const warehouse = await loadWarehouse(input.toWarehouse, { requireActive: true, label: 'Destination warehouse' });
  assertUnit(product, input.unit);
  const quantity = roundQty(input.quantity);
  const date = input.transferDate || new Date();

  const result = await runAtomic(async (session, undo) => {
    const stock = await ProductionStock.findOneAndUpdate(
      { product: product._id, quantity: { $gte: quantity - EPSILON } },
      { $inc: { quantity: -quantity, totalTransferred: quantity }, $set: { lastTransactionAt: date } },
      { new: true, session: session || undefined }
    );
    if (!stock) {
      const available = await getProductionBalance(product._id, session);
      throw ApiError.badRequest(`Insufficient production stock. Available quantity is ${formatQty(available)} ${product.stockUnit}.`, [
        { field: 'quantity', message: `Available quantity is ${formatQty(available)} ${product.stockUnit}`, available },
      ]);
    }
    if (undo) undo.push(() => ProductionStock.updateOne({ _id: stock._id }, { $inc: { quantity, totalTransferred: -quantity } }));

    const destination = await adjustInventory({ product, warehouseId: warehouse._id, delta: quantity, at: date, session, undo });
    const transferId = new mongoose.Types.ObjectId();
    const outId = new mongoose.Types.ObjectId();
    const inId = new mongoose.Types.ObjectId();
    const common = {
      product: product._id,
      productionStock: stock._id,
      quantity,
      unit: product.stockUnit,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      source: 'transfer',
      performedBy: user._id,
      date,
    };
    await createTransactions([
      { ...common, _id: outId, type: TRANSACTION_TYPES.PRODUCTION_TRANSFER_OUT, balanceAfter: stock.quantity },
      { ...common, _id: inId, warehouse: warehouse._id, type: TRANSACTION_TYPES.WAREHOUSE_TRANSFER_IN, balanceAfter: destination.quantity },
    ], session, undo);

    const [transfer] = await ProductionTransfer.create([{
      _id: transferId,
      product: product._id,
      productionStock: stock._id,
      toWarehouse: warehouse._id,
      quantity,
      unit: product.stockUnit,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      outTransaction: outId,
      inTransaction: inId,
      transferredBy: user._id,
      transferDate: date,
    }], { session: session || undefined });
    if (undo) undo.push(() => ProductionTransfer.deleteOne({ _id: transfer._id }));
    return { transferId, source: stock.quantity, destination: destination.quantity };
  });

  const transfer = await ProductionTransfer.findById(result.transferId)
    .populate('product', PRODUCT_SELECT)
    .populate('toWarehouse', 'name code')
    .populate('transferredBy', 'name email')
    .lean();
  return {
    transfer,
    source: { previousQuantity: roundQty(result.source + quantity), newQuantity: result.source },
    destination: { warehouse: warehouse.name, previousQuantity: roundQty(result.destination - quantity), newQuantity: result.destination },
  };
}

function productFilter(q = {}) {
  const filter = {};
  const product = toObjectId(q.product);
  if (product) filter.product = product;
  const rx = searchRegex(q.search);
  return { filter, rx };
}

async function listProductionStock(q = {}, { paginate = true, maxRows } = {}) {
  const { filter, rx } = productFilter(q);
  const rows = await ProductionStock.find(filter).populate('product', PRODUCT_SELECT).sort({ 'product.name': 1 }).lean();
  const items = rows
    .filter((row) => row.product && !row.product.isArchived && (!rx || rx.test(`${row.product.name} ${row.product.sku} ${row.product.hsn || ''}`)))
    .map((row) => ({ ...row, quantity: roundQty(row.quantity), totalProduced: roundQty(row.totalProduced), totalTransferred: roundQty(row.totalTransferred), status: row.quantity <= EPSILON ? 'OUT_OF_STOCK' : row.quantity < Number(row.product.minimumStock || 0) ? 'LOW_STOCK' : 'IN_STOCK' }));
  if (!paginate) return maxRows ? items.slice(0, maxRows) : items;
  const pg = getPagination(q, { defaultLimit: 25 });
  return paginated(items.slice(pg.skip, pg.skip + pg.limit), items.length, pg);
}

async function listProductionHistory(q = {}, { paginate = true, maxRows } = {}) {
  const filter = {};
  const product = toObjectId(q.product);
  if (product) filter.product = product;
  const range = dateRange(q.from, q.to);
  if (range) filter.productionDate = range;
  if (q.batch) filter.batchNumber = searchRegex(q.batch);
  const query = ProductionRecord.find(filter).sort({ productionDate: -1, createdAt: -1 }).populate('product', PRODUCT_SELECT).populate('createdBy', 'name email').lean();
  if (!paginate) return maxRows ? query.limit(maxRows) : query;
  const pg = getPagination(q, { defaultLimit: 25 });
  const [items, total] = await Promise.all([query.skip(pg.skip).limit(pg.limit), ProductionRecord.countDocuments(filter)]);
  return paginated(items, total, pg);
}

async function listProductionTransfers(q = {}, { paginate = true, maxRows } = {}) {
  const filter = {};
  const product = toObjectId(q.product);
  if (product) filter.product = product;
  const warehouse = toObjectId(q.warehouse);
  if (warehouse) filter.toWarehouse = warehouse;
  const range = dateRange(q.from, q.to);
  if (range) filter.transferDate = range;
  const query = ProductionTransfer.find(filter).sort({ transferDate: -1, createdAt: -1 }).populate('product', PRODUCT_SELECT).populate('toWarehouse', 'name code').populate('transferredBy', 'name email').lean();
  if (!paginate) return query.limit(maxRows || 50000);
  const pg = getPagination(q, { defaultLimit: 25 });
  const [items, total] = await Promise.all([query.skip(pg.skip).limit(pg.limit), ProductionTransfer.countDocuments(filter)]);
  return paginated(items, total, pg);
}

async function productionDashboard() {
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const [stock, produced, transfers] = await Promise.all([
    ProductionStock.find().populate('product', PRODUCT_SELECT).lean(),
    ProductionRecord.aggregate([{ $match: { productionDate: { $gte: start, $lt: end } } }, { $group: { _id: '$unit', quantity: { $sum: '$quantityProduced' }, count: { $sum: 1 } } }]),
    ProductionTransfer.aggregate([{ $match: { transferDate: { $gte: start, $lt: end } } }, { $group: { _id: '$unit', quantity: { $sum: '$quantity' }, count: { $sum: 1 } } }]),
  ]);
  const active = stock.filter((row) => row.product && !row.product.isArchived);
  const totalQuantity = active.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
  const lowStock = active.filter((row) => row.quantity > EPSILON && row.quantity < Number(row.product.minimumStock || 0)).length;
  return {
    totalProducts: active.length,
    totalQuantity: roundQty(totalQuantity),
    todayProduction: produced.map((row) => ({ unit: row._id, quantity: roundQty(row.quantity), count: row.count })),
    todayTransfers: transfers.map((row) => ({ unit: row._id, quantity: roundQty(row.quantity), count: row.count })),
    lowStock,
    productsInStock: active.filter((row) => row.quantity > EPSILON).length,
  };
}

async function getAvailable(productId) {
  const product = await loadProduct(productId, { requireActive: false });
  return { product, quantity: await getProductionBalance(product._id) };
}

module.exports = { productionIn, transferToWarehouse, listProductionStock, listProductionHistory, listProductionTransfers, productionDashboard, getAvailable };
