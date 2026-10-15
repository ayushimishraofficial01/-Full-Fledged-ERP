const { Role, AuditLog, User } = require('../models');
const { DEFAULT_ROLE_PERMISSIONS, PERMISSIONS, normalizeRole } = require('../config/permissions');
const ApiError = require('../utils/ApiError');

let defaultRolesPromise;

async function ensureDefaultRoles() {
  if (defaultRolesPromise) return defaultRolesPromise;
  defaultRolesPromise = Promise.all(Object.entries(DEFAULT_ROLE_PERMISSIONS).map(([role, permissions]) => Role.updateOne(
    { name: role.toUpperCase() },
    { $setOnInsert: { name: role.toUpperCase(), description: `${role.toUpperCase()} system role`, permissions, isSystemRole: true } },
    { upsert: true }
  ))).then(async () => {
    const dispatchPermissions = PERMISSIONS.filter((permission) => permission.startsWith('sample_dispatch.'));
    const salesVisitPermissions = PERMISSIONS.filter((permission) => permission.startsWith('sales_visits.'));
    const salesExpensePermissions = PERMISSIONS.filter((permission) => permission.startsWith('sales_expenses.'));
    const managerOrderPermissions = PERMISSIONS.filter((permission) => permission.startsWith('orders.'));
    const staffSalesPermissions = ['sales_expenses.view', 'sales_expenses.create', 'orders.view', 'orders.create', 'customers.lookup'];
    const billingPermissions = ['billing.view', 'billing.manage'];
    await Role.updateMany({}, { $pull: { permissions: 'hr.ai.use' } });
    await Role.updateOne(
      { name: { $in: ['USER', 'SALES'] }, isSystemRole: true },
      { $pullAll: { permissions: ['billing.view', 'billing.manage', 'stock.in', 'stock.out'] } }
    );
    const managerHrPermissions = [
      'hr.dashboard.view', 'hr.employees.view', 'hr.employees.edit',
      'hr.attendance.view', 'hr.attendance.edit', 'hr.leaves.view',
      'hr.leaves.apply', 'hr.reports.view',
    ];
    const employeeHrPermissions = [
      'hr.dashboard.view', 'hr.employees.view', 'hr.attendance.view',
      'hr.leaves.view', 'hr.leaves.apply',
    ];
    await Role.updateMany(
      { name: { $in: ['ADMIN', 'MANAGER'] }, isSystemRole: true },
      { $addToSet: { permissions: { $each: [...dispatchPermissions, ...salesVisitPermissions, ...salesExpensePermissions, ...managerOrderPermissions, ...staffSalesPermissions, ...billingPermissions] } } }
    );
    await Role.updateOne(
      { name: 'ADMIN', isSystemRole: true },
      { $addToSet: { permissions: 'sales_overview.view' } }
    );
    await Role.updateOne(
      { name: 'MANAGER', isSystemRole: true },
      { $addToSet: { permissions: { $each: managerHrPermissions } } }
    );
    await Role.updateOne(
      { name: 'USER', isSystemRole: true },
      { $addToSet: { permissions: { $each: ['sales_visits.track', ...employeeHrPermissions, ...staffSalesPermissions] } } }
    );
    await Role.updateOne(
      { name: 'SALES', isSystemRole: true },
      { $addToSet: { permissions: { $each: ['sales_visits.track', ...employeeHrPermissions, ...staffSalesPermissions] } } }
    );
  }).catch((error) => { defaultRolesPromise = null; throw error; });
  return defaultRolesPromise;
}

async function getRole(roleName) {
  const normalized = normalizeRole(roleName);
  await ensureDefaultRoles();
  const role = await Role.findOne({ name: normalized.toUpperCase() }).lean();
  return role || { name: normalized.toUpperCase(), permissions: DEFAULT_ROLE_PERMISSIONS[normalized] || [] };
}

async function attachAccess(user) {
  const role = await getRole(user.role);
  user._accessRole = role.name;
  user._accessPermissions = role.permissions;
  return user;
}

async function permissionsFor(user) {
  const role = await getRole(user.role);
  return { role: role.name, permissions: role.permissions || [] };
}

function can(user, permission) {
  const role = normalizeRole(user?.role);
  if (role === 'admin') return true;
  return (user?._accessPermissions || []).includes(permission);
}

function assertManageableActor(actor, target, nextRole) {
  const actorRole = normalizeRole(actor.role);
  const targetRole = normalizeRole(target.role);
  const desiredRole = normalizeRole(nextRole || target.role);
  if (targetRole === 'admin' && actorRole !== 'admin') throw ApiError.forbidden('Only an Admin can manage an Admin account.');
  if (desiredRole === 'admin' && actorRole !== 'admin') throw ApiError.forbidden('Only an Admin can assign the Admin role.');
  if (String(actor._id) === String(target._id) && desiredRole !== actorRole) throw ApiError.forbidden('You cannot change your own role.');
}

async function activeAdminCount() {
  return User.countDocuments({ role: 'admin', status: 'active' });
}

async function writeAudit(data) {
  return AuditLog.create(data);
}

module.exports = { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, normalizeRole, ensureDefaultRoles, getRole, attachAccess, permissionsFor, can, assertManageableActor, activeAdminCount, writeAudit };
