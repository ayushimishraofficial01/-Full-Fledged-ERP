const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Warehouse } = require('../models');
const { previewImport, commitImport, buildTemplate } = require('../services/import.service');
const { buildWorkbook, sendWorkbook, columns } = require('../services/export.service');
const { listProducts } = require('../services/product.service');
const { listInventory } = require('../services/inventory.service');
const { listTransactions, listTransfers } = require('../services/ledger.service');
const { listProductionStock, listProductionHistory, listProductionTransfers } = require('../services/production.service');
const { listWarehouses } = require('./warehouse.controller');

const LIMIT = { paginate: false, maxRows: env.maxExportRows };

// ---------- Import ----------
exports.preview = asyncHandler(async (req, res) => {
  const updateExisting = req.body.updateExisting === 'true' || req.body.updateExisting === true;
  const result = await previewImport(req.file, { updateExisting });
  res.json({ success: true, ...result });
});

exports.commit = asyncHandler(async (req, res) => {
  const { rows, updateExisting, fileName } = req.body || {};
  if (!Array.isArray(rows)) throw ApiError.badRequest('rows must be an array');
  const result = await commitImport({ rows, updateExisting: updateExisting === true, fileName }, req.user);
  res.status(201).json({ success: true, message: `Import completed: ${result.rowsImported} row(s) processed.`, ...result });
});

exports.template = asyncHandler(async (req, res) => {
  sendWorkbook(res, await buildTemplate(), 'product-import-template');
});

// ---------- Export ----------
exports.products = asyncHandler(async (req, res) => {
  const rows = await listProducts(req.query, LIMIT);
  sendWorkbook(res, buildWorkbook([{ name: 'Products', columns: columns.productColumns, rows }]), 'products');
});

exports.inventory = asyncHandler(async (req, res) => {
  const rows = await listInventory(req.query, LIMIT);
  let name = 'inventory';
  if (req.query.warehouse) {
    const w = await Warehouse.findById(req.query.warehouse).select('code').lean().catch(() => null);
    if (w) name = `inventory-${w.code}`;
  }
  if (req.query.stockStatus === 'LOW_OR_OUT') name = 'low-stock';
  sendWorkbook(res, buildWorkbook([{ name: 'Inventory', columns: columns.inventoryColumns, rows }]), name);
});

exports.transactions = asyncHandler(async (req, res) => {
  const rows = await listTransactions(req.query, LIMIT);
  const type = String(req.query.type || '').toUpperCase();
  const [cols, name] =
    type === 'STOCK_IN' ? [columns.stockInColumns, 'stock-in']
      : type === 'STOCK_OUT' ? [columns.stockOutColumns, 'stock-out']
        : [columns.transactionColumns, 'transactions'];
  sendWorkbook(res, buildWorkbook([{ name: name.replace('-', ' '), columns: cols, rows }]), name);
});

exports.transfers = asyncHandler(async (req, res) => {
  const rows = await listTransfers(req.query, LIMIT);
  sendWorkbook(res, buildWorkbook([{ name: 'Transfers', columns: columns.transferColumns, rows }]), 'stock-transfers');
});

exports.warehouses = asyncHandler(async (req, res) => {
  const rows = await listWarehouses(req.query, { paginate: false });
  sendWorkbook(res, buildWorkbook([{ name: 'Warehouses', columns: columns.warehouseColumns, rows }]), 'warehouses');
});

exports.production = asyncHandler(async (req, res) => {
  const mode = String(req.query.mode || 'stock');
  if (mode === 'history') {
    const rows = await listProductionHistory(req.query, LIMIT);
    return sendWorkbook(res, buildWorkbook([{ name: 'Production History', columns: columns.productionHistoryColumns, rows }]), 'production-history');
  }
  if (mode === 'transfers') {
    const rows = await listProductionTransfers(req.query, LIMIT);
    return sendWorkbook(res, buildWorkbook([{ name: 'Production Transfers', columns: columns.productionTransferColumns, rows }]), 'production-transfers');
  }
  const rows = await listProductionStock(req.query, LIMIT);
  sendWorkbook(res, buildWorkbook([{ name: 'Production Stock', columns: columns.productionStockColumns, rows }]), 'production-stock');
});
