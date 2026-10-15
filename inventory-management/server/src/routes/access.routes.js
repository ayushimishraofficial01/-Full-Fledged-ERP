const router = require('express').Router();
const c = require('../controllers/access.controller');
const validate = require('../middleware/validate');
const { requirePermission, requireAdmin } = require('../middleware/authorization');

router.get('/users', requirePermission('users.view'), c.listUsers);
router.get('/users/:id', requirePermission('users.view'), c.getUser);
router.post('/users', requirePermission('users.create'), c.createUser);
router.put('/users/:id', requirePermission('users.edit'), c.updateUser);
router.patch('/users/:id/status', requirePermission('users.disable'), c.updateStatus);
router.patch('/users/:id/password', requirePermission('users.edit'), c.resetPassword);

router.get('/roles', requirePermission('roles.view'), c.listRoles);
router.get('/permissions', requirePermission('roles.view'), c.getPermissions);
router.post('/roles', requirePermission('roles.create'), c.createRole);
router.put('/roles/:id', requirePermission('roles.edit'), c.updateRole);
router.delete('/roles/:id', requirePermission('roles.delete'), c.deleteRole);
router.get('/audit-logs', requirePermission('audit.view'), c.auditLogs);

module.exports = router;
