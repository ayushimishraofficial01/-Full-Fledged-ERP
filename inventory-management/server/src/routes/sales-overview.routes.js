const router = require('express').Router();
const controller = require('../controllers/sales-overview.controller');
const { requireAdmin } = require('../middleware/authorization');
const validate = require('../middleware/validate');
const { salesOverviewQuery } = require('../validators/sales-overview.validators');

router.get('/', requireAdmin, validate(salesOverviewQuery, 'query'), controller.getOverview);

module.exports = router;
