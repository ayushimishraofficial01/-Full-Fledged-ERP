const mongoose = require('mongoose');
const {
  User, Department, Attendance, LeaveType, LeaveRequest, LeaveBalance,
  SalaryStructure, PayrollRun, AuditLog, EmployeeDocument, HRNotification, Setting,
} = require('../models');
const ApiError = require('../utils/ApiError');
const { can, normalizeRole } = require('./access.service');
const { privateDocumentPath } = require('../middleware/upload');
const { sendMail, isEmailConfigured } = require('./email.service');
const fs = require('fs');
const path = require('path');

const USER_FIELDS = 'name email phone role status department departmentRef employeeId jobTitle designation employmentType dateOfJoining joiningDate dateOfExit manager reportingManager workLocation branch emergencyContact dateOfBirth address profilePhoto salaryCurrency salaryStructure lastLoginAt createdAt updatedAt';
const DEFAULT_LEAVE_TYPES = [
  { name: 'Annual Leave', code: 'ANNUAL', annualAllowance: 20, isPaid: true },
  { name: 'Sick Leave', code: 'SICK', annualAllowance: 10, isPaid: true },
  { name: 'Casual Leave', code: 'CASUAL', annualAllowance: 10, isPaid: true },
  { name: 'Paid Leave', code: 'PAID', annualAllowance: 15, isPaid: true },
  { name: 'Earned Leave', code: 'EARNED', annualAllowance: 15, isPaid: true },
  { name: 'Unpaid Leave', code: 'UNPAID', annualAllowance: 30, isPaid: false },
];

function objectId(value, label = 'id') {
  if (!mongoose.isValidObjectId(value)) throw ApiError.badRequest(`Invalid ${label}.`);
  return new mongoose.Types.ObjectId(String(value));
}

function parseDate(value, label = 'date') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw ApiError.badRequest(`${label} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw ApiError.badRequest(`${label} is invalid.`);
  }
  return parsed;
}

function toAttendanceDay(value) {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

function localTodayAsUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function toAttendanceEndOfDay(value) {
  const date = new Date(value);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999);
}

function dateRange(fromValue, toValue, defaultFrom, defaultTo) {
  const from = fromValue ? parseDate(fromValue, 'fromDate') : defaultFrom;
  const toStart = toValue ? parseDate(toValue, 'toDate') : defaultTo;
  if (from > toStart) throw ApiError.badRequest('fromDate must be on or before toDate.');
  const to = new Date(toStart);
  to.setUTCHours(23, 59, 59, 999);
  return { from, to };
}

function toEmployee(user, includeSalary = false) {
  const row = typeof user.toObject === 'function' ? user.toObject() : user;
  return {
    _id: row._id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    status: row.status,
    lastLoginAt: row.lastLoginAt || null,
    createdAt: row.createdAt || null,
    updatedAt: row.updatedAt || null,
    department: row.department || 'General',
    departmentRef: row.departmentRef || null,
    employeeId: row.employeeId || '',
    jobTitle: row.jobTitle || '',
    designation: row.designation || row.jobTitle || '',
    employmentType: row.employmentType || 'full_time',
    dateOfJoining: row.dateOfJoining || null,
    joiningDate: row.joiningDate || row.dateOfJoining || null,
    dateOfExit: row.dateOfExit || null,
    manager: row.manager || row.reportingManager || null,
    reportingManager: row.reportingManager || row.manager || null,
    workLocation: row.workLocation || '',
    branch: row.branch || row.workLocation || '',
    emergencyContact: row.emergencyContact || '',
    dateOfBirth: row.dateOfBirth || null,
    address: row.address || '',
    profilePhoto: row.profilePhoto || '',
    salaryStructure: includeSalary ? (row.salaryStructure || {
      basicSalary: 0, hra: 0, allowances: 0, bonus: 0, overtimeRate: 0, deductions: 0,
    }) : null,
    salaryCurrency: row.salaryCurrency || 'INR',
  };
}

function userScope(actor) {
  const role = normalizeRole(actor.role);
  if (role === 'admin') return {};
  if (role === 'manager') {
    return {
      role: { $ne: 'admin' },
      $or: [{ _id: actor._id }, { manager: actor._id }, { reportingManager: actor._id }],
    };
  }
  return { _id: actor._id };
}

async function assertCanAccessEmployee(actor, employeeId) {
  const targetId = objectId(employeeId, 'employee id');
  const target = await User.findById(targetId).select(USER_FIELDS);
  if (!target) throw ApiError.notFound('Employee not found.');
  const role = normalizeRole(actor.role);
  if (normalizeRole(target.role) === 'admin' && role !== 'admin' && String(actor._id) !== String(target._id)) {
    throw ApiError.forbidden('Only an Admin may access an Admin employee profile.');
  }
  const allowed = role === 'admin' ||
    String(actor._id) === String(target._id) ||
    (role === 'manager' && (
      String(target.manager || '') === String(actor._id) ||
      String(target.reportingManager || '') === String(actor._id)
    ));
  if (!allowed) throw ApiError.forbidden('You may only access your own profile or a direct report.');
  return target;
}

async function audit(actor, action, req, data = {}) {
  const entry = {
    actor: actor._id,
    action,
    ip: req.ip || '',
    metadata: data.metadata || {},
  };
  if (data.targetUser) entry.targetUser = data.targetUser;
  await AuditLog.create(entry);
}

async function notifyUsers(recipients, actor, type, message, relatedId = null) {
  const recipientIds = [...new Set(recipients.filter(Boolean).map(String).filter((id) => id !== String(actor?._id)))];
  if (!recipientIds.length) return;
  const notifications = await HRNotification.insertMany(recipientIds.map((recipient) => ({
    recipient, actor: actor?._id || null, type, message, relatedId,
    emailStatus: isEmailConfigured() ? 'pending' : 'not_configured',
  })));
  if (!isEmailConfigured()) return;
  const users = await User.find({ _id: { $in: recipientIds } }).select('_id name email').lean();
  const byId = new Map(users.map((user) => [String(user._id), user]));
  await Promise.all(notifications.map(async (notification) => {
    const recipient = byId.get(String(notification.recipient));
    try {
      if (!recipient?.email) throw new Error('Notification recipient has no email address.');
      await sendMail({
        to: recipient.email,
        subject: 'Gen Vyro HR notification',
        text: `Hi ${recipient.name},\n\n${message}`,
      });
      notification.emailStatus = 'delivered';
    } catch (error) {
      notification.emailStatus = 'failed';
      console.error(`Unable to deliver HR notification ${notification._id}:`, error);
    }
    await notification.save();
  }));
}

async function listNotifications(actor) {
  const notifications = await HRNotification.find({ recipient: actor._id })
    .sort({ createdAt: -1 }).limit(50).lean();
  return { notifications };
}

async function markNotificationRead(actor, notificationId) {
  const notification = await HRNotification.findOneAndUpdate(
    { _id: objectId(notificationId, 'notification id'), recipient: actor._id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true }
  ).lean();
  if (!notification) {
    const existing = await HRNotification.exists({ _id: objectId(notificationId, 'notification id'), recipient: actor._id });
    if (!existing) throw ApiError.notFound('Notification not found.');
    return { success: true };
  }
  return { success: true };
}

async function ensureDefaultLeaveTypes() {
  await Promise.all(DEFAULT_LEAVE_TYPES.map(({ name, code, annualAllowance, isPaid }) =>
    LeaveType.updateOne(
      { code },
      { $setOnInsert: { name, code, annualAllowance, isPaid, isActive: true } },
      { upsert: true }
    )
  ));
  return LeaveType.find({ isActive: true }).sort({ name: 1 }).lean();
}

async function getVisibleEmployeeIds(actor) {
  const users = await User.find(userScope(actor)).select('_id').lean();
  return users.map((user) => user._id);
}

function validManagerId(value) {
  return value == null || value === '' ? null : objectId(value, 'manager id');
}

async function validateDepartment(departmentId) {
  if (!departmentId) return null;
  const department = await Department.findOne({ _id: objectId(departmentId, 'department id'), isActive: true });
  if (!department) throw ApiError.badRequest('Select an active department.');
  return department;
}

async function validateManager(managerId, employeeId = null) {
  if (!managerId) return null;
  const manager = await User.findOne({ _id: managerId, status: 'active' }).select('_id role');
  if (!manager) throw ApiError.badRequest('Select an active manager.');
  if (employeeId && String(manager._id) === String(employeeId)) {
    throw ApiError.badRequest('An employee cannot be their own manager.');
  }
  return manager;
}

async function syncSalaryStructure(user, input, actorId) {
  const components = [
    { name: 'HRA', amount: input.hra, kind: 'earning' },
    { name: 'Allowances', amount: input.allowances, kind: 'earning' },
    { name: 'Bonus', amount: input.bonus, kind: 'earning' },
    { name: 'Deductions', amount: input.deductions, kind: 'deduction' },
  ].filter((component) => Number(component.amount) > 0);
  const existing = await SalaryStructure.findOne({ employee: user._id }).select('effectiveFrom').lean();
  await SalaryStructure.findOneAndUpdate(
    { employee: user._id },
    {
      $set: {
        baseSalary: input.basicSalary,
        overtimeRate: input.overtimeRate || 0,
        currency: user.salaryCurrency || 'INR',
        components,
        effectiveFrom: existing?.effectiveFrom || user.joiningDate || user.dateOfJoining || new Date(),
        updatedBy: actorId,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
}

async function listEmployees(actor, query) {
  const filter = { ...userScope(actor) };
  if (query.departmentId) filter.departmentRef = objectId(query.departmentId, 'department id');
  if (query.status) {
    if (!['active', 'inactive', 'suspended'].includes(query.status)) {
      throw ApiError.badRequest('status must be active, inactive, or suspended.');
    }
    filter.status = query.status;
  }
  if (query.search) {
    const search = String(query.search).trim().slice(0, 80);
    if (search) {
      const pattern = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$and = [...(filter.$and || []), { $or: [{ name: pattern }, { email: pattern }, { employeeId: pattern }] }];
    }
  }
  const users = await User.find(filter).select(USER_FIELDS).sort({ name: 1 }).lean();
  const ids = users.map((user) => user._id);
  let rows = [];
  if (ids.length && can(actor, 'hr.attendance.view')) {
    const attendanceFilter = { employee: { $in: ids } };
    if (query.fromDate || query.toDate) {
      const { from, to } = dateRange(query.fromDate, query.toDate, new Date(0), localTodayAsUtcDate());
      attendanceFilter.date = { $gte: toAttendanceDay(from), $lte: toAttendanceEndOfDay(to) };
    }
    rows = await Attendance.find(attendanceFilter)
      .select('employee date checkInTime checkOutTime workingHoursMinutes overtimeMinutes lateMinutes status')
      .sort({ date: -1 })
      .limit(5000)
      .lean();
  }
  return { users: users.map((user) => toEmployee(user, can(actor, 'hr.payroll.view'))), rows };
}

async function getEmployee(actor, employeeId) {
  const target = await assertCanAccessEmployee(actor, employeeId);
  const [rows, leaves, payroll, activity] = await Promise.all([
    can(actor, 'hr.attendance.view')
      ? Attendance.find({ employee: target._id })
        .select('employee date checkInTime checkOutTime workingHoursMinutes overtimeMinutes lateMinutes status')
        .sort({ date: -1 }).limit(365).lean()
      : [],
    can(actor, 'hr.leaves.view')
      ? LeaveRequest.find({ employee: target._id }).populate('leaveType', 'name code')
        .sort({ startDate: -1 }).limit(100).lean()
      : [],
    can(actor, 'hr.payroll.view')
      ? PayrollRun.find({ employee: target._id }).sort({ period: -1 }).limit(24).lean()
      : [],
    AuditLog.find({ targetUser: target._id }).select('actor action metadata createdAt')
      .populate('actor', 'name').sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  return {
    users: [toEmployee(target, can(actor, 'hr.payroll.view'))],
    rows,
    leaves,
    payroll: payroll.map(runRow),
    activity,
  };
}

function documentRow(document) {
  return {
    _id: document._id,
    employee: document.employee,
    uploadedBy: document.uploadedBy,
    originalName: document.originalName,
    mimeType: document.mimeType,
    size: document.size,
    createdAt: document.createdAt,
  };
}

async function listEmployeeDocuments(actor, employeeId) {
  const target = await assertCanAccessEmployee(actor, employeeId);
  const documents = await EmployeeDocument.find({ employee: target._id })
    .where('category').ne('profile_photo')
    .select('employee uploadedBy originalName mimeType size createdAt')
    .sort({ createdAt: -1 }).limit(100).lean();
  return { documents: documents.map(documentRow) };
}

async function uploadEmployeeDocument(actor, employeeId, file, req) {
  let target;
  try {
    target = await assertCanAccessEmployee(actor, employeeId);
    if (String(target._id) !== String(actor._id) && !can(actor, 'hr.employees.edit')) {
      throw ApiError.forbidden('You may upload documents only to your own profile.');
    }
    const document = await EmployeeDocument.create({
      employee: target._id,
      uploadedBy: actor._id,
      originalName: path.basename(file.originalname).slice(0, 180),
      storageName: path.basename(file.filename),
      mimeType: file.mimetype,
      size: file.size,
    });
    await audit(actor, 'HR_EMPLOYEE_DOCUMENT_UPLOADED', req, {
      targetUser: target._id,
      metadata: { documentId: String(document._id), mimeType: document.mimeType, size: document.size },
    });
    return { document: documentRow(document) };
  } catch (error) {
    await fs.promises.unlink(file.path).catch(() => {});
    throw error;
  }
}

async function uploadEmployeePhoto(actor, employeeId, file, req) {
  let target;
  try {
    target = await assertCanAccessEmployee(actor, employeeId);
    if (String(target._id) !== String(actor._id) && !can(actor, 'hr.employees.edit')) {
      throw ApiError.forbidden('You may upload a profile photo only to your own profile.');
    }
    const document = await EmployeeDocument.create({
      employee: target._id,
      uploadedBy: actor._id,
      category: 'profile_photo',
      originalName: path.basename(file.originalname).slice(0, 180),
      storageName: path.basename(file.filename),
      mimeType: file.mimetype,
      size: file.size,
    });
    target.profilePhoto = `/api/hr/employees/${target._id}/photo`;
    await target.save();
    await audit(actor, 'HR_EMPLOYEE_PHOTO_UPDATED', req, {
      targetUser: target._id,
      metadata: { documentId: String(document._id), mimeType: document.mimeType, size: document.size },
    });
    return { profilePhoto: target.profilePhoto };
  } catch (error) {
    await fs.promises.unlink(file.path).catch(() => {});
    throw error;
  }
}

async function getEmployeePhoto(actor, employeeId) {
  const target = await assertCanAccessEmployee(actor, employeeId);
  const document = await EmployeeDocument.findOne({ employee: target._id, category: 'profile_photo' })
    .sort({ createdAt: -1 }).lean();
  if (!document) throw ApiError.notFound('Employee profile photo not found.');
  const filePath = privateDocumentPath(document.storageName);
  if (!filePath || !fs.existsSync(filePath)) throw ApiError.notFound('Employee profile photo file is unavailable.');
  return { document: documentRow(document), filePath };
}

async function getEmployeeDocument(actor, employeeId, documentId) {
  const target = await assertCanAccessEmployee(actor, employeeId);
  const document = await EmployeeDocument.findOne({ _id: objectId(documentId, 'document id'), employee: target._id }).lean();
  if (!document) throw ApiError.notFound('Employee document not found.');
  const filePath = privateDocumentPath(document.storageName);
  if (!filePath || !fs.existsSync(filePath)) throw ApiError.notFound('Employee document file is unavailable.');
  return { document: documentRow(document), filePath };
}

async function createEmployee(actor, input, req) {
  if (input.role === 'admin' && normalizeRole(actor.role) !== 'admin') {
    throw ApiError.forbidden('Only an Admin can create an Admin account.');
  }
  const hasSalaryInput = input.salaryStructure && Object.values(input.salaryStructure).some((amount) => Number(amount) > 0);
  if (hasSalaryInput && !can(actor, 'hr.payroll.manage')) {
    throw ApiError.forbidden('You do not have permission to configure salary information.');
  }
  if (await User.exists({ email: input.email.toLowerCase() })) {
    throw ApiError.conflict('An account with this email already exists.');
  }
  const department = await validateDepartment(input.departmentId);
  const requestedManager = input.reportingManager ?? input.managerId;
  let managerId = validManagerId(requestedManager);
  if (normalizeRole(actor.role) === 'manager') {
    if (managerId && String(managerId) !== String(actor._id)) {
      throw ApiError.forbidden('Managers may only create direct reports.');
    }
    managerId = managerId || actor._id;
  }
  await validateManager(managerId);
  const user = await User.create({
    name: input.name,
    email: input.email,
    password: input.password,
    phone: input.phone || undefined,
    role: input.role || 'user',
    status: input.status || 'active',
    department: department?.name || input.department || 'General',
    departmentRef: department?._id || null,
    employeeId: input.employeeId || '',
    jobTitle: input.jobTitle || '',
    designation: input.designation || input.jobTitle || '',
    employmentType: input.employmentType || 'full_time',
    dateOfJoining: input.joiningDate ? parseDate(input.joiningDate, 'joiningDate') : (input.dateOfJoining ? parseDate(input.dateOfJoining, 'dateOfJoining') : null),
    joiningDate: input.joiningDate ? parseDate(input.joiningDate, 'joiningDate') : (input.dateOfJoining ? parseDate(input.dateOfJoining, 'dateOfJoining') : null),
    manager: managerId,
    reportingManager: managerId,
    workLocation: input.branch || input.workLocation || '',
    branch: input.branch || input.workLocation || '',
    emergencyContact: input.emergencyContact || '',
    dateOfBirth: input.dateOfBirth ? parseDate(input.dateOfBirth, 'dateOfBirth') : null,
    address: input.address || '',
    profilePhoto: input.profilePhoto || '',
    salaryCurrency: input.salaryCurrency || 'INR',
    ...(input.salaryStructure && can(actor, 'hr.payroll.manage') ? { salaryStructure: {
      basicSalary: 0, hra: 0, allowances: 0, bonus: 0, overtimeRate: 0, deductions: 0, ...input.salaryStructure,
    } } : {}),
  });
  if (input.salaryStructure && can(actor, 'hr.payroll.manage')) await syncSalaryStructure(user, user.salaryStructure, actor._id);
  await audit(actor, 'HR_EMPLOYEE_CREATED', req, { targetUser: user._id, metadata: { employeeId: user.employeeId, department: user.department } });
  return { users: [toEmployee(user, can(actor, 'hr.payroll.view'))], rows: [] };
}

async function updateEmployee(actor, employeeId, input, req) {
  const target = await assertCanAccessEmployee(actor, employeeId);
  const role = normalizeRole(actor.role);
  if (normalizeRole(target.role) === 'admin' && role !== 'admin') {
    throw ApiError.forbidden('Only an Admin can manage an Admin employee profile.');
  }
  if (role !== 'admin' && String(target.manager || '') !== String(actor._id) &&
    String(target.reportingManager || '') !== String(actor._id)) {
    throw ApiError.forbidden('Only an Admin or the employee’s direct manager may edit this profile.');
  }
  const mutable = ['name', 'phone', 'employeeId', 'jobTitle', 'employmentType', 'workLocation', 'salaryCurrency', 'emergencyContact', 'address', 'profilePhoto'];
  mutable.forEach((key) => {
    if (input[key] !== undefined) target[key] = key === 'phone' && !input[key] ? undefined : input[key];
  });
  if (input.jobTitle !== undefined && input.designation === undefined) target.designation = input.jobTitle;
  if (input.designation !== undefined) {
    target.designation = input.designation;
    target.jobTitle = input.designation;
  }
  const joiningDate = input.joiningDate === undefined ? input.dateOfJoining : input.joiningDate;
  if (joiningDate !== undefined) {
    target.joiningDate = joiningDate ? parseDate(joiningDate, 'joiningDate') : null;
    target.dateOfJoining = target.joiningDate;
  }
  if (input.dateOfExit !== undefined) target.dateOfExit = input.dateOfExit ? parseDate(input.dateOfExit, 'dateOfExit') : null;
  if (input.dateOfBirth !== undefined) target.dateOfBirth = input.dateOfBirth ? parseDate(input.dateOfBirth, 'dateOfBirth') : null;
  if (input.departmentId !== undefined) {
    const department = await validateDepartment(input.departmentId);
    target.departmentRef = department?._id || null;
    target.department = department?.name || 'General';
  } else if (input.department !== undefined) {
    const department = input.department
      ? await Department.findOne({ name: input.department, isActive: true })
      : null;
    target.department = department?.name || input.department || 'General';
    target.departmentRef = department?._id || null;
  }
  if (input.managerId !== undefined) {
    const managerId = validManagerId(input.managerId);
    if (role !== 'admin' && managerId && String(managerId) !== String(actor._id)) {
      throw ApiError.forbidden('Managers may only assign themselves as the reporting manager of a direct report.');
    }
    await validateManager(managerId, target._id);
    target.manager = managerId;
    target.reportingManager = managerId;
  } else if (input.reportingManager !== undefined) {
    const managerId = validManagerId(input.reportingManager);
    if (role !== 'admin' && managerId && String(managerId) !== String(actor._id)) {
      throw ApiError.forbidden('Managers may only assign themselves as the reporting manager of a direct report.');
    }
    await validateManager(managerId, target._id);
    target.manager = managerId;
    target.reportingManager = managerId;
  }
  if (input.branch !== undefined) {
    target.branch = input.branch;
    target.workLocation = input.branch;
  }
  const hasSalaryInput = input.salaryStructure && Object.values(input.salaryStructure).some((amount) => Number(amount) > 0);
  const updateSalary = input.salaryStructure !== undefined && can(actor, 'hr.payroll.manage');
  if (hasSalaryInput && !can(actor, 'hr.payroll.manage')) {
    throw ApiError.forbidden('You do not have permission to edit salary information.');
  }
  if (updateSalary) {
    target.salaryStructure = {
      basicSalary: 0, hra: 0, allowances: 0, bonus: 0, overtimeRate: 0, deductions: 0,
      ...(target.salaryStructure?.toObject ? target.salaryStructure.toObject() : target.salaryStructure),
      ...input.salaryStructure,
    };
  }
  if (input.status !== undefined && input.status !== target.status) {
    if (normalizeRole(target.role) === 'admin' && role !== 'admin') {
      throw ApiError.forbidden('Only an Admin can change an Admin account status.');
    }
    if (normalizeRole(target.role) === 'admin' && input.status !== 'active' &&
      await User.countDocuments({ role: 'admin', status: 'active' }) <= 1) {
      throw ApiError.badRequest('At least one active Admin account must remain.');
    }
    if (String(target._id) === String(actor._id) && input.status !== 'active') {
      throw ApiError.badRequest('You cannot deactivate your own account.');
    }
    const current = await User.findById(target._id).select('+tokenVersion').lean();
    target.status = input.status;
    target.tokenVersion = (current?.tokenVersion || 0) + 1;
  }
  await target.save();
  if (updateSalary) await syncSalaryStructure(target, target.salaryStructure, actor._id);
  await audit(actor, 'HR_EMPLOYEE_UPDATED', req, { targetUser: target._id, metadata: { fields: Object.keys(input) } });
  return { users: [toEmployee(target, can(actor, 'hr.payroll.view'))], rows: [] };
}

async function listDepartments(actor) {
  const departments = await Department.find().populate('head', 'name email employeeId').sort({ name: 1 }).lean();
  const visibleIds = new Set((await getVisibleEmployeeIds(actor)).map(String));
  const isAdmin = normalizeRole(actor.role) === 'admin';
  const counts = await User.aggregate([
    { $group: { _id: '$departmentRef', count: { $sum: 1 } } },
  ]);
  const legacyCounts = await User.aggregate([
    { $match: { departmentRef: null } },
    { $group: { _id: '$department', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  const legacyCountMap = new Map(legacyCounts.map((entry) => [entry._id || 'General', entry.count]));
  const output = departments.map((department) => ({
    ...department,
    head: department.head && (isAdmin || visibleIds.has(String(department.head._id)))
      ? { _id: department.head._id, name: department.head.name }
      : null,
    manager: department.head && (isAdmin || visibleIds.has(String(department.head._id)))
      ? { _id: department.head._id, name: department.head.name }
      : null,
    employeeCount: (countMap.get(String(department._id)) || 0) + (legacyCountMap.get(department.name) || 0),
  }));
  return { departments: output };
}

async function createDepartment(actor, input, req) {
  const code = input.code || input.name.trim().replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 20).toUpperCase();
  const headId = (input.headId || input.manager) ? objectId(input.headId || input.manager, 'head id') : null;
  if (headId) await validateManager(headId);
  const department = await Department.create({
    name: input.name,
    code,
    description: input.description || '',
    head: headId,
    createdBy: actor._id,
  });
  await audit(actor, 'HR_DEPARTMENT_CREATED', req, { metadata: { departmentId: String(department._id), name: department.name, code: department.code } });
  return { departments: await listDepartments(actor).then((result) => result.departments) };
}

async function updateDepartment(actor, id, input, req) {
  const department = await Department.findById(objectId(id, 'department id'));
  if (!department) throw ApiError.notFound('Department not found.');
  const oldName = department.name;
  for (const key of ['name', 'code', 'description', 'isActive']) {
    if (input[key] !== undefined) department[key] = input[key];
  }
  if (input.headId !== undefined) {
    department.head = input.headId ? objectId(input.headId, 'head id') : null;
  } else if (input.manager !== undefined) {
    department.head = input.manager ? objectId(input.manager, 'head id') : null;
  }
  if (department.head) await validateManager(department.head);
  department.updatedBy = actor._id;
  await department.save();
  if (oldName !== department.name) {
    await User.updateMany({ departmentRef: department._id }, { $set: { department: department.name } });
  }
  await audit(actor, 'HR_DEPARTMENT_UPDATED', req, { metadata: { departmentId: String(department._id), fields: Object.keys(input) } });
  return { departments: await listDepartments(actor).then((result) => result.departments) };
}

async function getLeaves(actor, yearValue) {
  const types = await ensureDefaultLeaveTypes();
  const year = yearValue ? Number(yearValue) : new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw ApiError.badRequest('year must be a valid four-digit year.');
  const employeeIds = await getVisibleEmployeeIds(actor);
  const [requestDocuments, storedBalances, usedRows, pendingRows] = await Promise.all([
    LeaveRequest.find({ employee: { $in: employeeIds } })
      .populate('employee', 'name email employeeId manager')
      .populate('leaveType', 'name code isPaid')
      .sort({ createdAt: -1 }).limit(2000).lean(),
    LeaveBalance.find({ employee: { $in: employeeIds }, year }).lean(),
    LeaveRequest.aggregate([
      { $match: { employee: { $in: employeeIds }, status: 'approved', startDate: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } } },
      { $group: { _id: { employee: '$employee', leaveType: '$leaveType' }, days: { $sum: '$days' } } },
    ]),
    LeaveRequest.aggregate([
      { $match: { employee: { $in: employeeIds }, status: 'pending', startDate: { $gte: new Date(Date.UTC(year, 0, 1)), $lt: new Date(Date.UTC(year + 1, 0, 1)) } } },
      { $group: { _id: { employee: '$employee', leaveType: '$leaveType' }, days: { $sum: '$days' } } },
    ]),
  ]);
  const requests = requestDocuments.map((request) => ({
    ...request,
    leaveTypeId: request.leaveType?._id || request.leaveType,
    leaveTypeInfo: request.leaveType,
    leaveType: request.leaveType?.name || '',
  }));
  const storedByKey = new Map(storedBalances.map((balance) => [`${balance.employee}:${balance.leaveType}`, balance]));
  const usedByKey = new Map(usedRows.map((row) => [`${row._id.employee}:${row._id.leaveType}`, row.days]));
  const pendingByKey = new Map(pendingRows.map((row) => [`${row._id.employee}:${row._id.leaveType}`, row.days]));
  const balances = [];
  for (const employeeId of employeeIds) {
    for (const type of types) {
      const key = `${employeeId}:${type._id}`;
      const stored = storedByKey.get(key);
      const usedDays = usedByKey.get(key) || 0;
      const pendingDays = pendingByKey.get(key) || 0;
      const allocatedDays = stored ? stored.allocatedDays : type.annualAllowance;
      balances.push({
        employee: employeeId,
        leaveType: type,
        year,
        allocatedDays,
        usedDays,
        pendingDays,
        remainingDays: Math.max(0, allocatedDays - usedDays - pendingDays),
      });
    }
  }
  return { requests, balances, types };
}

async function getLeaveTypes() {
  return { types: await ensureDefaultLeaveTypes() };
}

async function ensureBalance(employeeId, type, year, actorId) {
  return LeaveBalance.findOneAndUpdate(
    { employee: employeeId, leaveType: type._id, year },
    { $setOnInsert: { allocatedDays: type.annualAllowance, updatedBy: actorId } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function createLeaveRequest(actor, input, req) {
  if (!can(actor, 'hr.leaves.apply')) throw ApiError.forbidden('You do not have permission to apply for leave.');
  const startDate = parseDate(input.startDate, 'startDate');
  const endDate = parseDate(input.endDate, 'endDate');
  if (startDate > endDate) throw ApiError.badRequest('startDate must be on or before endDate.');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (startDate < today) throw ApiError.badRequest('Leave requests cannot start in the past.');
  if (startDate.getUTCFullYear() !== endDate.getUTCFullYear()) throw ApiError.badRequest('A leave request must be within one calendar year.');
  const days = Math.round((endDate - startDate) / 86400000) + 1;
  await ensureDefaultLeaveTypes();
  const typeSelector = input.leaveTypeId
    ? { _id: objectId(input.leaveTypeId, 'leave type id') }
    : { code: String(input.leaveType || '').trim().toUpperCase() };
  const type = await LeaveType.findOne({ ...typeSelector, isActive: true });
  if (!type) throw ApiError.badRequest('Select an active leave type.');
  const balance = await ensureBalance(actor._id, type, startDate.getUTCFullYear(), actor._id);
  const overlap = await LeaveRequest.exists({
    employee: actor._id,
    status: { $in: ['pending', 'approved'] },
    startDate: { $lte: endDate },
    endDate: { $gte: startDate },
  });
  if (overlap) throw ApiError.conflict('A pending or approved leave request already overlaps these dates.');
  const reserved = await LeaveRequest.aggregate([
    { $match: { employee: actor._id, leaveType: type._id, status: { $in: ['pending', 'approved'] }, startDate: { $gte: new Date(Date.UTC(startDate.getUTCFullYear(), 0, 1)), $lt: new Date(Date.UTC(startDate.getUTCFullYear() + 1, 0, 1)) } } },
    { $group: { _id: null, days: { $sum: '$days' } } },
  ]);
  if ((reserved[0]?.days || 0) + days > balance.allocatedDays) throw ApiError.badRequest('Requested leave exceeds the available balance.');
  const request = await LeaveRequest.create({
    employee: actor._id, leaveType: type._id, startDate, endDate, days, reason: input.reason,
  });
  const employee = await User.findById(actor._id).select('manager reportingManager').lean();
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await notifyUsers([employee?.manager, employee?.reportingManager, ...admins.map((user) => user._id)], actor, 'leave_request', `Leave request submitted for ${days} day(s).`, request._id);
  await audit(actor, 'HR_LEAVE_REQUESTED', req, { targetUser: actor._id, metadata: { requestId: String(request._id), leaveType: type.code, days } });
  return getLeaves(actor, String(startDate.getUTCFullYear()));
}

async function createLeaveType(actor, input, req) {
  if (!can(actor, 'hr.leaves.approve')) throw ApiError.forbidden('Only a leave approver can configure leave types.');
  let type;
  if (input.typeId) {
    type = await LeaveType.findById(objectId(input.typeId, 'leave type id'));
    if (!type) throw ApiError.notFound('Leave type not found.');
    for (const key of ['name', 'code', 'annualAllowance', 'isPaid', 'isActive']) {
      if (input[key] !== undefined) type[key] = input[key];
    }
    type.updatedBy = actor._id;
    await type.save();
  } else {
    type = await LeaveType.create({ ...input, createdBy: actor._id });
  }
  await audit(actor, input.typeId ? 'HR_LEAVE_TYPE_UPDATED' : 'HR_LEAVE_TYPE_CREATED', req, { metadata: { leaveTypeId: String(type._id), code: type.code } });
  return getLeaves(actor);
}

async function deactivateLeaveType(actor, typeId, req) {
  if (!can(actor, 'hr.leaves.approve')) throw ApiError.forbidden('Only a leave approver can configure leave types.');
  const type = await LeaveType.findById(objectId(typeId, 'leave type id'));
  if (!type) throw ApiError.notFound('Leave type not found.');
  type.isActive = false;
  type.updatedBy = actor._id;
  await type.save();
  await audit(actor, 'HR_LEAVE_TYPE_DEACTIVATED', req, { metadata: { leaveTypeId: String(type._id), code: type.code } });
  return getLeaves(actor);
}

async function setLeaveBalance(actor, input, req) {
  if (!can(actor, 'hr.leaves.approve')) throw ApiError.forbidden('Only a leave approver can set leave balances.');
  const target = await User.findById(objectId(input.employeeId, 'employee id')).select('_id');
  if (!target) throw ApiError.notFound('Employee not found.');
  await assertCanAccessEmployee(actor, target._id);
  if (String(target._id) === String(actor._id) && normalizeRole(actor.role) !== 'admin') {
    throw ApiError.forbidden('Managers cannot change their own leave balance.');
  }
  const type = await LeaveType.findById(objectId(input.leaveTypeId, 'leave type id'));
  if (!type) throw ApiError.notFound('Leave type not found.');
  const balance = await LeaveBalance.findOneAndUpdate(
    { employee: target._id, leaveType: type._id, year: input.year },
    { $set: { allocatedDays: input.allocatedDays, updatedBy: actor._id } },
    { upsert: true, new: true, runValidators: true }
  );
  await audit(actor, 'HR_LEAVE_BALANCE_UPDATED', req, { targetUser: target._id, metadata: { balanceId: String(balance._id), year: balance.year, allocatedDays: balance.allocatedDays, leaveType: type.code } });
  return getLeaves(actor, String(input.year));
}

async function reviewLeave(actor, requestId, input, req) {
  const leave = await LeaveRequest.findById(objectId(requestId, 'leave request id'));
  if (!leave) throw ApiError.notFound('Leave request not found.');
  if (leave.status !== 'pending') throw ApiError.conflict('Only pending leave requests may be reviewed.');
  await assertCanAccessEmployee(actor, leave.employee);
  if (String(leave.employee) === String(actor._id)) throw ApiError.forbidden('You cannot review your own leave request.');
  if (input.status === 'approved') {
    const type = await LeaveType.findById(leave.leaveType);
    const balance = await ensureBalance(leave.employee, type, leave.startDate.getUTCFullYear(), actor._id);
    const approved = await LeaveRequest.aggregate([
      { $match: { _id: { $ne: leave._id }, employee: leave.employee, leaveType: leave.leaveType, status: 'approved', startDate: { $gte: new Date(Date.UTC(leave.startDate.getUTCFullYear(), 0, 1)), $lt: new Date(Date.UTC(leave.startDate.getUTCFullYear() + 1, 0, 1)) } } },
      { $group: { _id: null, days: { $sum: '$days' } } },
    ]);
    if ((approved[0]?.days || 0) + leave.days > balance.allocatedDays) throw ApiError.badRequest('Approving this request would exceed the employee’s available leave balance.');
  }
  leave.status = input.status;
  leave.reviewedBy = actor._id;
  leave.reviewedAt = new Date();
  leave.reviewNote = input.reviewNote || '';
  await leave.save();
  if (leave.status === 'approved') {
    const employee = await User.findById(leave.employee).select('name employeeId department');
    const endDate = new Date(leave.endDate);
    for (const date = new Date(leave.startDate); date <= endDate; date.setUTCDate(date.getUTCDate() + 1)) {
      const day = toAttendanceDay(date);
      await Attendance.updateOne(
        { employee: leave.employee, date: day },
        {
          $set: { leaveRequest: leave._id },
          $setOnInsert: {
            employee: leave.employee,
            employeeName: employee?.name || '',
            employeeId: employee?.employeeId || '',
            department: employee?.department || 'General',
            date: day,
            status: 'Leave',
            createdBy: actor._id,
            updatedBy: actor._id,
          },
        },
        { upsert: true, setDefaultsOnInsert: true }
      );
    }
  }
  await audit(actor, `HR_LEAVE_${input.status.toUpperCase()}`, req, {
    targetUser: leave.employee,
    metadata: { requestId: String(leave._id), reviewNote: leave.reviewNote },
  });
  await notifyUsers([leave.employee], actor, 'leave_review', `Your leave request was ${input.status}.`, leave._id);
  return getLeaves(actor, String(leave.startDate.getUTCFullYear()));
}

function runRow(run) {
  const employee = run.employee && typeof run.employee === 'object' ? run.employee : {};
  return {
    _id: run._id,
    employee: { _id: employee._id || run.employee, name: employee.name || run.employeeName || '', employeeId: employee.employeeId || run.employeeId || '' },
    period: run.period,
    currency: run.currency,
    baseSalary: run.baseSalary,
    components: run.components,
    grossPay: run.grossPay,
    totalDeductions: run.totalDeductions,
    netPay: run.netPay,
    workingDays: run.workingDays || 0,
    workedDays: run.workedDays || 0,
    paidLeaveDays: run.paidLeaveDays || 0,
    unpaidLeaveDays: run.unpaidLeaveDays || 0,
    overtimeMinutes: run.overtimeMinutes || 0,
    prorationDeduction: run.prorationDeduction || 0,
    status: run.status,
    generatedBy: run.generatedBy,
    approvedBy: run.approvedBy,
    approvedAt: run.approvedAt,
    createdAt: run.createdAt,
  };
}

async function listPayroll(actor, period) {
  const ids = await getVisibleEmployeeIds(actor);
  const filter = { employee: { $in: ids } };
  if (period) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw ApiError.badRequest('period must use YYYY-MM format.');
    filter.period = period;
  }
  const runs = await PayrollRun.find(filter)
    .populate('employee', 'name employeeId')
    .sort({ period: -1, createdAt: -1 })
    .limit(2000).lean();
  const rows = runs.map(runRow);
  const groups = new Map();
  for (const row of rows) {
    if (!groups.has(row.period)) {
      groups.set(row.period, {
        _id: row.period,
        period: row.period,
        currency: row.currency,
        employeeCount: 0,
        grossTotal: 0,
        deductionTotal: 0,
        netTotal: 0,
        rows: [],
        statuses: [],
      });
    }
    const group = groups.get(row.period);
    group.employeeCount += 1;
    group.grossTotal += row.grossPay;
    group.deductionTotal += row.totalDeductions;
    group.netTotal += row.netPay;
    group.rows.push(row);
    group.statuses.push(row.status);
  }
  const runGroups = Array.from(groups.values()).map((group) => {
    const { statuses, ...result } = group;
    result.status = statuses.every((status) => status === 'approved')
      ? 'approved'
      : (statuses.some((status) => status === 'pending_approval') ? 'pending_approval' : 'rejected');
    return result;
  });
  return { runs: runGroups, rows };
}

async function setSalaryStructure(actor, input, req) {
  const target = await User.findById(objectId(input.employeeId, 'employee id'));
  if (!target) throw ApiError.notFound('Employee not found.');
  await assertCanAccessEmployee(actor, target._id);
  const effectiveFrom = parseDate(input.effectiveFrom, 'effectiveFrom');
  const profileSalary = {
    basicSalary: input.baseSalary,
    hra: 0,
    allowances: 0,
    bonus: 0,
    overtimeRate: input.overtimeRate || 0,
    deductions: 0,
  };
  for (const component of input.components || []) {
    const key = ({ HRA: 'hra', ALLOWANCES: 'allowances', BONUS: 'bonus', DEDUCTIONS: 'deductions' })[component.name.trim().toUpperCase()];
    if (key) profileSalary[key] += component.amount;
  }
  target.salaryStructure = profileSalary;
  if (input.currency) target.salaryCurrency = input.currency;
  await target.save();
  const structure = await SalaryStructure.findOneAndUpdate(
    { employee: target._id },
    {
      $set: {
        baseSalary: input.baseSalary,
        overtimeRate: input.overtimeRate || 0,
        currency: input.currency || target.salaryCurrency || 'INR',
        components: input.components || [],
        effectiveFrom,
        updatedBy: actor._id,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  await audit(actor, 'HR_SALARY_STRUCTURE_UPDATED', req, {
    targetUser: target._id,
    metadata: { structureId: String(structure._id), currency: structure.currency, effectiveFrom },
  });
  return listPayroll(actor);
}

async function generatePayroll(actor, input, req) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(input.period)) throw ApiError.badRequest('period must use YYYY-MM format.');
  if (await PayrollRun.exists({ period: input.period })) {
    throw ApiError.conflict(`Payroll for ${input.period} has already been generated. Edit the salary structure and use a new payroll period to avoid duplicate processing.`);
  }
  const [year, month] = input.period.split('-').map(Number);
  const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const attendanceSetting = await Setting.findOne({ key: 'attendance.rules' }).lean();
  const attendanceRules = attendanceSetting?.value || {};
  const workDays = new Set(
    Array.isArray(attendanceRules.workDays) && attendanceRules.workDays.length
      ? attendanceRules.workDays
      : [1, 2, 3, 4, 5]
  );
  const holidays = new Set(
    Array.isArray(attendanceRules.holidays)
      ? attendanceRules.holidays.map((holiday) => holiday.date)
      : []
  );
  const users = await User.find({ ...userScope(actor), status: 'active' }).select('_id name employeeId salaryCurrency dateOfJoining joiningDate dateOfExit').lean();
  const userIds = users.map((user) => user._id);
  const structures = await SalaryStructure.find({ employee: { $in: userIds }, effectiveFrom: { $lte: periodEnd } }).lean();
  const usersById = new Map(users.map((user) => [String(user._id), user]));
  const created = [];
  const scheduledDaysBetween = (start, end) => {
    let count = 0;
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
    const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
    while (cursor <= last) {
      const dateString = cursor.toISOString().slice(0, 10);
      if (workDays.has(cursor.getUTCDay()) && !holidays.has(dateString)) count += 1;
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  };
  const workingDaysInMonth = scheduledDaysBetween(monthStart, monthEnd);
  for (const structure of structures) {
    const user = usersById.get(String(structure.employee));
    if (!user) continue;
    const [attendance, approvedRequests] = await Promise.all([
      Attendance.find({ employee: user._id, date: { $gte: monthStart, $lte: monthEnd } })
        .select('date overtimeMinutes status').lean(),
      LeaveRequest.find({
        employee: user._id, status: 'approved',
        startDate: { $lte: monthEnd }, endDate: { $gte: monthStart },
      }).populate({ path: 'leaveType', select: 'isPaid' }).select('startDate endDate days leaveType').lean(),
    ]);
    const approvedLeave = approvedRequests.filter((leave) => leave.leaveType?.isPaid);
    const unpaidLeave = approvedRequests.filter((leave) => leave.leaveType && !leave.leaveType.isPaid);
    const countLeaveWeekdays = (leave) => {
      const start = new Date(Math.max(monthStart.getTime(), leave.startDate.getTime()));
      const end = new Date(Math.min(monthEnd.getTime(), leave.endDate.getTime()));
      return scheduledDaysBetween(start, end);
    };
    const unpaidLeaveDays = unpaidLeave.reduce((sum, leave) => sum + countLeaveWeekdays(leave), 0);
    const paidLeaveDays = approvedLeave.reduce((sum, leave) => sum + countLeaveWeekdays(leave), 0);
    let eligibleStart = monthStart;
    let eligibleEnd = monthEnd;
    const joiningDate = user.joiningDate || user.dateOfJoining;
    if (joiningDate && joiningDate > eligibleStart) eligibleStart = joiningDate;
    if (user.dateOfExit && user.dateOfExit < eligibleEnd) eligibleEnd = user.dateOfExit;
    const eligibleWorkingDays = eligibleEnd < eligibleStart ? 0 : scheduledDaysBetween(eligibleStart, eligibleEnd);
    const chargeableUnpaidDays = Math.min(unpaidLeaveDays, eligibleWorkingDays);
    const payableDays = Math.max(0, eligibleWorkingDays - chargeableUnpaidDays);
    const prorationDeduction = workingDaysInMonth > 0
      ? Math.round((structure.baseSalary * (workingDaysInMonth - payableDays) / workingDaysInMonth) * 100) / 100
      : 0;
    const proratedBase = Math.max(0, Math.round((structure.baseSalary - prorationDeduction) * 100) / 100);
    const overtimeMinutes = attendance.reduce((sum, row) => sum + (Number(row.overtimeMinutes) || 0), 0);
    const overtimePay = Math.round((overtimeMinutes / 60) * (structure.overtimeRate || 0) * 100) / 100;
    const components = structure.components.slice();
    if (overtimePay > 0) components.push({ name: 'Overtime', amount: overtimePay, kind: 'earning' });
    if (prorationDeduction > 0) components.push({ name: 'Unpaid leave / partial-month proration', amount: prorationDeduction, kind: 'deduction' });
    const earnings = components.filter((component) => component.kind === 'earning').reduce((sum, item) => sum + item.amount, 0);
    const totalDeductions = components.filter((component) => component.kind === 'deduction').reduce((sum, item) => sum + item.amount, 0);
    const grossPay = proratedBase + earnings;
    if (totalDeductions > grossPay) {
      throw ApiError.badRequest(`Deductions exceed gross pay for employee ${user.employeeId || user.name}.`);
    }
    const run = await PayrollRun.create({
      employee: user._id,
      employeeName: user.name,
      employeeId: user.employeeId || '',
      period: input.period,
      currency: structure.currency,
      baseSalary: proratedBase,
      components,
      grossPay,
      totalDeductions,
      netPay: grossPay - totalDeductions,
      workingDays: workingDaysInMonth,
      workedDays: Math.max(0, eligibleWorkingDays - unpaidLeaveDays),
      paidLeaveDays,
      unpaidLeaveDays,
      overtimeMinutes,
      prorationDeduction,
      generatedBy: actor._id,
    });
    created.push(run);
    await audit(actor, 'HR_PAYROLL_GENERATED', req, {
      targetUser: user._id,
      metadata: { payrollRunId: String(run._id), period: run.period, netPay: run.netPay, currency: run.currency },
    });
  }
  return listPayroll(actor, input.period);
}

async function approvePayroll(actor, runId, input, req) {
  if (normalizeRole(actor.role) !== 'admin') throw ApiError.forbidden('Only an Admin can approve payroll.');
  let period;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(runId)) {
    period = runId;
  } else {
    const run = await PayrollRun.findById(objectId(runId, 'payroll run id'));
    if (!run) throw ApiError.notFound('Payroll run not found.');
    period = run.period;
  }
  const pendingRuns = await PayrollRun.find({ period, status: 'pending_approval' }).select('employee').lean();
  const update = await PayrollRun.updateMany(
    { period, status: 'pending_approval' },
    { $set: { status: 'approved', approvedBy: actor._id, approvedAt: new Date(), approvalNote: input.approvalNote || '' } }
  );
  if (!update.modifiedCount) throw ApiError.conflict('There are no pending payroll runs for this period.');
  await audit(actor, 'HR_PAYROLL_APPROVED', req, {
    metadata: { period, approvedCount: update.modifiedCount, approvalNote: input.approvalNote || '' },
  });
  await notifyUsers(pendingRuns.map((run) => run.employee), actor, 'payroll_approved', `Payroll for ${period} has been approved.`, null);
  return listPayroll(actor, period);
}

async function getSalarySlip(actor, runId) {
  let runs;
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(runId)) {
    const ids = await getVisibleEmployeeIds(actor);
    runs = await PayrollRun.find({ period: runId, status: 'approved', employee: { $in: ids } })
      .populate('employee', 'name email employeeId role department manager reportingManager')
      .sort({ employeeName: 1 }).lean();
  } else {
    const run = await PayrollRun.findById(objectId(runId, 'payroll run id'))
      .populate('employee', 'name email employeeId role department manager reportingManager').lean();
    if (!run) throw ApiError.notFound('Payroll run not found.');
    if (run.status !== 'approved') throw ApiError.forbidden('Salary slips are available after payroll approval.');
    await assertCanAccessEmployee(actor, run.employee._id);
    runs = [run];
  }
  if (!runs.length) throw ApiError.notFound('No approved payroll slips were found for this period.');
  return runs;
}

async function getDashboard(actor) {
  const employeeIds = await getVisibleEmployeeIds(actor);
  const employees = await User.find({ _id: { $in: employeeIds } })
    .select('_id department departmentRef status createdAt joiningDate dateOfJoining').lean();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const activeEmployees = employees.filter((user) => user.status === 'active').length;
  const inactiveEmployees = employees.length - activeEmployees;
  const departmentCounts = employees.reduce((counts, user) => {
    const department = user.department || 'General';
    counts[department] = (counts[department] || 0) + 1;
    return counts;
  }, {});
  const monthKeys = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
    return {
      key: `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`,
      label: month.toLocaleDateString('en-IN', { month: 'short' }),
      start: month,
    };
  });
  const [todayRecords, attendanceHistory, leaveRecords, payrollRuns, attendanceSetting] = await Promise.all([
    can(actor, 'hr.attendance.view')
      ? Attendance.find({ employee: { $in: employeeIds }, date: { $gte: todayStart, $lt: todayEnd } })
        .select('employee status lateMinutes').lean()
      : [],
    can(actor, 'hr.attendance.view')
      ? Attendance.find({ employee: { $in: employeeIds }, date: { $gte: new Date(todayStart.getTime() - 6 * 86400000), $lt: todayEnd } })
        .select('date status lateMinutes').lean()
      : [],
    can(actor, 'hr.leaves.view')
      ? LeaveRequest.find({ employee: { $in: employeeIds }, startDate: { $gte: monthKeys[0].start } })
        .select('status startDate endDate').lean()
      : [],
    can(actor, 'hr.payroll.view')
      ? PayrollRun.find({ employee: { $in: employeeIds }, period }).select('grossPay netPay totalDeductions').lean()
      : [],
    Setting.findOne({ key: 'attendance.rules' }).lean(),
  ]);
  const presentToday = todayRecords.filter((record) => !['Absent', 'Leave'].includes(record.status)).length;
  const onLeave = todayRecords.filter((record) => record.status === 'Leave').length;
  const lateToday = todayRecords.filter((record) => Number(record.lateMinutes) > 0 || String(record.status).toLowerCase() === 'late').length;
  const rules = attendanceSetting?.value || {};
  const workDays = Array.isArray(rules.workDays) && rules.workDays.length ? rules.workDays : [1, 2, 3, 4, 5];
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const holidays = Array.isArray(rules.holidays) ? rules.holidays : [];
  const isWorkingDay = workDays.includes(now.getDay()) && !holidays.some((holiday) => holiday.date === todayKey);
  const absentToday = isWorkingDay ? Math.max(0, activeEmployees - presentToday - onLeave) : 0;
  const employeesByMonth = monthKeys.map((month) => {
    const nextMonth = new Date(month.start.getFullYear(), month.start.getMonth() + 1, 1);
    const count = employees.filter((user) => {
      const joined = user.joiningDate || user.dateOfJoining || user.createdAt;
      return joined && joined >= month.start && joined < nextMonth;
    }).length;
    return { label: month.label, value: count, month: month.key, count };
  });
  const attendanceTrends = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(todayStart.getTime() - (6 - index) * 86400000);
    const dayKey = day.toDateString();
    const dayRecords = attendanceHistory.filter((record) => new Date(record.date).toDateString() === dayKey);
    return {
      label: day.toLocaleDateString('en-IN', { weekday: 'short' }),
      value: dayRecords.filter((record) => !['Absent', 'Leave'].includes(record.status)).length,
      present: dayRecords.filter((record) => !['Absent', 'Leave'].includes(record.status)).length,
      late: dayRecords.filter((record) => Number(record.lateMinutes) > 0).length,
    };
  });
  const leaveTrends = monthKeys.map((month) => {
    const nextMonth = new Date(month.start.getFullYear(), month.start.getMonth() + 1, 1);
    const count = leaveRecords.filter((leave) => leave.startDate >= month.start && leave.startDate < nextMonth).length;
    return { label: month.label, value: count, month: month.key, count };
  });
  const monthlyPayroll = payrollRuns.reduce((sum, run) => sum + (Number(run.netPay) || 0), 0);
  const metrics = {
    employees: employees.length,
    departments: new Set(employees.map((user) => user.department || 'General')).size,
    pendingLeaves: 0,
    totalEmployees: employees.length,
    activeEmployees,
    inactiveEmployees,
    presentToday,
    absentToday,
    onLeave,
    lateToday,
    newEmployees: employees.filter((user) => {
      const joined = user.joiningDate || user.dateOfJoining || user.createdAt;
      return joined && joined >= monthStart;
    }).length,
    monthlyPayroll,
  };
  const charts = {
    headcountByDepartment: Object.entries(departmentCounts).map(([department, count]) => ({ department, count })),
    departmentDistribution: Object.entries(departmentCounts).map(([label, value]) => ({ label, value })),
    employeeGrowth: employeesByMonth,
    attendanceTrends,
    leaveTrends,
    payrollSummary: payrollRuns.length ? [{ label: period, value: monthlyPayroll }] : [],
    attendanceByStatus: [],
    leaveByStatus: [],
  };
  if (can(actor, 'hr.attendance.view')) {
    charts.attendanceByStatus = Object.entries(todayRecords.reduce((acc, record) => {
      const key = record.status || 'Unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([status, count]) => ({ status, count }));
  }
  if (can(actor, 'hr.leaves.view')) {
    const leaves = await LeaveRequest.find({ employee: { $in: employeeIds } }).select('status').lean();
    metrics.pendingLeaves = leaves.filter((leave) => leave.status === 'pending').length;
    charts.leaveByStatus = Object.entries(leaves.reduce((acc, leave) => {
      acc[leave.status] = (acc[leave.status] || 0) + 1;
      return acc;
    }, {})).map(([status, count]) => ({ status, count }));
  }
  return { metrics, charts };
}

async function getReports(actor, query) {
  const employeeIds = await getVisibleEmployeeIds(actor);
  const scopedEmployeeIds = query.employeeId
    ? employeeIds.filter((id) => String(id) === String(objectId(query.employeeId, 'employee id')))
    : employeeIds;
  const dateStart = query.fromDate ? parseDate(query.fromDate, 'fromDate') : new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1));
  const dateEnd = query.toDate ? parseDate(query.toDate, 'toDate') : localTodayAsUtcDate();
  if (dateStart > dateEnd) throw ApiError.badRequest('fromDate must be on or before toDate.');
  dateEnd.setUTCHours(23, 59, 59, 999);
  const [users, attendance, leaves, payroll] = await Promise.all([
    can(actor, 'hr.employees.view')
      ? User.find({
        _id: { $in: scopedEmployeeIds },
        ...(query.department ? { department: query.department } : {}),
        ...(query.employeeStatus ? { status: query.employeeStatus } : {}),
      }).select(USER_FIELDS).sort({ name: 1 }).lean()
      : [],
    can(actor, 'hr.attendance.view')
      ? Attendance.find({
        employee: { $in: scopedEmployeeIds },
        date: { $gte: toAttendanceDay(dateStart), $lte: toAttendanceEndOfDay(dateEnd) },
        ...(query.department ? { department: query.department } : {}),
      })
        .select('employee date checkInTime checkOutTime workingHoursMinutes overtimeMinutes lateMinutes earlyCheckoutMinutes status')
        .populate('employee', 'name employeeId department').sort({ date: -1 }).limit(10000).lean()
      : [],
    can(actor, 'hr.leaves.view')
      ? LeaveRequest.find({
        employee: { $in: scopedEmployeeIds },
        startDate: { $lte: dateEnd }, endDate: { $gte: dateStart },
      })
        .populate('employee', 'name employeeId department').populate('leaveType', 'name code')
        .sort({ startDate: -1 }).limit(5000).lean()
      : [],
    can(actor, 'hr.payroll.view')
      ? PayrollRun.find({
        employee: { $in: scopedEmployeeIds },
        period: { $gte: dateStart.toISOString().slice(0, 7), $lte: dateEnd.toISOString().slice(0, 7) },
      })
        .populate('employee', 'name employeeId department').sort({ period: -1 }).limit(5000).lean()
      : [],
  ]);
  const reportKind = query.kind === 'employee' ? 'employees' : query.kind;
  const employeeRows = users
    .filter((user) => !query.department || user.department === query.department)
    .filter((user) => !query.employeeStatus || user.status === query.employeeStatus)
    .filter((user) => reportKind !== 'employees' || !query.status || user.status === query.status)
    .map((user) => toEmployee(user, can(actor, 'hr.payroll.view')));
  const filteredAttendance = attendance
    .filter((row) => !query.department || row.department === query.department)
    .filter((row) => !query.status || !['daily', 'weekly', 'monthly', 'attendance', 'late', 'absence', 'overtime'].includes(reportKind) || row.status === query.status);
  const filteredLeaves = leaves
    .filter((row) => !query.department || row.employee?.department === query.department)
    .filter((row) => !query.status || reportKind !== 'leaves' || row.status === query.status);
  const filteredPayroll = payroll
    .filter((row) => !query.department || row.employee?.department === query.department)
    .filter((row) => !query.status || reportKind !== 'payroll' || row.status === query.status);
  const payrollRows = filteredPayroll.map(runRow);
  const late = filteredAttendance.filter((row) => Number(row.lateMinutes) > 0 || row.status === 'Late');
  const absences = filteredAttendance.filter((row) => row.status === 'Absent');
  const overtime = filteredAttendance.filter((row) => Number(row.overtimeMinutes) > 0);
  const lateAttendanceReport = late.map((row) => ({ ...row, lateArrivalMinutes: row.lateMinutes }));
  const summary = {
    employees: employeeRows.length,
    attendanceRecords: filteredAttendance.length,
    lateArrivals: late.length,
    absences: absences.length,
    overtimeMinutes: overtime.reduce((sum, row) => sum + (Number(row.overtimeMinutes) || 0), 0),
    leaveRequests: filteredLeaves.length,
    pendingLeaves: filteredLeaves.filter((row) => row.status === 'pending').length,
    approvedPayroll: payrollRows.filter((row) => row.status === 'approved').length,
    payrollSalaryTotal: payrollRows.reduce((sum, row) => sum + (Number(row.netPay) || 0), 0),
  };
  const departmentDistribution = Object.entries(employeeRows.reduce((counts, employee) => {
    counts[employee.department || 'General'] = (counts[employee.department || 'General'] || 0) + 1;
    return counts;
  }, {})).map(([label, value]) => ({ label, value }));
  const attendanceTrends = Object.entries(filteredAttendance.reduce((groups, row) => {
    const key = new Date(row.date).toISOString().slice(0, 10);
    groups[key] ||= { label: key, present: 0, late: 0, absent: 0, value: 0 };
    if (row.status === 'Absent') groups[key].absent += 1;
    else if (!['Leave'].includes(row.status)) groups[key].present += 1;
    if (Number(row.lateMinutes) > 0 || row.status === 'Late') groups[key].late += 1;
    groups[key].value = groups[key].present;
    return groups;
  }, {})).map(([, row]) => row).sort((a, b) => a.label.localeCompare(b.label));
  const leaveTrends = Object.entries(filteredLeaves.reduce((groups, row) => {
    const key = new Date(row.startDate).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
    groups[key] = (groups[key] || 0) + 1;
    return groups;
  }, {})).map(([label, value]) => ({ label, value }));
  const payrollSummary = Object.entries(payrollRows.reduce((groups, row) => {
    groups[row.period] = (groups[row.period] || 0) + (Number(row.netPay) || 0);
    return groups;
  }, {})).map(([label, value]) => ({ label, value }));
  return {
    employees: employeeRows,
    attendance: filteredAttendance,
    leaves: filteredLeaves,
    payroll: payrollRows,
    lateAttendance: lateAttendanceReport,
    absenceReport: absences,
    overtimeReport: overtime,
    summary,
    departmentDistribution,
    attendanceTrends,
    leaveTrends,
    payrollSummary,
  };
}

module.exports = {
  objectId, parseDate, dateRange, userScope, can, assertCanAccessEmployee,
  listEmployees, getEmployee, createEmployee, updateEmployee,
  listEmployeeDocuments, uploadEmployeeDocument, getEmployeeDocument, uploadEmployeePhoto, getEmployeePhoto,
  listDepartments, createDepartment, updateDepartment,
  getLeaves, getLeaveTypes, createLeaveRequest, createLeaveType, deactivateLeaveType, setLeaveBalance, reviewLeave,
  listPayroll, setSalaryStructure, generatePayroll, approvePayroll, getSalarySlip,
  getDashboard, getReports,
  listNotifications, markNotificationRead,
};
