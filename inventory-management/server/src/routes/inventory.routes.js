const router = require('express').Router();
const c = require('../controllers/inventory.controller');
const { requirePermission } = require('../middleware/authorization');

router.get('/', requirePermission('inventory.view'), c.list);
router.get('/low-stock', requirePermission('inventory.view'), c.lowStock);
router.get('/available', requirePermission('inventory.view'), c.available);
router.get('/warehouse/:warehouseId', requirePermission('inventory.view'), c.byWarehouse);
router.get('/product/:productId', requirePermission('inventory.view'), c.byProduct);

module.exports = router;
