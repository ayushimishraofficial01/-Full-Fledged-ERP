const asyncHandler = require('../utils/asyncHandler');
const { formatQty } = require('../utils/stock');
const stockService = require('../services/stock.service');
const { listTransactions, transactionTotals, listTransfers } = require('../services/ledger.service');

exports.stockIn = asyncHandler(async (req, res) => {
  const result = await stockService.stockIn(req.body, req.user);
  const t = result.transaction;
  res.status(201).json({
    success: true,
    message: `Added ${formatQty(t.quantity)} ${t.unit} of ${t.product.name} to ${t.warehouse.name}. New stock: ${formatQty(result.newQuantity)} ${t.unit}.`,
    ...result,
  });
});

exports.stockOut = asyncHandler(async (req, res) => {
  const result = await stockService.stockOut(req.body, req.user);
  const t = result.transaction;
  res.status(201).json({
    success: true,
    message: `Removed ${formatQty(t.quantity)} ${t.unit} of ${t.product.name} from ${t.warehouse.name}. Remaining stock: ${formatQty(result.newQuantity)} ${t.unit}.`,
    ...result,
  });
});

exports.transfer = asyncHandler(async (req, res) => {
  const result = await stockService.transferStock(req.body, req.user);
  const t = result.transfer;
  res.status(201).json({
    success: true,
    message: `Transferred ${formatQty(t.quantity)} ${t.unit} of ${t.product.name} from ${t.fromWarehouse.name} to ${t.toWarehouse.name}.`,
    ...result,
  });
});

exports.transactions = asyncHandler(async (req, res) => {
  const [data, totals] = await Promise.all([
    listTransactions(req.query),
    req.query.withTotals === 'true' ? transactionTotals(req.query) : null,
  ]);
  res.json({ success: true, ...data, totals });
});

exports.transfers = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await listTransfers(req.query)) });
});
