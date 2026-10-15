const router = require('express').Router();
const controller = require('../controllers/hr.controller');
const { requirePermission } = require('../middleware/authorization');
const { hrDocument, hrProfilePhoto } = require('../middleware/upload');

router.get('/dashboard', requirePermission('hr.dashboard.view'), controller.dashboard);
router.get('/notifications', requirePermission('hr.dashboard.view'), controller.notifications);
router.patch('/notifications/:id/read', requirePermission('hr.dashboard.view'), controller.markNotificationRead);

router.get('/employees', requirePermission('hr.employees.view'), controller.employees);
router.post('/employees', requirePermission('hr.employees.create'), controller.createEmployee);
router.get('/employees/:userId', requirePermission('hr.employees.view'), controller.getEmployee);
router.put('/employees/:userId', requirePermission('hr.employees.edit'), controller.updateEmployee);
router.get('/employees/:userId/documents', requirePermission('hr.employees.view'), controller.employeeDocuments);
router.post('/employees/:userId/documents', requirePermission('hr.employees.view'), hrDocument, controller.uploadEmployeeDocument);
router.get('/employees/:userId/documents/:documentId', requirePermission('hr.employees.view'), controller.downloadEmployeeDocument);
router.get('/employees/:userId/photo', requirePermission('hr.employees.view'), controller.employeePhoto);
router.post('/employees/:userId/photo', requirePermission('hr.employees.view'), hrProfilePhoto, controller.uploadEmployeePhoto);

router.get('/departments', requirePermission('hr.employees.view'), controller.departments);
router.post('/departments', requirePermission('hr.departments.manage'), controller.createDepartment);
router.put('/departments/:id', requirePermission('hr.departments.manage'), controller.updateDepartment);

router.get('/leaves', requirePermission('hr.leaves.view'), controller.leaves);
router.post('/leaves', requirePermission('hr.leaves.apply', 'hr.leaves.approve'), controller.createLeave);
router.put('/leaves/:id/review', requirePermission('hr.leaves.approve'), controller.reviewLeave);
router.get('/leaves/types', requirePermission('hr.leaves.view'), controller.leaveTypes);
router.post('/leaves/types', requirePermission('hr.leaves.approve'), controller.createLeaveType);
router.put('/leaves/types/:id', requirePermission('hr.leaves.approve'), controller.updateLeaveType);
router.delete('/leaves/types/:id', requirePermission('hr.leaves.approve'), controller.deactivateLeaveType);

router.get('/payroll', requirePermission('hr.payroll.view'), controller.payroll);
router.post('/payroll', requirePermission('hr.payroll.manage'), controller.createPayroll);
router.put('/payroll/:id/approve', requirePermission('hr.payroll.manage'), controller.approvePayroll);
router.get('/payroll/:id/slip.pdf', requirePermission('hr.payroll.view'), controller.salarySlip);
router.get('/payroll/:id/salary-slips', requirePermission('hr.payroll.view'), controller.salarySlip);

router.get('/reports', requirePermission('hr.reports.view'), controller.reports);
router.get('/reports/export.pdf', requirePermission('hr.reports.view'), controller.exportReportPdf);
router.get('/reports/export', requirePermission('hr.reports.view'), controller.exportReports);

module.exports = router;
