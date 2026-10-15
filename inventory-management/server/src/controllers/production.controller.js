const asyncHandler = require('../utils/asyncHandler');
const production = require('../services/production.service');

exports.dashboard = asyncHandler(async (req, res) => {
  res.json({ success: true, dashboard: await production.productionDashboard() });
});

exports.available = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await production.getAvailable(req.params.productId)) });
});

exports.add = asyncHandler(async (req, res) => {
  const result = await production.productionIn(req.body, req.user);
  res.status(201).json({ success: true, message: 'Production added', ...result });
});

exports.stock = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await production.listProductionStock(req.query)) });
});

exports.transfer = asyncHandler(async (req, res) => {
  const result = await production.transferToWarehouse(req.body, req.user);
  res.status(201).json({ success: true, message: 'Production stock transferred', ...result });
});

exports.history = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await production.listProductionHistory(req.query)) });
});

exports.transfers = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await production.listProductionTransfers(req.query)) });
});
