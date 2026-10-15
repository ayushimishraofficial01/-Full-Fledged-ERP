const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const fs = require('node:fs/promises');
const { setup, teardown, request } = require('./helpers');
const { Attendance, AuditLog, EmployeeDocument, HRNotification, Setting } = require('../src/models');
const { privateDocumentPath } = require('../src/middleware/upload');
const { runMissingCheckoutReminders } = require('../src/services/attendance-reminder.service');

let app;
let admin;

before(async () => {
  ({ app, agent: admin } = await setup());
});

after(async () => {
  const documents = await EmployeeDocument.find({}).select('storageName').lean();
  await Promise.all(documents.map((document) => {
    const filePath = privateDocumentPath(document.storageName);
    return filePath ? fs.unlink(filePath).catch(() => {}) : Promise.resolve();
  }));
  await teardown();
});

test('HR APIs preserve stable response shapes and permission-filtered employee data', async () => {
  const dashboard = await admin.get('/api/hr/dashboard').expect(200);
  assert.deepEqual(Object.keys(dashboard.body).sort(), ['charts', 'metrics']);
  assert.equal(typeof dashboard.body.metrics.employees, 'number');
  const attendanceDashboard = await admin.get('/api/attendance/dashboard').expect(200);
  assert.equal(typeof attendanceDashboard.body.totals.totalEmployees, 'number');
  assert.ok(attendanceDashboard.body.totals.absentEmployees >= 0);

  const employees = await admin.get('/api/hr/employees').expect(200);
  assert.deepEqual(Object.keys(employees.body).sort(), ['rows', 'users']);

  const departmentResult = await admin.post('/api/hr/departments').send({
    name: 'Engineering', description: 'Product and platform',
  }).expect(201);
  assert.ok(departmentResult.body.departments[0].code);
  const department = departmentResult.body.departments[0];

  const created = await admin.post('/api/hr/employees').send({
    name: 'HR Test Employee',
    email: 'hr.employee@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
  }).expect(201);
  const employeeId = String(created.body.users[0]._id);

  const profile = await admin.put(`/api/hr/employees/${employeeId}`).send({
    employeeId: 'EMP-HR-001',
    department: department.name,
    designation: 'Analyst',
    joiningDate: '2024-03-15',
    employmentType: 'full_time',
    reportingManager: null,
    branch: 'Bengaluru',
    emergencyContact: '9876543210',
    dateOfBirth: '1995-06-20',
    address: 'Bengaluru',
    phone: '9876543210',
    profilePhoto: '/uploads/profile/hr-employee.png',
    salaryStructure: {
      basicSalary: 50000, hra: 10000, allowances: 2500, bonus: 1000, overtimeRate: 100, deductions: 500,
    },
  }).expect(200);
  const employee = profile.body.users[0];
  assert.equal(employee.designation, 'Analyst');
  assert.equal(employee.departmentRef, String(department._id));
  assert.equal(employee.profilePhoto, '/uploads/profile/hr-employee.png');
  assert.equal(employee.salaryStructure.basicSalary, 50000);
  const employeeProfileAgent = request.agent(app);
  await employeeProfileAgent.post('/api/auth/login').send({
    identifier: 'hr.employee@example.com',
    password: 'Passw0rd!Secure',
  }).expect(200);
  const photo = await employeeProfileAgent.post(`/api/hr/employees/${employeeId}/photo`)
    .attach('photo', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), {
      filename: 'profile.png',
      contentType: 'image/png',
    }).expect(201);
  assert.equal(photo.body.profilePhoto, `/api/hr/employees/${employeeId}/photo`);
  const privatePhoto = await employeeProfileAgent.get(`/api/hr/employees/${employeeId}/photo`).expect(200);
  assert.match(privatePhoto.headers['content-type'], /image\/png/);
  assert.equal(privatePhoto.body.length, 8);

  const report = await admin.get('/api/hr/reports').expect(200);
  assert.deepEqual(Object.keys(report.body).sort(), [
    'absenceReport', 'attendance', 'attendanceTrends', 'departmentDistribution', 'employees',
    'lateAttendance', 'leaveTrends', 'leaves', 'payroll', 'payrollSummary', 'overtimeReport', 'summary',
  ].sort());
  assert.ok(report.body.employees.some((row) => String(row._id) === employeeId));
  assert.equal(report.body.summary.employees, report.body.employees.length);
  const employeeReport = await admin.get('/api/hr/reports').query({
    employeeId, department: department.name, kind: 'employee',
  }).expect(200);
  assert.equal(employeeReport.body.employees.length, 1);
  assert.equal(employeeReport.body.employees[0].department, department.name);

  const currentPeriod = new Date().toISOString().slice(0, 7);
  const generated = await admin.post('/api/hr/payroll').send({ period: currentPeriod }).expect(201);
  assert.deepEqual(Object.keys(generated.body).filter((key) => key !== 'generatedCount').sort(), ['rows', 'runs']);
  const payroll = generated.body.runs.find((run) => run.period === currentPeriod);
  assert.ok(payroll);
  assert.equal(payroll.employeeCount, 1);
  assert.equal(payroll.netTotal, 63000);
  assert.ok(payroll.rows[0].workingDays > 0);
  assert.equal(payroll.rows[0].unpaidLeaveDays, 0);
  assert.equal(payroll.rows[0].prorationDeduction, 0);
  await admin.post('/api/hr/payroll').send({ period: currentPeriod }).expect(409);

  const leaves = await admin.get('/api/hr/leaves').expect(200);
  assert.deepEqual(Object.keys(leaves.body).sort(), ['balances', 'requests', 'types']);
  const customType = await admin.post('/api/hr/leaves/types').send({
    name: 'Study Leave', code: 'STUDY', annualAllowance: 5, isPaid: false,
  }).expect(201);
  const studyType = customType.body.types.find((type) => type.code === 'STUDY');
  assert.ok(studyType);
  await admin.put(`/api/hr/leaves/types/${studyType._id}`).send({ annualAllowance: 6 }).expect(200);
  const balance = await admin.post('/api/hr/leaves').send({
    action: 'balance', employeeId, leaveTypeId: studyType._id,
    year: new Date().getUTCFullYear(), allocatedDays: 3,
  }).expect(201);
  assert.ok(balance.body.balances.some((row) => String(row.employee) === employeeId && row.allocatedDays === 3));
  const tomorrow = new Date();
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 2);
  const firstDay = tomorrow.toISOString().slice(0, 10);
  const secondDay = new Date(tomorrow);
  secondDay.setUTCDate(secondDay.getUTCDate() + 1);
  const lastDay = secondDay.toISOString().slice(0, 10);
  const leaveAgent = request.agent(app);
  await leaveAgent.post('/api/auth/login').send({
    identifier: 'hr.employee@example.com',
    password: 'Passw0rd!Secure',
  }).expect(200);
  const leave = await leaveAgent.post('/api/hr/leaves').send({
    leaveType: 'casual', startDate: firstDay, endDate: lastDay, reason: 'Personal time',
  }).expect(201);
  const leaveRequest = leave.body.requests.find((row) => row.reason === 'Personal time');
  assert.ok(leaveRequest);
  const document = await leaveAgent.post(`/api/hr/employees/${employeeId}/documents`)
    .attach('document', Buffer.from('%PDF-1.4\nGen Vyro private employee document\n%%EOF'), {
      filename: 'employment-contract.pdf',
      contentType: 'application/pdf',
    }).expect(201);
  assert.equal(document.body.document.originalName, 'employment-contract.pdf');
  assert.equal(Object.hasOwn(document.body.document, 'storageName'), false);
  const privateDocument = await leaveAgent.get(`/api/hr/employees/${employeeId}/documents/${document.body.document._id}`).expect(200);
  assert.match(privateDocument.headers['content-type'], /application\/pdf/);
  assert.ok(privateDocument.body.length > 10);
  const leaveNotifications = await admin.get('/api/hr/notifications').expect(200);
  assert.ok(leaveNotifications.body.notifications.some((notification) => notification.type === 'leave_request'));

  const existingDay = new Date(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate());
  const originalCheckIn = new Date(existingDay);
  originalCheckIn.setUTCHours(4, 30, 0, 0);
  const originalCheckOut = new Date(existingDay);
  originalCheckOut.setUTCHours(12, 30, 0, 0);
  const existingAttendance = await Attendance.create({
    employee: new mongoose.Types.ObjectId(employeeId),
    employeeName: employee.name,
    employeeId: employee.employeeId,
    department: employee.department,
    date: existingDay,
    checkInTime: originalCheckIn,
    checkOutTime: originalCheckOut,
    workingHoursMinutes: 480,
    status: 'Present',
  });

  await admin.put(`/api/hr/leaves/${leaveRequest._id}/review`).send({ status: 'approved' }).expect(200);
  const employeeNotifications = await leaveAgent.get('/api/hr/notifications').expect(200);
  assert.ok(employeeNotifications.body.notifications.some((notification) => notification.type === 'leave_review'));
  const preserved = await Attendance.findById(existingAttendance._id).lean();
  assert.equal(preserved.status, 'Present');
  assert.equal(preserved.checkInTime.toISOString(), originalCheckIn.toISOString());
  assert.ok(preserved.leaveRequest);
  const addedLeaveDay = await Attendance.findOne({
    employee: employeeId,
    date: new Date(secondDay.getUTCFullYear(), secondDay.getUTCMonth(), secondDay.getUTCDate()),
  }).lean();
  assert.equal(addedLeaveDay.status, 'Leave');

  const unpaidLeaveStart = new Date();
  unpaidLeaveStart.setUTCDate(1);
  unpaidLeaveStart.setUTCMonth(unpaidLeaveStart.getUTCMonth() + 1);
  while (unpaidLeaveStart.getUTCDay() !== 1) unpaidLeaveStart.setUTCDate(unpaidLeaveStart.getUTCDate() + 1);
  const unpaidLeaveEnd = new Date(unpaidLeaveStart);
  unpaidLeaveEnd.setUTCDate(unpaidLeaveEnd.getUTCDate() + 1);
  await admin.post('/api/hr/leaves').send({
    action: 'balance', employeeId, leaveTypeId: studyType._id,
    year: unpaidLeaveStart.getUTCFullYear(), allocatedDays: 2,
  }).expect(201);
  const unpaidLeave = await leaveAgent.post('/api/hr/leaves').send({
    leaveTypeId: studyType._id,
    startDate: unpaidLeaveStart.toISOString().slice(0, 10),
    endDate: unpaidLeaveEnd.toISOString().slice(0, 10),
    reason: 'Payroll proration test',
  }).expect(201);
  const unpaidRequest = unpaidLeave.body.requests.find((row) => row.reason === 'Payroll proration test');
  assert.ok(unpaidRequest);
  await admin.put(`/api/hr/leaves/${unpaidRequest._id}/review`).send({ status: 'approved' }).expect(200);
  const holiday = { date: unpaidLeaveEnd.toISOString().slice(0, 10), name: 'Company holiday' };
  const today = new Date();
  const todayHoliday = {
    date: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    name: 'Today holiday',
  };
  const configuredHolidays = [todayHoliday, holiday].sort((a, b) => a.date.localeCompare(b.date));
  await admin.put('/api/attendance/settings').send({ workDays: [0, 1, 2, 3, 4, 5], holidays: configuredHolidays }).expect(200);
  const attendanceRules = await admin.get('/api/attendance/settings').expect(200);
  assert.deepEqual(attendanceRules.body.rules.workDays, [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(attendanceRules.body.rules.holidays, configuredHolidays);
  assert.equal((await admin.get('/api/attendance/dashboard').expect(200)).body.totals.absentEmployees, 0);
  await admin.put('/api/attendance/settings').send({ workDays: [], holidays: [] }).expect(400);
  await admin.put('/api/attendance/settings').send({
    holidays: [{ date: '2026-02-30', name: 'Invalid date' }],
  }).expect(400);
  const nextPeriod = `${unpaidLeaveStart.getUTCFullYear()}-${String(unpaidLeaveStart.getUTCMonth() + 1).padStart(2, '0')}`;
  const prorated = await admin.post('/api/hr/payroll').send({ period: nextPeriod }).expect(201);
  const proratedPayroll = prorated.body.runs.find((run) => run.period === nextPeriod);
  assert.ok(proratedPayroll);
  assert.equal(proratedPayroll.rows[0].unpaidLeaveDays, 1);
  assert.ok(proratedPayroll.rows[0].prorationDeduction > 0);
  assert.equal(
    proratedPayroll.rows[0].prorationDeduction,
    Math.round((50000 / proratedPayroll.rows[0].workingDays) * 100) / 100,
  );

  await admin.put(`/api/hr/payroll/${payroll._id}/approve`).send({ status: 'approved' }).expect(200);
  const slip = await admin.get(`/api/hr/payroll/${currentPeriod}/salary-slips`).expect(200);
  assert.match(slip.headers['content-type'], /application\/pdf/);
  assert.ok(slip.body.length > 100);

  const exported = await admin.get('/api/hr/reports/export').query({ kind: 'employees' }).expect(200);
  assert.match(exported.headers['content-type'], /spreadsheetml/);
  for (const kind of ['daily', 'weekly', 'monthly', 'late', 'overtime', 'absence', 'leaves', 'payroll']) {
    const reportExport = await admin.get('/api/hr/reports/export').query({ kind }).expect(200);
    assert.match(reportExport.headers['content-type'], /spreadsheetml/);
  }
  for (const kind of ['summary', 'employees', 'attendance', 'leaves', 'payroll', 'late', 'absence', 'overtime']) {
    const pdfReport = await admin.get('/api/hr/reports/export.pdf').query({ kind }).expect(200);
    assert.match(pdfReport.headers['content-type'], /application\/pdf/);
    assert.ok(pdfReport.body.subarray(0, 8).toString().startsWith('%PDF-1.'));
  }

  await admin.post('/api/hr/ai/query').send({ question: 'Summarize attendance' }).expect(404);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const openAttendance = await Attendance.create({
    employee: new mongoose.Types.ObjectId(employeeId),
    employeeName: employee.name,
    employeeId: employee.employeeId,
    department: employee.department,
    date: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()),
    checkInTime: new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 9, 30),
    status: 'Checked In',
  });
  await Setting.findOneAndUpdate({ key: 'attendance.rules' }, {
    key: 'attendance.rules',
    value: { officeEndTime: '00:00', missingCheckoutReminderEnabled: true, missingCheckoutReminderMinutes: 0 },
  }, { upsert: true });
  const reminders = await runMissingCheckoutReminders(new Date());
  assert.ok(reminders.notified >= 1);
  assert.ok(await HRNotification.exists({
    recipient: employeeId,
    type: 'attendance_missing_checkout',
    relatedId: openAttendance._id,
  }));
  await admin.delete(`/api/hr/leaves/types/${studyType._id}`).expect(200);
});

test('employees can be created with an Employee ID and documents are available in their profile', async () => {
  const created = await admin.post('/api/access/users').send({
    name: 'Documented Employee',
    email: 'documented.employee@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
    employeeId: 'EMP-DOC-001',
  }).expect(201);
  const employeeId = String(created.body.user.id);
  assert.equal(created.body.user.employeeId, 'EMP-DOC-001');
  await admin.post('/api/access/users').send({
    name: 'Duplicate ID Employee',
    email: 'duplicate.employee@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
    employeeId: 'EMP-DOC-001',
  }).expect(409);

  const uploaded = await admin.post(`/api/hr/employees/${employeeId}/documents`)
    .attach('document', Buffer.from('%PDF-1.4\nNew employee identity document\n%%EOF'), {
      filename: 'identity-document.pdf',
      contentType: 'application/pdf',
    }).expect(201);
  assert.equal(uploaded.body.document.originalName, 'identity-document.pdf');

  const profile = await admin.get(`/api/hr/employees/${employeeId}`).expect(200);
  assert.equal(profile.body.users[0].employeeId, 'EMP-DOC-001');
  const documents = await admin.get(`/api/hr/employees/${employeeId}/documents`).expect(200);
  assert.ok(documents.body.documents.some((document) => String(document._id) === String(uploaded.body.document._id)));
});

test('employee HR permissions are self-scoped and status changes invalidate sessions', async () => {
  const created = await admin.post('/api/hr/employees').send({
    name: 'Self Scope Employee',
    email: 'self.scope@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
  }).expect(201);
  const employeeId = String(created.body.users[0]._id);
  const employee = request.agent(app);
  await employee.post('/api/auth/login').send({
    identifier: 'self.scope@example.com',
    password: 'Passw0rd!Secure',
  }).expect(200);

  const self = await employee.get(`/api/hr/employees/${employeeId}`).expect(200);
  assert.equal(self.body.users[0].email, 'self.scope@example.com');
  assert.equal(self.body.users[0].salaryStructure, null);
  await employee.get('/api/hr/employees').expect(200);
  const attendance = await employee.get('/api/attendance/employees').expect(200);
  assert.deepEqual(attendance.body.users.map((user) => String(user._id)), [employeeId]);
  const checkedIn = await employee.post('/api/attendance/check-in').send({}).expect(201);
  const lateMinutesAtCheckIn = checkedIn.body.record.lateMinutes;
  const checkedOut = await employee.post('/api/attendance/check-out').send({}).expect(200);
  assert.equal(checkedOut.body.record.lateMinutes, lateMinutesAtCheckIn);
  const reportRange = {
    fromDate: new Date().toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
  };
  const attendanceWorkbook = await employee.get('/api/attendance/reports/export')
    .query({ ...reportRange, format: 'xlsx' }).expect(200);
  assert.match(attendanceWorkbook.headers['content-type'], /spreadsheetml/);
  const attendanceRows = await employee.get('/api/attendance/reports').query(reportRange).expect(200);
  assert.equal(attendanceRows.body.records.length, 1);
  await employee.get('/api/attendance/reports').query({ fromDate: '2026-02-30', toDate: reportRange.toDate }).expect(400);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  await employee.get('/api/attendance/reports').query({
    fromDate: reportRange.fromDate, toDate: `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`,
  }).expect(400);
  const attendancePdf = await employee.get('/api/attendance/reports/export')
    .query({ ...reportRange, format: 'pdf' }).expect(200);
  assert.match(attendancePdf.headers['content-type'], /application\/pdf/);
  assert.ok(attendancePdf.body.subarray(0, 8).toString().startsWith('%PDF-1.'));
  const notifications = await employee.get('/api/hr/notifications').expect(200);
  assert.ok(notifications.body.notifications.some((notification) => ['attendance_checkin', 'attendance_late'].includes(notification.type)));

  const adminUserId = (await admin.get('/api/auth/me').expect(200)).body.user.id;
  await employee.get(`/api/hr/employees/${adminUserId}`).expect(403);
  await admin.put(`/api/hr/employees/${employeeId}`).send({ status: 'inactive' }).expect(200);
  await employee.get(`/api/hr/employees/${employeeId}`).expect(401);
});

test('attendance supports audited manual entries and corrections with validated time ranges', async () => {
  const created = await admin.post('/api/hr/employees').send({
    name: 'Attendance Admin Test',
    email: 'attendance.admin.test@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
  }).expect(201);
  const employeeId = String(created.body.users[0]._id);
  const date = '2026-06-12';
  const rejected = await admin.post('/api/attendance/manual').send({
    employee: employeeId,
    date,
    status: 'Present',
  }).expect(400);
  assert.match(rejected.body.message, /reason/i);

  const manual = await admin.post('/api/attendance/manual').send({
    employee: employeeId,
    date,
    checkInTime: '2026-06-12T09:30:00.000Z',
    checkOutTime: '2026-06-12T17:30:00.000Z',
    status: 'Present',
    correctionReason: 'Approved paper attendance sheet',
  }).expect(201);
  const attendanceId = String(manual.body.record._id);
  assert.equal(manual.body.record.workingHoursMinutes, 480);
  await admin.post('/api/attendance/manual').send({
    employee: employeeId,
    date,
    status: 'Absent',
    correctionReason: 'Duplicate test',
  }).expect(409);
  const recordsBeforeCorrection = await Attendance.find({ employee: employeeId }).select('_id date').lean();
  assert.equal(recordsBeforeCorrection.length, 1, JSON.stringify(recordsBeforeCorrection));

  const corrected = await admin.put(`/api/attendance/${attendanceId}`).send({
    date: '2026-06-13',
    checkInTime: '2026-06-13T09:30:00.000Z',
    checkOutTime: '2026-06-13T18:30:00.000Z',
    status: 'Present',
    correctionReason: 'Corrected from supervisor-approved timesheet',
  });
  assert.equal(corrected.status, 200, corrected.body.message);
  const filteredHistory = await admin.get('/api/attendance/employees').query({
    fromDate: '2026-06-13',
    toDate: '2026-06-13',
    department: 'General',
    status: 'Present',
  }).expect(200);
  assert.equal(filteredHistory.body.rows.length, 1);
  assert.equal(String(filteredHistory.body.rows[0].employee._id), employeeId);
  await admin.get('/api/attendance/employees').query({
    fromDate: '2026-06-14',
    toDate: '2026-06-13',
  }).expect(400);
  await admin.put(`/api/attendance/${attendanceId}`).send({
    checkInTime: null,
    checkOutTime: '2026-06-13T18:30:00.000Z',
    correctionReason: 'Invalid checkout without check-in',
  }).expect(400);
  const auditEntries = await AuditLog.find({ targetUser: employeeId }).lean();
  assert.ok(auditEntries.some((entry) => entry.action === 'ATTENDANCE_MANUALLY_ADDED'));
  assert.ok(auditEntries.some((entry) => entry.action === 'ATTENDANCE_CORRECTED'));
  assert.ok(auditEntries.filter((entry) => entry.action.startsWith('ATTENDANCE_')).every((entry) => entry.metadata.correctionReason));
});

test('manager access is limited to direct reports and safe default HR grants', async () => {
  const manager = await admin.post('/api/hr/employees').send({
    name: 'HR Manager',
    email: 'hr.manager@example.com',
    password: 'Passw0rd!Secure',
    role: 'manager',
  }).expect(201);
  const report = await admin.post('/api/hr/employees').send({
    name: 'Direct Report',
    email: 'direct.report@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
    reportingManager: manager.body.users[0]._id,
  }).expect(201);
  const unassigned = await admin.post('/api/hr/employees').send({
    name: 'Unassigned Employee',
    email: 'unassigned@example.com',
    password: 'Passw0rd!Secure',
    role: 'user',
  }).expect(201);

  const managerAgent = request.agent(app);
  await managerAgent.post('/api/auth/login').send({
    identifier: 'hr.manager@example.com',
    password: 'Passw0rd!Secure',
  }).expect(200);
  const visible = await managerAgent.get('/api/hr/employees').expect(200);
  assert.deepEqual(
    new Set(visible.body.users.map((user) => String(user._id))),
    new Set([String(manager.body.users[0]._id), String(report.body.users[0]._id)])
  );
  const attendance = await managerAgent.get('/api/attendance/employees').expect(200);
  assert.deepEqual(
    new Set(attendance.body.users.map((user) => String(user._id))),
    new Set([String(manager.body.users[0]._id), String(report.body.users[0]._id)])
  );
  await managerAgent.get(`/api/hr/employees/${unassigned.body.users[0]._id}`).expect(403);
  await managerAgent.put(`/api/hr/employees/${report.body.users[0]._id}`).send({ designation: 'Team Analyst' }).expect(200);
  await managerAgent.post('/api/hr/departments').send({ name: 'Forbidden Department' }).expect(403);
  await managerAgent.get('/api/hr/payroll').expect(403);
  await managerAgent.put(`/api/hr/leaves/${new mongoose.Types.ObjectId()}/review`).send({ status: 'approved' }).expect(403);
});
