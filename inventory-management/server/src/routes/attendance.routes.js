const router = require('express').Router();
const attendanceController = require('../controllers/attendance.controller');
const { requirePermission } = require('../middleware/authorization');
const { attendanceImage } = require('../middleware/upload');

router.get('/dashboard', requirePermission('hr.attendance.view'), attendanceController.getDashboard);
router.get('/my', requirePermission('hr.attendance.view'), attendanceController.getMyAttendance);
router.get('/employees', requirePermission('hr.attendance.view'), attendanceController.listEmployees);
router.get('/calendar', requirePermission('hr.attendance.view'), attendanceController.getCalendar);
router.get('/reports', requirePermission('hr.attendance.view'), attendanceController.getReports);
router.get('/reports/export', requirePermission('hr.attendance.view'), attendanceController.exportReports);
router.get('/settings', requirePermission('hr.attendance.view'), attendanceController.getSettings);
router.put('/settings', requirePermission('hr.attendance.edit'), attendanceController.updateSettings);
router.post('/check-in', requirePermission('hr.attendance.view'), attendanceImage, attendanceController.checkIn);
router.post('/check-out', requirePermission('hr.attendance.view'), attendanceImage, attendanceController.checkOut);
router.post('/manual', requirePermission('hr.attendance.edit'), attendanceController.createManualAttendance);
router.put('/:id', requirePermission('hr.attendance.edit'), attendanceController.updateAttendance);

module.exports = router;
