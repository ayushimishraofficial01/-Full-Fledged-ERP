const router = require('express').Router();
const c = require('../controllers/production.controller');
const validate = require('../middleware/validate');
const { productionBody, productionTransferBody } = require('../validators/production.validators');
const { requirePermission } = require('../middleware/authorization');

router.get('/dashboard', requirePermission('production.view'), c.dashboard);
router.get('/stock', requirePermission('production.view'), c.stock);
router.get('/history', requirePermission('production.view'), c.history);
router.get('/transfers', requirePermission('production.view'), c.transfers);
router.get('/available/:productId', requirePermission('production.view'), c.available);
router.post('/', requirePermission('production.create'), validate(productionBody), c.add);
router.post('/transfer', requirePermission('production.transfer'), validate(productionTransferBody), c.transfer);

module.exports = router;
