const asyncHandler = require('../utils/asyncHandler');
const { getDashboardSummary } = require('../services/dashboard.service');

exports.summary = asyncHandler(async (req, res) => {
  res.json({ success: true, ...(await getDashboardSummary({ from: req.query.from, to: req.query.to })) });
});
