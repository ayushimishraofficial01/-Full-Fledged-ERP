const router = require('express').Router();
const c = require('../controllers/report.controller');
const { requirePermission } = require('../middleware/authorization');

router.get('/inventory', requirePermission('reports.view'), c.inventory);
router.get('/stock-in', requirePermission('reports.view'), c.stockIn);
router.get('/stock-out', requirePermission('reports.view'), c.stockOut);
router.get('/transfers', requirePermission('reports.view'), c.transfers);

module.exports = router;
