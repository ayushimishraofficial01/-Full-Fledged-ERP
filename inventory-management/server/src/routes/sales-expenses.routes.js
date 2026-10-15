const router = require('express').Router();
const controller = require('../controllers/sales-expenses.controller');
const { requirePermission } = require('../middleware/authorization');
const { salesExpenseReceipt } = require('../middleware/upload');
const validate = require('../middleware/validate');
const { createSalesExpense } = require('../validators/sales-expenses.validators');

router.get('/', requirePermission('sales_expenses.view'), controller.list);
router.post('/', requirePermission('sales_expenses.create'), salesExpenseReceipt, validate(createSalesExpense), controller.create);

module.exports = router;
