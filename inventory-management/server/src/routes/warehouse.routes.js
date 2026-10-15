const router = require('express').Router();
const c = require('../controllers/warehouse.controller');
const { warehouseBody } = require('../validators/warehouse.validators');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/authorization');

router.get('/', requirePermission('warehouses.view'), c.list);
router.get('/:id', requirePermission('warehouses.view'), c.get);
router.post('/', requirePermission('warehouses.create'), validate(warehouseBody), c.create);
router.put('/:id', requirePermission('warehouses.edit'), validate(warehouseBody), c.update);
router.delete('/:id', requirePermission('warehouses.delete'), c.remove);
router.patch('/:id/restore', c.restore);

module.exports = router;
