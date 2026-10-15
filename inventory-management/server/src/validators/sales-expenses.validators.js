const { z, numeric, requiredText, dateInput } = require('./common');

const createSalesExpense = z.object({
  expenseDate: dateInput,
  amount: numeric('Expense amount')
    .refine((value) => value > 0, 'Expense amount must be greater than 0')
    .refine((value) => value <= 1e12, 'Expense amount is too large')
    .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6, 'Expense amount can have at most 2 decimal places'),
  note: requiredText('Notes', 1000),
});

module.exports = { createSalesExpense };
