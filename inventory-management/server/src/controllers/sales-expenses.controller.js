const asyncHandler = require('../utils/asyncHandler');
const { SalesExpense } = require('../models');
const { getPagination, paginated } = require('../utils/query');

const list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 50 });
  const filter = { submittedBy: req.user._id };
  const [expenses, total] = await Promise.all([
    SalesExpense.find(filter)
      .sort({ expenseDate: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .select('expenseDate amount note receipt submittedByName createdAt')
      .lean(),
    SalesExpense.countDocuments(filter),
  ]);
  res.json(paginated(expenses, total, pagination));
});

const create = asyncHandler(async (req, res) => {
  const expense = await SalesExpense.create({
    expenseDate: req.body.expenseDate,
    amount: req.body.amount,
    note: req.body.note,
    receipt: req.file ? `sales-expense-receipts/${req.file.filename}` : null,
    submittedBy: req.user._id,
    submittedByName: req.user.name,
  });
  res.status(201).json({ expense });
});

module.exports = { list, create };
