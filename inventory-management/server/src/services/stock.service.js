const mongoose = require('mongoose');
const { Customer, Product, Warehouse, Inventory, StockTransaction, StockTransfer } = require('../models');
const ApiError = require('../utils/ApiError');
const { TRANSACTION_TYPES, EPSILON, roundQty, formatQty } = require('../utils/stock');
const { runAtomic } = require('./transaction.service');

const TX_POPULATE = [
  { path: 'product', select: 'name sku size unit stockUnit image' },
  { path: 'warehouse', select: 'name code' },
  { path: 'counterpartWarehouse', select: 'name code' },
  { path: 'customer', select: 'fullName customerId phone' },
  { path: 'performedBy', select: 'name email' },
];

async function loadProduct(productId, { requireActive }) {
  const product = await Product.findById(productId).lean();
  if (!product) throw ApiError.notFound('Product not found');
  if (product.isArchived) throw ApiError.badRequest(`"${product.name}" is archived. Restore it before moving stock.`);
  if (requireActive && product.status !== 'active') throw ApiError.badRequest(`"${product.name}" is inactive. Activate it before adding stock.`);
  return product;
}

async function loadWarehouse(warehouseId, { requireActive, label = 'Warehouse' }) {
  const warehouse = await Warehouse.findById(warehouseId).lean();
  if (!warehouse) throw ApiError.notFound(`${label} not found`);
  if (warehouse.isArchived) throw ApiError.badRequest(`${warehouse.name} is archived.`);
  if (requireActive && warehouse.status !== 'active') throw ApiError.badRequest(`${warehouse.name} is inactive and cannot receive stock.`);
  return warehouse;
}

function assertUnit(product, unit) {
  if (unit && String(unit).trim().toUpperCase() !== String(product.stockUnit).toUpperCase()) {
    throw ApiError.badRequest(`Unit must be ${product.stockUnit}, the stock unit of ${product.name}.`);
  }
}

async function availableQty(productId, warehouseId, session) {
  const inv = await Inventory.findOne({ product: productId, warehouse: warehouseId }).session(session || null).lean();
  return inv ? roundQty(inv.quantity) : 0;
}

/**
 * Atomically changes one inventory record by `delta`.
 * Decrements are conditional on sufficient stock, so concurrent requests can never push stock below zero.
 */
async function adjustInventory({ product, warehouseId, delta, at, session, undo }) {
  const opts = { new: true, session: session || undefined };
  let inv;

  if (delta > 0) {
    inv = await Inventory.findOneAndUpdate(
      { product: product._id, warehouse: warehouseId },
      { $inc: { quantity: delta }, $set: { unit: product.stockUnit, lastTransactionAt: at } },
      { ...opts, upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    const need = -delta;
    inv = await Inventory.findOneAndUpdate(
      { product: product._id, warehouse: warehouseId, quantity: { $gte: need - EPSILON } },
      { $inc: { quantity: delta }, $set: { lastTransactionAt: at } },
      opts
    );
    if (!inv) {
      const available = await availableQty(product._id, warehouseId, session);
      throw ApiError.badRequest(`Insufficient stock. Available quantity is ${formatQty(available)} ${product.stockUnit}.`, [
        { field: 'quantity', message: `Available quantity is ${formatQty(available)} ${product.stockUnit}`, available },
      ]);
    }
  }

  if (undo) undo.push(() => Inventory.updateOne({ _id: inv._id }, { $inc: { quantity: -delta } }));

  // Remove floating point drift (e.g. 0.30000000000000004) and clamp tiny negatives to zero.
  const clean = Math.max(0, roundQty(inv.quantity));
  if (clean !== inv.quantity) {
    await Inventory.updateOne({ _id: inv._id }, { $set: { quantity: clean } }, { session: session || undefined });
    inv.quantity = clean;
  }
  return inv;
}

async function createTransactions(docs, session, undo) {
  const created = await StockTransaction.insertMany(docs, { session: session || undefined });
  if (undo) undo.push(() => StockTransaction.deleteMany({ _id: { $in: created.map((d) => d._id) } }));
  return created;
}

async function stockIn(input, user) {
  const product = await loadProduct(input.product, { requireActive: true });
  const warehouse = await loadWarehouse(input.warehouse, { requireActive: true });
  assertUnit(product, input.unit);
  const qty = roundQty(input.quantity);
  const date = input.date || new Date();

  const result = await runAtomic(async (session, undo) => {
    const inv = await adjustInventory({ product, warehouseId: warehouse._id, delta: qty, at: date, session, undo });
    const [tx] = await createTransactions(
      [{
        product: product._id,
        warehouse: warehouse._id,
        type: TRANSACTION_TYPES.STOCK_IN,
        quantity: qty,
        unit: product.stockUnit,
        balanceAfter: inv.quantity,
        referenceNumber: input.referenceNumber,
        supplier: input.supplier,
        notes: input.notes,
        source: input.source || 'manual',
        performedBy: user._id,
        date,
      }],
      session,
      undo
    );
    return { txId: tx._id, quantity: inv.quantity };
  });

  const transaction = await StockTransaction.findById(result.txId).populate(TX_POPULATE).lean();
  return { transaction, previousQuantity: roundQty(result.quantity - qty), newQuantity: result.quantity };
}

async function stockOut(input, user) {
  const product = await loadProduct(input.product, { requireActive: false });
  const warehouse = await loadWarehouse(input.warehouse, { requireActive: false });
  if (input.customer) {
    const customer = await Customer.findOne({ _id: input.customer, status: { $ne: 'archived' } }).select('fullName').lean();
    if (!customer) throw ApiError.badRequest('The selected customer is no longer available. Search for the customer again.');
    input.customerName = input.customerName || customer.fullName;
  }
  assertUnit(product, input.unit);
  const qty = roundQty(input.quantity);
  const date = input.date || new Date();

  const result = await runAtomic(async (session, undo) => {
    const inv = await adjustInventory({ product, warehouseId: warehouse._id, delta: -qty, at: date, session, undo });
    const [tx] = await createTransactions(
      [{
        product: product._id,
        warehouse: warehouse._id,
        type: TRANSACTION_TYPES.STOCK_OUT,
        quantity: qty,
        unit: product.stockUnit,
        balanceAfter: inv.quantity,
        referenceNumber: input.referenceNumber,
        reason: input.reason,
        notes: input.notes,
        source: input.source || 'manual',
        customer: input.customer,
        customerName: input.customerName,
        performedBy: user._id,
        date,
      }],
      session,
      undo
    );
    return { txId: tx._id, quantity: inv.quantity };
  });

  const transaction = await StockTransaction.findById(result.txId).populate(TX_POPULATE).lean();
  return { transaction, previousQuantity: roundQty(result.quantity + qty), newQuantity: result.quantity };
}

async function transferStock(input, user) {
  if (String(input.fromWarehouse) === String(input.toWarehouse)) {
    throw ApiError.badRequest('Source and destination warehouse must be different.');
  }
  const product = await loadProduct(input.product, { requireActive: false });
  const from = await loadWarehouse(input.fromWarehouse, { requireActive: false, label: 'Source warehouse' });
  const to = await loadWarehouse(input.toWarehouse, { requireActive: true, label: 'Destination warehouse' });
  assertUnit(product, input.unit);
  const qty = roundQty(input.quantity);
  const date = input.date || new Date();

  const result = await runAtomic(async (session, undo) => {
    const transferId = new mongoose.Types.ObjectId();
    const outId = new mongoose.Types.ObjectId();
    const inId = new mongoose.Types.ObjectId();

    // Source first: fails fast (and changes nothing) when stock is insufficient.
    const src = await adjustInventory({ product, warehouseId: from._id, delta: -qty, at: date, session, undo });
    const dst = await adjustInventory({ product, warehouseId: to._id, delta: qty, at: date, session, undo });

    const common = {
      product: product._id,
      quantity: qty,
      unit: product.stockUnit,
      referenceNumber: input.referenceNumber,
      notes: input.notes,
      transfer: transferId,
      source: 'transfer',
      performedBy: user._id,
      date,
    };
    await createTransactions(
      [
        { ...common, _id: outId, warehouse: from._id, counterpartWarehouse: to._id, type: TRANSACTION_TYPES.TRANSFER_OUT, balanceAfter: src.quantity },
        { ...common, _id: inId, warehouse: to._id, counterpartWarehouse: from._id, type: TRANSACTION_TYPES.TRANSFER_IN, balanceAfter: dst.quantity },
      ],
      session,
      undo
    );

    await StockTransfer.create(
      [{
        _id: transferId,
        product: product._id,
        fromWarehouse: from._id,
        toWarehouse: to._id,
        quantity: qty,
        unit: product.stockUnit,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        outTransaction: outId,
        inTransaction: inId,
        performedBy: user._id,
        date,
      }],
      { session: session || undefined }
    );
    if (undo) undo.push(() => StockTransfer.deleteOne({ _id: transferId }));

    return { transferId, source: src.quantity, destination: dst.quantity };
  });

  const transfer = await StockTransfer.findById(result.transferId)
    .populate([
      { path: 'product', select: 'name sku size unit stockUnit' },
      { path: 'fromWarehouse', select: 'name code' },
      { path: 'toWarehouse', select: 'name code' },
      { path: 'performedBy', select: 'name email' },
    ])
    .lean();

  return {
    transfer,
    source: { warehouse: from.name, previousQuantity: roundQty(result.source + qty), newQuantity: result.source },
    destination: { warehouse: to.name, previousQuantity: roundQty(result.destination - qty), newQuantity: result.destination },
  };
}

module.exports = { stockIn, stockOut, transferStock, availableQty, adjustInventory, createTransactions, loadProduct, loadWarehouse, assertUnit, TX_POPULATE };
