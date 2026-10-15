const router = require('express').Router();
const c = require('../controllers/settings.controller');
const validate = require('../middleware/validate');
const { requirePermission } = require('../middleware/authorization');

router.get('/', requirePermission('settings.view'), c.getSettings);
router.put('/', requirePermission('settings.edit'), validate(c.settingsSchema), c.updateSettings);

const unitRouter = require('express').Router();
unitRouter.get('/', requirePermission('settings.view'), c.listUnits);
unitRouter.post('/', requirePermission('settings.edit'), validate(c.unitSchema), c.createUnit);
unitRouter.patch('/:id/toggle', requirePermission('settings.edit'), c.toggleUnit);
unitRouter.delete('/:id', requirePermission('settings.edit'), c.deleteUnit);

module.exports = { settingsRouter: router, unitRouter };
