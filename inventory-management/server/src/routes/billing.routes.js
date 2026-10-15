const router = require('express').Router();
const controller = require('../controllers/billing.controller');
const { requirePermission } = require('../middleware/authorization');
const validate = require('../middleware/validate');
const { invoiceRecord, businessSettings } = require('../validators/billing.validators');

router.get('/settings', requirePermission('billing.view'), controller.getSettings);
router.put('/settings', requirePermission('billing.manage'), validate(businessSettings), controller.saveSettings);
router.get('/', requirePermission('billing.view'), controller.list);
router.post('/', requirePermission('billing.manage'), validate(invoiceRecord), controller.save);
router.delete('/:invoiceId', requirePermission('billing.manage'), controller.remove);

module.exports = router;
