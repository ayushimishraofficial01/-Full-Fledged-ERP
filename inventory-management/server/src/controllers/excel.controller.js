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
  const buffer = await buildWorkbook([{ name: 'Products', columns: columns.productColumns, rows }]);
  sendWorkbook(res, buffer, 'products');
});

exports.inventory = asyncHandler(async (req, res) => {
  const rows = await listInventory(req.query, LIMIT);
  let name = 'inventory';
  if (req.query.warehouse) {
    const w = await Warehouse.findById(req.query.warehouse).select('code').lean().catch(() => null);
    if (w) name = `inventory-${w.code}`;
  }
  if (req.query.stockStatus === 'LOW_OR_OUT') name = 'low-stock';
  const buffer = await buildWorkbook([{ name: 'Inventory', columns: columns.inventoryColumns, rows }]);
  sendWorkbook(res, buffer, name);
});

exports.transactions = asyncHandler(async (req, res) => {
  const rows = await listTransactions(req.query, LIMIT);
  const type = String(req.query.type || '').toUpperCase();
  const [cols, name] =
    type === 'STOCK_IN' ? [columns.stockInColumns, 'stock-in']
      : type === 'STOCK_OUT' ? [columns.stockOutColumns, 'stock-out']
        : [columns.transactionColumns, 'transactions'];
  const buffer = await buildWorkbook([{ name: name.replace('-', ' '), columns: cols, rows }]);
  sendWorkbook(res, buffer, name);
});

exports.transfers = asyncHandler(async (req, res) => {
  const rows = await listTransfers(req.query, LIMIT);
  const buffer = await buildWorkbook([{ name: 'Transfers', columns: columns.transferColumns, rows }]);
  sendWorkbook(res, buffer, 'stock-transfers');
});

exports.warehouses = asyncHandler(async (req, res) => {
  const rows = await listWarehouses(req.query, { paginate: false });
  const buffer = await buildWorkbook([{ name: 'Warehouses', columns: columns.warehouseColumns, rows }]);
  sendWorkbook(res, buffer, 'warehouses');
});

exports.production = asyncHandler(async (req, res) => {
  const mode = String(req.query.mode || 'stock');
  if (mode === 'history') {
    const rows = await listProductionHistory(req.query, LIMIT);
    const buffer = await buildWorkbook([{ name: 'Production History', columns: columns.productionHistoryColumns, rows }]);
    return sendWorkbook(res, buffer, 'production-history');
  }
  if (mode === 'transfers') {
    const rows = await listProductionTransfers(req.query, LIMIT);
    const buffer = await buildWorkbook([{ name: 'Production Transfers', columns: columns.productionTransferColumns, rows }]);
    return sendWorkbook(res, buffer, 'production-transfers');
  }
  const rows = await listProductionStock(req.query, LIMIT);
  const buffer = await buildWorkbook([{ name: 'Production Stock', columns: columns.productionStockColumns, rows }]);
  sendWorkbook(res, buffer, 'production-stock');
});
