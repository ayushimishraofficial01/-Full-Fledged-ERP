const router = require('express').Router();
const mongoose = require('mongoose');
const { protect } = require('../middleware/auth');
const { importRouter, exportRouter } = require('./excel.routes');
const { settingsRouter, unitRouter } = require('./settings.routes');
const dashboard = require('../controllers/dashboard.controller');
const { requirePermission } = require('../middleware/authorization');

router.get('/health', (req, res) => {
  res.json({ success: true, status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

router.use('/auth', require('./auth.routes'));

// Everything below requires authentication.
router.use(protect);
router.get('/dashboard/summary', requirePermission('dashboard.view'), dashboard.summary);
router.use('/products', require('./product.routes'));
router.use('/warehouses', require('./warehouse.routes'));
router.use('/inventory', require('./inventory.routes'));
router.use('/stock', require('./stock.routes'));
router.use('/production', require('./production.routes'));
router.use('/reports', require('./report.routes'));
router.use('/import', importRouter);
router.use('/export', exportRouter);
router.use('/units', unitRouter);
router.use('/settings', settingsRouter);
router.use('/access', require('./access.routes'));
router.use('/crm', require('./crm.routes'));
router.use('/sales-visits', require('./sales-visits.routes'));
router.use('/sales-expenses', require('./sales-expenses.routes'));
router.use('/billing', require('./billing.routes'));
router.use('/sales-overview', require('./sales-overview.routes'));
router.use('/orders', require('./orders.routes'));
router.use('/attendance', require('./attendance.routes'));
router.use('/hr', require('./hr.routes'));

module.exports = router;
