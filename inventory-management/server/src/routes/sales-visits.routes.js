const router = require('express').Router();
const controller = require('../controllers/sales-visits.controller');
const { requirePermission } = require('../middleware/authorization');
const { salesVisitImage, removeSalesVisitEvidence } = require('../middleware/upload');
const { startShift, locationPing, checkIn, checkOut } = require('../validators/sales-visits.validators');

function validateBody(schema, removePhotoOnFailure = false) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) {
      if (removePhotoOnFailure && req.file) removeSalesVisitEvidence(req.file.filename);
      return next(result.error);
    }
    req.body = result.data;
    next();
  };
}

router.get('/current', requirePermission('sales_visits.track'), controller.current);
router.post('/shifts/start', requirePermission('sales_visits.track'), validateBody(startShift), controller.startShift);
router.post('/shifts/location', requirePermission('sales_visits.track'), validateBody(locationPing), controller.recordLocation);
router.post('/shifts/end', requirePermission('sales_visits.track'), validateBody(locationPing), controller.endShift);
router.get('/history', requirePermission('sales_visits.track'), controller.history);
router.get('/products', requirePermission('sales_visits.track'), controller.productCatalog);
router.get('/team', requirePermission('sales_visits.view'), controller.team);
router.post('/visits/check-in', requirePermission('sales_visits.track'), validateBody(checkIn), controller.checkIn);
router.get('/visits/:id/photo', controller.photo);
router.post('/visits/:id/check-out', requirePermission('sales_visits.track'), salesVisitImage, validateBody(checkOut, true), controller.checkOut);

router.use((err, req, res, next) => {
  if (req.file) removeSalesVisitEvidence(req.file.filename);
  next(err);
});

module.exports = router;
