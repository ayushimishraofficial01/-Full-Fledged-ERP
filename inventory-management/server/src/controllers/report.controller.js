const asyncHandler = require('../utils/asyncHandler');
const { listInventory, inventorySummary } = require('../services/inventory.service');
const { listTransactions, transactionTotals, listTransfers, transferTotals } = require('../services/ledger.service');

exports.inventory = asyncHandler(async (req, res) => {
  const [data, summary] = await Promise.all([listInventory(req.query), inventorySummary(req.query)]);
  res.json({ success: true, ...data, summary });
});

const typed = (type) =>
  asyncHandler(async (req, res) => {
    const q = { ...req.query, type };
    const [data, totals] = await Promise.all([listTransactions(q), transactionTotals(q)]);
    res.json({ success: true, ...data, totals });
  });

exports.stockIn = typed('STOCK_IN');
exports.stockOut = typed('STOCK_OUT');

exports.transfers = asyncHandler(async (req, res) => {
  const [data, totals] = await Promise.all([listTransfers(req.query), transferTotals(req.query)]);
  res.json({ success: true, ...data, totals });
});
