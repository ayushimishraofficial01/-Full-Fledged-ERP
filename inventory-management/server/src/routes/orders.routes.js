const router = require('express').Router();
const controller = require('../controllers/orders.controller');
const { requirePermission } = require('../middleware/authorization');
const validate = require('../middleware/validate');
const { createOrder, updateStatus } = require('../validators/orders.validators');

router.get('/', requirePermission('orders.view'), controller.list);
router.get('/options', requirePermission('orders.create'), controller.options);
router.post('/', requirePermission('orders.create'), validate(createOrder), controller.create);
router.patch('/:id/status', requirePermission('orders.edit'), validate(updateStatus), controller.updateStatus);

module.exports = router;
