const { z } = require('zod');
const { User, Role, AuditLog } = require('../models');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, normalizeRole, getRole, assertManageableActor, activeAdminCount, writeAudit, ensureDefaultRoles } = require('../services/access.service');
const { ensureSalesStaff, getOfficeSchedule, getOfficeSchedules, setOfficeSchedule } = require('../services/sales-staff.service');

const userBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(254),
  password: z.string().min(8).optional(),
  employeeId: z.string().trim().max(50).optional().default(''),
  role: z.string().trim().min(2).max(50).regex(/^[A-Za-z][A-Za-z0-9 _-]*$/).default('user'),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  officeSchedule: z.object({
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Office start time must use HH:MM'),
    endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Office end time must use HH:MM'),
    timezone: z.string().trim().min(1).max(64).refine((value) => {
      try {
        new Intl.DateTimeFormat('en-US', { timeZone: value });
        return true;
      } catch {
        return false;
      }
    }, 'Enter a valid IANA timezone'),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  }).refine((schedule) => schedule.startTime !== schedule.endTime, {
    message: 'Office start and end times must be different',
    path: ['endTime'],
  }).refine((schedule) => schedule.startTime < schedule.endTime, {
    message: 'Office hours must start before they end on the same day',
    path: ['endTime'],
  }).optional().nullable(),
});
const roleBody = z.object({ name: z.string().trim().min(2).max(50).regex(/^[A-Za-z][A-Za-z0-9 _-]*$/), description: z.string().trim().max(300).optional().default(''), permissions: z.array(z.string()).default([]) });

async function findUser(id) {
  const user = await User.findById(id);
  if (!user) throw ApiError.notFound('User not found');
  return user;
}

function assertPermissions(values) {
  const invalid = values.filter((permission) => !PERMISSIONS.includes(permission));
  if (invalid.length) throw ApiError.badRequest(`Unknown permission: ${invalid[0]}`);
}

exports.listUsers = asyncHandler(async (req, res) => {
  const users = await User.find().select('name email employeeId role status lastLoginAt createdAt').sort({ name: 1 }).lean();
  const schedules = await getOfficeSchedules(users.map((user) => user._id));
  users.forEach((user) => { user.officeSchedule = schedules.get(String(user._id)) || null; });
  res.json({ success: true, users });
});

exports.getUser = asyncHandler(async (req, res) => {
  const user = await findUser(req.params.id);
  res.json({ success: true, user: { ...user.toSafeJSON(), officeSchedule: await getOfficeSchedule(user._id) } });
});

exports.createUser = asyncHandler(async (req, res) => {
  const input = userBody.parse(req.body);
  if (!input.password) throw ApiError.badRequest('Password is required', [{ field: 'password', message: 'Password is required' }]);
  const desiredRole = normalizeRole(input.role);
  await ensureDefaultRoles();
  if (!await Role.exists({ name: desiredRole.toUpperCase() })) throw ApiError.badRequest('Select an existing role before creating this user.');
  if (desiredRole === 'admin' && req.user.role !== 'admin') throw ApiError.forbidden('Only an Admin can create an Admin account.');
  if (await User.exists({ email: input.email })) throw ApiError.conflict('An account with this email already exists.');
  if (input.employeeId && await User.exists({ employeeId: input.employeeId })) throw ApiError.conflict('This Employee ID is already in use.');
  const { officeSchedule, ...userInput } = input;
  const user = await User.create({ ...userInput, role: desiredRole });
  if (officeSchedule) await setOfficeSchedule(user._id, officeSchedule);
  else if (desiredRole === 'sales') await ensureSalesStaff(user._id);
  await writeAudit({ actor: req.user._id, action: 'USER_CREATED', targetUser: user._id, newRole: desiredRole, ip: req.ip });
  res.status(201).json({ success: true, message: 'User created', user: { ...user.toSafeJSON(), officeSchedule: officeSchedule || null } });
});

exports.updateUser = asyncHandler(async (req, res) => {
  const target = await findUser(req.params.id);
  const input = userBody.partial().parse(req.body);
  const nextRole = input.role === undefined ? target.role : normalizeRole(input.role);
  if (input.role !== undefined) {
    await ensureDefaultRoles();
    if (!await Role.exists({ name: nextRole.toUpperCase() })) throw ApiError.badRequest('Select an existing role before updating this user.');
  }
  assertManageableActor(req.user, target, nextRole);
  if (target.status === 'active' && input.status && input.status !== 'active' && normalizeRole(target.role) === 'admin' && await activeAdminCount() <= 1) {
    throw ApiError.badRequest('At least one active Admin account must remain.');
  }
  const oldRole = target.role;
  const { officeSchedule, ...userInput } = input;
  Object.assign(target, userInput, { role: nextRole, updatedBy: req.user._id });
  await target.save();
  if (officeSchedule !== undefined) await setOfficeSchedule(target._id, officeSchedule);
  else if (nextRole === 'sales') await ensureSalesStaff(target._id);
  if (oldRole !== target.role) await writeAudit({ actor: req.user._id, action: 'USER_ROLE_CHANGED', targetUser: target._id, oldRole, newRole: target.role, ip: req.ip });
  const schedule = officeSchedule === undefined ? await getOfficeSchedule(target._id) : officeSchedule;
  res.json({ success: true, message: 'User updated', user: { ...target.toSafeJSON(), officeSchedule: schedule || null } });
});

exports.updateStatus = asyncHandler(async (req, res) => {
  const target = await findUser(req.params.id);
  const status = z.enum(['active', 'inactive', 'suspended']).parse(req.body.status);
  assertManageableActor(req.user, target);
  if (normalizeRole(target.role) === 'admin' && status !== 'active' && await activeAdminCount() <= 1) throw ApiError.badRequest('At least one active Admin account must remain.');
  target.status = status;
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  await target.save();
  await writeAudit({ actor: req.user._id, action: 'USER_STATUS_CHANGED', targetUser: target._id, metadata: { status }, ip: req.ip });
  res.json({ success: true, message: `User ${status}`, user: target.toSafeJSON() });
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const target = await findUser(req.params.id);
  assertManageableActor(req.user, target);
  const password = z.string().min(8).parse(req.body.password);
  target.password = password;
  target.tokenVersion = (target.tokenVersion || 0) + 1;
  await target.save();
  await writeAudit({ actor: req.user._id, action: 'USER_PASSWORD_RESET', targetUser: target._id, ip: req.ip });
  res.json({ success: true, message: 'Password reset successfully' });
});

exports.listRoles = asyncHandler(async (req, res) => {
  await ensureDefaultRoles();
  const [roles, counts] = await Promise.all([Role.find().sort({ isSystemRole: -1, name: 1 }).lean(), User.aggregate([{ $group: { _id: '$role', users: { $sum: 1 } } }])]);
  const countMap = new Map(counts.map((row) => [row._id, row.users]));
  res.json({ success: true, roles: roles.map((role) => ({ ...role, users: countMap.get(role.name.toLowerCase()) || 0 })) });
});

exports.getPermissions = asyncHandler(async (req, res) => {
  res.json({ success: true, permissions: PERMISSIONS, defaults: DEFAULT_ROLE_PERMISSIONS });
});

exports.updateRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.name === 'ADMIN' && req.user.role !== 'admin') throw ApiError.forbidden('Only an Admin can change Admin permissions.');
  const input = roleBody.partial().parse(req.body);
  if (input.permissions) assertPermissions(input.permissions);
  const oldPermissions = role.permissions;
  Object.assign(role, input, { updatedBy: req.user._id });
  await role.save();
  await writeAudit({ actor: req.user._id, action: 'ROLE_PERMISSIONS_CHANGED', targetRole: role._id, oldPermissions, newPermissions: role.permissions, ip: req.ip });
  res.json({ success: true, message: 'Role permissions updated', role });
});

exports.createRole = asyncHandler(async (req, res) => {
  const input = roleBody.parse(req.body);
  assertPermissions(input.permissions);
  const name = input.name.toUpperCase();
  if (name === 'STAFF') throw ApiError.badRequest('STAFF is a reserved alias for the USER role.');
  if (await Role.exists({ name })) throw ApiError.conflict('A role with this name already exists.');
  const role = await Role.create({ ...input, name, createdBy: req.user._id, updatedBy: req.user._id });
  await writeAudit({ actor: req.user._id, action: 'ROLE_CREATED', targetRole: role._id, newPermissions: role.permissions, ip: req.ip });
  res.status(201).json({ success: true, message: 'Role created', role });
});

exports.deleteRole = asyncHandler(async (req, res) => {
  const role = await Role.findById(req.params.id);
  if (!role) throw ApiError.notFound('Role not found');
  if (role.isSystemRole) throw ApiError.badRequest('System roles cannot be deleted.');
  if (await User.exists({ role: role.name.toLowerCase() })) throw ApiError.conflict('This role is assigned to users. Reassign them before deleting.');
  await role.deleteOne();
  await writeAudit({ actor: req.user._id, action: 'ROLE_DELETED', targetRole: role._id, ip: req.ip });
  res.json({ success: true, message: 'Role deleted' });
});

exports.auditLogs = asyncHandler(async (req, res) => {
  const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(200).populate('actor', 'name email').populate('targetUser', 'name email').populate('targetRole', 'name').lean();
  res.json({ success: true, logs });
});

exports.schemas = { userBody, roleBody };
