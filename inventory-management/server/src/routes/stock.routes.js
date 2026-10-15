const router = require('express').Router();
const c = require('../controllers/stock.controller');
const v = require('../validators/stock.validators');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/authorization');

router.post('/in', requirePermission('stock.in'), validate(v.stockIn), c.stockIn);
router.post('/out', requirePermission('stock.out'), validate(v.stockOut), c.stockOut);
router.post('/transfer', requirePermission('stock.transfer'), validate(v.transfer), c.transfer);
router.get('/transactions', requirePermission('stock.history'), c.transactions);
router.get('/transfers', requirePermission('stock.history'), c.transfers);

module.exports = router;
