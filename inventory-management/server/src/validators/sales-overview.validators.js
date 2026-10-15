const { z, objectId } = require('./common');

const date = z.string().max(40).refine(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isNaN(Date.parse(value)),
  'Enter a valid date'
).optional();

const salesOverviewQuery = z.object({
  from: date,
  to: date,
  userId: objectId('Employee').optional(),
  expensesPage: z.coerce.number().int().min(1).default(1),
  ordersPage: z.coerce.number().int().min(1).default(1),
  visitsPage: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
}).refine((query) => !query.from || !query.to || query.from <= query.to, {
  message: 'Start date must be on or before end date',
  path: ['to'],
});

module.exports = { salesOverviewQuery };
