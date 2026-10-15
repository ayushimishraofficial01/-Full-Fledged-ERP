const { z } = require('zod');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const hr = require('../services/hr.service');
const { buildWorkbook, sendWorkbook } = require('../services/export.service');
const { buildSalarySlipPdf, buildReportPdf } = require('../services/hr-pdf.service');

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();
const salaryStructure = z.object({
  basicSalary: z.coerce.number().min(0).optional(),
  hra: z.coerce.number().min(0).optional(),
  allowances: z.coerce.number().min(0).optional(),
  bonus: z.coerce.number().min(0).optional(),
  overtimeRate: z.coerce.number().min(0).optional(),
  deductions: z.coerce.number().min(0).optional(),
}).optional();

const employeeFields = {
  name: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().email().max(254).optional(),
  password: z.string().min(8).max(128).optional(),
  role: z.enum(['admin', 'manager', 'sales', 'user', 'staff']).optional(),
  phone: z.string().trim().max(40).optional(),
  status: z.enum(['active', 'inactive', 'suspended']).optional(),
  employeeId: z.string().trim().max(50).optional(),
  department: z.string().trim().max(80).optional(),
  departmentId: z.string().trim().max(64).optional(),
  designation: z.string().trim().max(100).optional(),
  jobTitle: z.string().trim().max(100).optional(),
  joiningDate: dateString,
  dateOfJoining: dateString,
  dateOfExit: dateString,
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional(),
  reportingManager: z.string().trim().max(64).nullable().optional(),
  managerId: z.string().trim().max(64).nullable().optional(),
  branch: z.string().trim().max(120).optional(),
  workLocation: z.string().trim().max(120).optional(),
  emergencyContact: z.string().trim().max(40).optional(),
  dateOfBirth: dateString,
  address: z.string().trim().max(500).optional(),
  profilePhoto: z.string().trim().max(500).optional(),
  salaryCurrency: z.string().trim().length(3).optional(),
  salaryStructure,
};
const employeeCreate = z.object({ ...employeeFields, name: employeeFields.name.unwrap(), email: employeeFields.email.unwrap(), password: employeeFields.password.unwrap() });
const employeeUpdate = z.object(employeeFields).omit({ role: true, email: true, password: true })
  .refine((body) => Object.keys(body).length > 0, 'At least one employee field is required.');
const departmentCreate = z.object({
  name: z.string().trim().min(1).max(100),
  code: z.string().trim().max(20).optional(),
  description: z.string().trim().max(500).optional(),
  headId: z.string().trim().max(64).optional(),
  manager: z.string().trim().max(64).optional(),
});
const departmentUpdate = departmentCreate.partial().extend({
  isActive: z.boolean().optional(),
}).refine((body) => Object.keys(body).length > 0, 'At least one department field is required.');
const leaveApplication = z.object({
  leaveTypeId: z.string().trim().max(64).optional(),
  leaveType: z.string().trim().min(1).max(20).optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reason: z.string().trim().min(1).max(1000),
});
const leaveTypeInput = z.object({
  typeId: z.string().trim().max(64).optional(),
  name: z.string().trim().min(1).max(60).optional(),
  code: z.string().trim().min(1).max(20).optional(),
  annualAllowance: z.coerce.number().min(0).max(366).optional(),
  isPaid: z.boolean().optional(),
  isActive: z.boolean().optional(),
}).refine((input) => input.typeId || (input.name && input.code && input.annualAllowance !== undefined), 'New leave types require name, code, and annual allowance.');
const leaveBalanceInput = z.object({
  employeeId: z.string().trim().max(64),
  leaveTypeId: z.string().trim().max(64),
  year: z.coerce.number().int().min(2000).max(2200),
  allocatedDays: z.coerce.number().min(0).max(366),
});
const leaveReview = z.object({
  status: z.enum(['approved', 'rejected']),
  reviewNote: z.string().trim().max(1000).optional(),
});
const payrollGenerate = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });
const payrollStructure = z.object({
  employeeId: z.string().trim().max(64),
  baseSalary: z.coerce.number().min(0),
  overtimeRate: z.coerce.number().min(0).optional(),
  currency: z.string().trim().length(3).optional(),
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  components: z.array(z.object({
    name: z.string().trim().min(1).max(80),
    amount: z.coerce.number().min(0),
    kind: z.enum(['earning', 'deduction']),
  })).max(30).optional(),
});
const payrollApproval = z.object({ approvalNote: z.string().trim().max(1000).optional(), status: z.literal('approved').optional() });

function exportSheet(name, headers, rows) {
  return {
    name,
    columns: headers.map(([header, value, width]) => ({ header, value, width })),
    rows,
  };
}

function sendReportWorkbook(res, report, kind) {
  const available = {
    employees: exportSheet('Employees', [
      ['Employee ID', (row) => row.employeeId], ['Name', (row) => row.name], ['Email', (row) => row.email],
      ['Department', (row) => row.department], ['Designation', (row) => row.designation], ['Status', (row) => row.status],
      ['Joining Date', (row) => row.joiningDate], ['Employment Type', (row) => row.employmentType],
    ], report.employees),
    attendance: exportSheet('Attendance', [
      ['Employee', (row) => row.employee?.name], ['Employee ID', (row) => row.employee?.employeeId],
      ['Date', (row) => row.date], ['Check In', (row) => row.checkInTime], ['Check Out', (row) => row.checkOutTime],
      ['Working Minutes', (row) => row.workingHoursMinutes], ['Status', (row) => row.status],
    ], report.attendance),
    leaves: exportSheet('Leaves', [
      ['Employee', (row) => row.employee?.name], ['Leave Type', (row) => row.leaveType?.name],
      ['Start Date', (row) => row.startDate], ['End Date', (row) => row.endDate], ['Days', (row) => row.days],
      ['Status', (row) => row.status], ['Reason', (row) => row.reason],
    ], report.leaves),
    payroll: exportSheet('Payroll', [
      ['Employee', (row) => row.employee?.name], ['Employee ID', (row) => row.employee?.employeeId],
      ['Period', (row) => row.period], ['Currency', (row) => row.currency], ['Gross Pay', (row) => row.grossPay],
      ['Working Days', (row) => row.workingDays], ['Paid Leave Days', (row) => row.paidLeaveDays],
      ['Unpaid Leave Days', (row) => row.unpaidLeaveDays], ['Overtime Minutes', (row) => row.overtimeMinutes],
      ['Proration Deduction', (row) => row.prorationDeduction],
      ['Deductions', (row) => row.totalDeductions], ['Net Pay', (row) => row.netPay], ['Status', (row) => row.status],
    ], report.payroll),
    late: exportSheet('Late Arrivals', [
      ['Employee', (row) => row.employee?.name], ['Employee ID', (row) => row.employee?.employeeId],
      ['Date', (row) => row.date], ['Check In', (row) => row.checkInTime], ['Late Minutes', (row) => row.lateArrivalMinutes],
      ['Status', (row) => row.status],
    ], report.lateAttendance),
    absence: exportSheet('Absences', [
      ['Employee', (row) => row.employee?.name], ['Employee ID', (row) => row.employee?.employeeId],
      ['Date', (row) => row.date], ['Status', (row) => row.status],
    ], report.absenceReport),
    overtime: exportSheet('Overtime', [
      ['Employee', (row) => row.employee?.name], ['Employee ID', (row) => row.employee?.employeeId],
      ['Date', (row) => row.date], ['Overtime Minutes', (row) => row.overtimeMinutes], ['Working Minutes', (row) => row.workingHoursMinutes],
    ], report.overtimeReport),
  };
  const sheetKind = kind === 'employee' ? 'employees'
    : ['daily', 'weekly', 'monthly'].includes(kind) ? 'attendance'
      : kind;
  const sheets = sheetKind && available[sheetKind] ? [available[sheetKind]] : Object.values(available);
  sendWorkbook(res, buildWorkbook(sheets), `hr-${sheetKind || 'reports'}`);
}

exports.dashboard = asyncHandler(async (req, res) => {
  res.json(await hr.getDashboard(req.user));
});

exports.notifications = asyncHandler(async (req, res) => {
  res.json(await hr.listNotifications(req.user));
});

exports.markNotificationRead = asyncHandler(async (req, res) => {
  res.json(await hr.markNotificationRead(req.user, req.params.id));
});

exports.employees = asyncHandler(async (req, res) => {
  res.json(await hr.listEmployees(req.user, req.query));
});

exports.getEmployee = asyncHandler(async (req, res) => {
  res.json(await hr.getEmployee(req.user, req.params.userId));
});

exports.employeeDocuments = asyncHandler(async (req, res) => {
  res.json(await hr.listEmployeeDocuments(req.user, req.params.userId));
});

exports.uploadEmployeeDocument = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.uploadEmployeeDocument(req.user, req.params.userId, req.file, req));
});

exports.downloadEmployeeDocument = asyncHandler(async (req, res, next) => {
  const { document, filePath } = await hr.getEmployeeDocument(req.user, req.params.userId, req.params.documentId);
  const fileName = document.originalName.replace(/["\r\n]/g, '_');
  res.download(filePath, fileName, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

exports.uploadEmployeePhoto = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.uploadEmployeePhoto(req.user, req.params.userId, req.file, req));
});

exports.employeePhoto = asyncHandler(async (req, res, next) => {
  const { document, filePath } = await hr.getEmployeePhoto(req.user, req.params.userId);
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Type', document.mimeType);
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

exports.createEmployee = asyncHandler(async (req, res) => {
  const input = employeeCreate.parse(req.body);
  const result = await hr.createEmployee(req.user, input, req);
  res.status(201).json(result);
});

exports.updateEmployee = asyncHandler(async (req, res) => {
  const input = employeeUpdate.parse(req.body);
  res.json(await hr.updateEmployee(req.user, req.params.userId, input, req));
});

exports.departments = asyncHandler(async (req, res) => {
  res.json(await hr.listDepartments(req.user));
});

exports.createDepartment = asyncHandler(async (req, res) => {
  res.status(201).json(await hr.createDepartment(req.user, departmentCreate.parse(req.body), req));
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  res.json(await hr.updateDepartment(req.user, req.params.id, departmentUpdate.parse(req.body), req));
});

exports.leaves = asyncHandler(async (req, res) => {
  res.json(await hr.getLeaves(req.user, req.query.year));
});

exports.leaveTypes = asyncHandler(async (req, res) => {
  res.json(await hr.getLeaveTypes());
});

exports.createLeaveType = asyncHandler(async (req, res) => {
  const input = leaveTypeInput.parse(req.body);
  res.status(201).json(await hr.createLeaveType(req.user, input, req));
});

exports.updateLeaveType = asyncHandler(async (req, res) => {
  const input = leaveTypeInput.parse({ ...req.body, typeId: req.params.id });
  res.json(await hr.createLeaveType(req.user, input, req));
});

exports.deactivateLeaveType = asyncHandler(async (req, res) => {
  res.json(await hr.deactivateLeaveType(req.user, req.params.id, req));
});

exports.createLeave = asyncHandler(async (req, res) => {
  const action = req.body.action || 'request';
  if (action === 'request') {
    const input = leaveApplication.parse(req.body);
    if (!input.leaveType && !input.leaveTypeId) throw ApiError.badRequest('leaveType or leaveTypeId is required.');
    return res.status(201).json(await hr.createLeaveRequest(req.user, input, req));
  }
  if (action === 'type') {
    return res.status(201).json(await hr.createLeaveType(req.user, leaveTypeInput.parse(req.body), req));
  }
  if (action === 'balance') {
    return res.status(201).json(await hr.setLeaveBalance(req.user, leaveBalanceInput.parse(req.body), req));
  }
  throw ApiError.badRequest('action must be request, type, or balance.');
});

exports.reviewLeave = asyncHandler(async (req, res) => {
  res.json(await hr.reviewLeave(req.user, req.params.id, leaveReview.parse(req.body), req));
});

exports.payroll = asyncHandler(async (req, res) => {
  res.json(await hr.listPayroll(req.user, req.query.period));
});

exports.createPayroll = asyncHandler(async (req, res) => {
  if (req.body.action === 'structure') {
    const input = payrollStructure.parse(req.body);
    return res.status(201).json(await hr.setSalaryStructure(req.user, input, req));
  }
  const input = payrollGenerate.parse(req.body);
  res.status(201).json(await hr.generatePayroll(req.user, input, req));
});

exports.approvePayroll = asyncHandler(async (req, res) => {
  res.json(await hr.approvePayroll(req.user, req.params.id, payrollApproval.parse(req.body || {}), req));
});

exports.salarySlip = asyncHandler(async (req, res) => {
  const runs = await hr.getSalarySlip(req.user, req.params.id);
  const pdf = buildSalarySlipPdf(runs);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="salary-slip-${String(req.params.id).replace(/[^a-z0-9-]/gi, '')}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
});

exports.reports = asyncHandler(async (req, res) => {
  if (req.query.format && !['json', 'xlsx'].includes(req.query.format)) {
    throw ApiError.badRequest('format must be json or xlsx.');
  }
  if (req.query.kind && !['summary', 'employees', 'employee', 'attendance', 'daily', 'weekly', 'monthly', 'leaves', 'payroll', 'late', 'absence', 'overtime'].includes(req.query.kind)) {
    throw ApiError.badRequest('Unsupported HR report kind.');
  }
  const result = await hr.getReports(req.user, req.query);
  if (req.query.format === 'xlsx' || req.forceWorkbook) {
    return sendReportWorkbook(res, result, req.query.kind);
  }
  res.json(result);
});

exports.exportReports = asyncHandler(async (req, res) => {
  if (req.query.kind && !['summary', 'employees', 'employee', 'attendance', 'daily', 'weekly', 'monthly', 'leaves', 'payroll', 'late', 'absence', 'overtime'].includes(req.query.kind)) {
    throw ApiError.badRequest('Unsupported HR report kind.');
  }
  const result = await hr.getReports(req.user, req.query);
  sendReportWorkbook(res, result, req.query.kind);
});

exports.exportReportPdf = asyncHandler(async (req, res) => {
  if (req.query.kind && !['summary', 'employees', 'employee', 'attendance', 'daily', 'weekly', 'monthly', 'leaves', 'payroll', 'late', 'absence', 'overtime'].includes(req.query.kind)) {
    throw ApiError.badRequest('Unsupported HR report kind.');
  }
  const result = await hr.getReports(req.user, req.query);
  const pdf = buildReportPdf(result, req.query.kind);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="gen-vyro-hr-${String(req.query.kind || 'summary').replace(/[^a-z0-9-]/gi, '')}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
});
