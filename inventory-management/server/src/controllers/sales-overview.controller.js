const asyncHandler = require('../utils/asyncHandler');
const mongoose = require('mongoose');
const { SalesExpense, SalesOrder, SalesStaff, SalesVisit, User } = require('../models');
const { dateRange, paginated } = require('../utils/query');

function recordFilter(field, range, userId) {
  const filter = {};
  if (range) filter[field] = range;
  if (userId) filter[field === 'expenseDate' ? 'submittedBy' : field === 'orderDate' ? 'createdBy' : 'user'] = new mongoose.Types.ObjectId(userId);
  return filter;
}

async function pageOf(model, filter, sort, page, limit, select, populate) {
  let query = model.find(filter)
      .select(select)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit);
  if (populate) query = query.populate(populate);
  const [items, total] = await Promise.all([
    query.lean(),
    model.countDocuments(filter),
  ]);
  return paginated(items, total, { page, limit });
}

const getOverview = asyncHandler(async (req, res) => {
  const { from, to, userId, expensesPage, ordersPage, visitsPage, limit } = req.query;
  const range = dateRange(from, to);
  const expenseFilter = recordFilter('expenseDate', range, userId);
  const orderFilter = recordFilter('orderDate', range, userId);
  const visitFilter = recordFilter('checkIn.at', range, userId);
  const [
    expenseSummary,
    orderCount,
    visitCount,
    expenses,
    orders,
    visits,
    visitCounts,
    orderCounts,
    weeklyVisitCounts,
    weeklyOrderCounts,
    [staffUserIds, salesRoleUserIds],
    expenseUserIds,
    orderUserIds,
    visitUserIds,
  ] = await Promise.all([
    SalesExpense.aggregate([
      { $match: expenseFilter },
      { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: '$amount' } } },
    ]),
    SalesOrder.countDocuments(orderFilter),
    SalesVisit.countDocuments(visitFilter),
    pageOf(SalesExpense, expenseFilter, { expenseDate: -1, createdAt: -1 }, expensesPage, limit, 'expenseDate amount note submittedByName'),
    pageOf(SalesOrder, orderFilter, { orderDate: -1, createdAt: -1 }, ordersPage, limit, 'orderNumber orderDate customerName address status items totalAmount createdBy', { path: 'createdBy', select: 'name email' }),
    pageOf(SalesVisit, visitFilter, { 'checkIn.at': -1, createdAt: -1 }, visitsPage, limit, 'placeName notes checkIn.at checkOut.at durationSeconds requirements user', { path: 'user', select: 'name email' }),
    SalesVisit.aggregate([
      { $match: visitFilter },
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
    SalesOrder.aggregate([
      { $match: orderFilter },
      { $group: { _id: '$createdBy', count: { $sum: 1 } } },
    ]),
    userId ? SalesVisit.aggregate([
      { $match: visitFilter },
      { $group: { _id: { $dateToString: { format: '%G-W%V', date: '$checkIn.at' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]) : Promise.resolve([]),
    userId ? SalesOrder.aggregate([
      { $match: orderFilter },
      { $group: { _id: { $dateToString: { format: '%G-W%V', date: '$orderDate' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]) : Promise.resolve([]),
    Promise.all([SalesStaff.distinct('user'), User.distinct('_id', { role: 'sales' })]),
    SalesExpense.distinct('submittedBy'),
    SalesOrder.distinct('createdBy'),
    SalesVisit.distinct('user'),
  ]);

  const employeeIds = new Map();
  for (const id of [...staffUserIds, ...salesRoleUserIds, ...expenseUserIds, ...orderUserIds, ...visitUserIds]) {
    employeeIds.set(String(id), id);
  }
  const employees = employeeIds.size
    ? await User.find({
      _id: { $in: [...employeeIds.values()] },
      role: { $nin: ['admin', 'manager'] },
    }).select('name email').sort({ name: 1 }).lean()
    : [];
  const expenseTotals = expenseSummary[0] || { count: 0, amount: 0 };
  const visitCountByUser = new Map(visitCounts.map(({ _id, count }) => [String(_id), count]));
  const orderCountByUser = new Map(orderCounts.map(({ _id, count }) => [String(_id), count]));
  const weeklyActivity = new Map();
  for (const { _id, count } of weeklyOrderCounts) {
    weeklyActivity.set(_id, { week: _id, orders: count, visits: 0 });
  }
  for (const { _id, count } of weeklyVisitCounts) {
    const activity = weeklyActivity.get(_id) || { week: _id, orders: 0, visits: 0 };
    activity.visits = count;
    weeklyActivity.set(_id, activity);
  }

  res.json({
    employees,
    summary: {
      expenses: { count: expenseTotals.count, amount: expenseTotals.amount },
      orders: { count: orderCount },
      visits: { count: visitCount },
    },
    activityByEmployee: employees.map((employee) => ({
      userId: String(employee._id),
      name: employee.name,
      visits: visitCountByUser.get(String(employee._id)) || 0,
      orders: orderCountByUser.get(String(employee._id)) || 0,
    })),
    activityByWeek: [...weeklyActivity.values()].sort((a, b) => a.week.localeCompare(b.week)),
    expenses,
    orders,
    visits,
  });
});

module.exports = { getOverview };
