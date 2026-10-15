const Attendance = require('../models/Attendance');
const User = require('../models/User');
const Setting = require('../models/Setting');
const HRNotification = require('../models/HRNotification');
const AuditLog = require('../models/AuditLog');
const { sendMail, isEmailConfigured } = require('../services/email.service');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { userScope, assertCanAccessEmployee } = require('../services/hr.service');
const { buildWorkbook, sendWorkbook } = require('../services/export.service');
const { buildReportPdf } = require('../services/hr-pdf.service');

async function notifyAttendance(employeeId, actorId, type, message, recordId) {
  const notification = await HRNotification.findOneAndUpdate(
    { recipient: employeeId, type, relatedId: recordId },
    {
      $set: {
        actor: actorId,
        message,
        readAt: null,
        emailStatus: isEmailConfigured() ? 'pending' : 'not_configured',
      },
      $setOnInsert: { recipient: employeeId, type, relatedId: recordId },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  if (!isEmailConfigured()) return;
  const employee = await User.findById(employeeId).select('name email').lean();
  try {
    if (!employee?.email) throw new Error('Attendance notification recipient has no email address.');
    await sendMail({ to: employee.email, subject: 'Gen Vyro attendance update', text: `Hi ${employee.name},\n\n${message}` });
    notification.emailStatus = 'delivered';
  } catch (error) {
    notification.emailStatus = 'failed';
    console.error(`Unable to deliver attendance notification ${notification._id}:`, error);
  }
  await notification.save();
}

const DEFAULT_RULES = {
  officeStartTime: '09:30',
  officeEndTime: '18:30',
  gracePeriod: 15,
  halfDayThresholdMinutes: 240,
  overtimeThresholdMinutes: 540,
  missingCheckoutReminderEnabled: true,
  missingCheckoutReminderMinutes: 60,
  workDays: [1, 2, 3, 4, 5],
  holidays: [],
};

function parseTimeToMinutes(value) {
  if (!value || typeof value !== 'string') return 0;
  const [hours, minutes] = value.split(':').map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  return (hours * 60) + minutes;
}

function toDateOnly(date) {
  const base = new Date(date);
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function isValidDateOnly(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseAttendanceDate(value, fieldName = 'date') {
  if (typeof value === 'string') {
    if (!isValidDateOnly(value)) throw ApiError.badRequest(`${fieldName} must be a valid YYYY-MM-DD date.`);
    return new Date(Number(value.slice(0, 4)), Number(value.slice(5, 7)) - 1, Number(value.slice(8, 10)));
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`${fieldName} must be a valid date.`);
  return date;
}

function parseAttendanceTime(value, fieldName) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw ApiError.badRequest(`${fieldName} must be a valid date and time.`);
  return date;
}

function diffMinutes(start, end) {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

async function getAttendanceRules() {
  const setting = await Setting.findOne({ key: 'attendance.rules' }).lean();
  return { ...DEFAULT_RULES, ...(setting?.value || {}) };
}

function statusFromRecord(record, rules) {
  if (!record) return 'Absent';
  if (!record.checkInTime && !record.checkOutTime) return record.status || 'Absent';
  if (record.checkInTime && !record.checkOutTime) return record.status === 'Late' ? 'Late' : 'Checked In';
  if (['Present', 'Late', 'Absent', 'Half Day', 'Leave'].includes(record.status)) return record.status;
  if (!record.checkOutTime) return 'Checked Out';
  if (record.workingHoursMinutes < rules.halfDayThresholdMinutes) return 'Half Day';
  if (record.lateMinutes > 0) return 'Late';
  return 'Present';
}

function isScheduledWorkday(date, rules) {
  const day = date.getDay();
  const dateString = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const workDays = Array.isArray(rules.workDays) && rules.workDays.length ? rules.workDays : DEFAULT_RULES.workDays;
  const holidays = Array.isArray(rules.holidays) ? rules.holidays : [];
  return workDays.includes(day) && !holidays.some((holiday) => holiday.date === dateString);
}

function buildEmployeeSummary(employee, record, rules) {
  const status = statusFromRecord(record, rules);
  return {
    _id: employee._id,
    name: employee.name,
    email: employee.email,
    role: employee.role,
    department: employee.department || 'General',
    employeeId: employee.employeeId || '',
    status,
    checkInTime: record?.checkInTime || null,
    checkOutTime: record?.checkOutTime || null,
    workingHoursMinutes: record?.workingHoursMinutes || 0,
    lateMinutes: record?.lateMinutes || 0,
  };
}

async function visibleEmployeeIds(actor) {
  const employees = await User.find(userScope(actor)).select('_id').lean();
  return employees.map((employee) => employee._id);
}

exports.getDashboard = asyncHandler(async (req, res) => {
  const rules = await getAttendanceRules();
  const today = toDateOnly(new Date());
  const activeUsers = await User.find({ ...userScope(req.user), status: 'active' }).select('_id').lean();
  const employeeIds = activeUsers.map((employee) => employee._id);
  const attendanceRows = await Attendance.find({ employee: { $in: employeeIds }, date: today }).populate('employee', 'name email role department employeeId').sort({ checkInTime: 1 }).lean();

  const stats = attendanceRows.reduce((acc, row) => {
    const status = statusFromRecord(row, rules);
    acc.total += 1;
    if (status === 'Present' || status === 'Late') acc.present += 1;
    if (status === 'Checked In') acc.checkedIn += 1;
    if (status === 'Checked Out') acc.checkedOut += 1;
    if (status === 'Late') acc.late += 1;
    if (status === 'Absent') acc.absent += 1;
    acc.totalMinutes += Number(row.workingHoursMinutes || 0);
    return acc;
  }, { total: 0, present: 0, checkedIn: 0, checkedOut: 0, late: 0, absent: 0, totalMinutes: 0 });

  res.json({
    settings: rules,
    totals: {
      totalEmployees: activeUsers.length,
      presentToday: stats.present,
      checkedIn: stats.checkedIn,
      checkedOut: stats.checkedOut,
      lateEmployees: stats.late,
      absentEmployees: isScheduledWorkday(today, rules) ? Math.max(0, activeUsers.length - stats.total) : 0,
      averageWorkingHours: stats.total ? (stats.totalMinutes / stats.total) / 60 : 0,
    },
    rows: attendanceRows.map((row) => ({
      _id: row._id,
      employee: row.employee || { name: row.employeeName },
      employeeName: row.employeeName,
      employeeId: row.employeeId,
      department: row.department,
      date: row.date,
      checkInTime: row.checkInTime,
      checkOutTime: row.checkOutTime,
      workingHoursMinutes: row.workingHoursMinutes || 0,
      status: statusFromRecord(row, rules),
      lateMinutes: row.lateMinutes || 0,
    })),
  });
});

exports.getMyAttendance = asyncHandler(async (req, res) => {
  const startDate = req.query.startDate ? parseAttendanceDate(req.query.startDate, 'startDate') : toDateOnly(new Date());
  const endDate = req.query.endDate ? parseAttendanceDate(req.query.endDate, 'endDate') : new Date(startDate);
  if (startDate > endDate) throw ApiError.badRequest('startDate must be on or before endDate.');
  const records = await Attendance.find({
    employee: req.user._id,
    date: {
      $gte: toDateOnly(startDate),
      $lte: new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999),
    },
  }).sort({ date: -1 }).lean();

  const rules = await getAttendanceRules();
  res.json({ rows: records.map((record) => ({ ...record, status: statusFromRecord(record, rules) })) });
});

exports.getEmployeeRecords = asyncHandler(async (req, res) => {
  const targetUserId = req.params.userId || req.user._id;
  await assertCanAccessEmployee(req.user, targetUserId);
  const date = req.query.date ? new Date(req.query.date) : new Date();
  const start = toDateOnly(date);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 23, 59, 59, 999);

  const records = await Attendance.find({
    employee: targetUserId,
    date: { $gte: start, $lte: end },
  }).sort({ date: -1 }).lean();

  const rules = await getAttendanceRules();
  res.json({ rows: records.map((record) => ({ ...record, status: statusFromRecord(record, rules) })) });
});

exports.listEmployees = asyncHandler(async (req, res) => {
  const { status, department, employeeId, fromDate, toDate } = req.query;
  const from = fromDate ? parseAttendanceDate(fromDate, 'fromDate') : null;
  const to = toDate ? parseAttendanceDate(toDate, 'toDate') : null;
  if (from && to && from > to) throw ApiError.badRequest('fromDate must be on or before toDate.');
  const queryUsers = { ...userScope(req.user), status: 'active' };
  if (department) queryUsers.department = department;
  if (employeeId) queryUsers.employeeId = { $regex: employeeId, $options: 'i' };
  const users = await User.find(queryUsers).select('_id name email role department employeeId').sort({ name: 1 }).lean();

  const userIds = users.map((user) => user._id);
  if (!userIds.length) {
    return res.json({ users: [], rows: [], pagination: { total: 0, page: 1, totalPages: 1 } });
  }

  const attendanceFilter = { employee: { $in: userIds } };
  if (fromDate || toDate) {
    attendanceFilter.date = {};
    if (from) attendanceFilter.date.$gte = toDateOnly(from);
    if (to) attendanceFilter.date.$lte = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999);
  }

  const records = await Attendance.find(attendanceFilter)
    .populate('employee', 'name email role department employeeId')
    .sort({ date: -1, checkInTime: 1 })
    .lean();

  const rules = await getAttendanceRules();
  const rows = records.map((record) => ({
    ...record,
    status: statusFromRecord(record, rules),
    employeeSummary: record.employee ? { name: record.employee.name, email: record.employee.email, department: record.employee.department || 'General', employeeId: record.employee.employeeId || '', role: record.employee.role } : null,
  })).filter((record) => !status || record.status === status);

  res.json({
    users: users.map((user) => buildEmployeeSummary(user, rows.find((row) => String(row.employee) === String(user._id)), rules)),
    rows,
    pagination: { total: rows.length, page: 1, totalPages: 1 },
  });
});

exports.getCalendar = asyncHandler(async (req, res) => {
  const monthDate = req.query.month ? new Date(req.query.month) : new Date();
  const start = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const end = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0, 23, 59, 59, 999);
  const employeeIds = await visibleEmployeeIds(req.user);
  const records = await Attendance.find({ employee: { $in: employeeIds }, date: { $gte: start, $lte: end } }).populate('employee', 'name').lean();
  const rules = await getAttendanceRules();
  res.json({ days: records.map((record) => ({ ...record, status: statusFromRecord(record, rules) })) });
});

async function collectAttendanceReport(user, query) {
  const { fromDate, toDate } = query;
  if ((fromDate && !isValidDateOnly(fromDate)) || (toDate && !isValidDateOnly(toDate))) {
    throw ApiError.badRequest('fromDate and toDate must use valid YYYY-MM-DD dates.');
  }
  const from = fromDate
    ? new Date(Number(fromDate.slice(0, 4)), Number(fromDate.slice(5, 7)) - 1, Number(fromDate.slice(8, 10)))
    : toDateOnly(new Date());
  const to = toDate
    ? new Date(Number(toDate.slice(0, 4)), Number(toDate.slice(5, 7)) - 1, Number(toDate.slice(8, 10)), 23, 59, 59, 999)
    : new Date(from.getFullYear(), from.getMonth() + 1, 0, 23, 59, 59, 999);
  if (from > to) throw ApiError.badRequest('fromDate must be on or before toDate.');
  const employeeIds = await visibleEmployeeIds(user);
  const records = await Attendance.find({ employee: { $in: employeeIds }, date: { $gte: from, $lte: to } }).sort({ date: -1 }).lean();
  const rules = await getAttendanceRules();
  const reportRecords = records.map((record) => ({ ...record, status: statusFromRecord(record, rules) }));
  return {
    records: reportRecords,
    summary: {
      total: records.length,
      present: records.filter((row) => ['Present', 'Late'].includes(statusFromRecord(row, rules))).length,
      late: records.filter((row) => statusFromRecord(row, rules) === 'Late').length,
      halfDay: records.filter((row) => statusFromRecord(row, rules) === 'Half Day').length,
      absent: records.filter((row) => statusFromRecord(row, rules) === 'Absent').length,
    },
  };
}

exports.getReports = asyncHandler(async (req, res) => {
  res.json(await collectAttendanceReport(req.user, req.query));
});

exports.exportReports = asyncHandler(async (req, res) => {
  const format = req.query.format || 'xlsx';
  if (!['xlsx', 'pdf'].includes(format)) throw ApiError.badRequest('format must be xlsx or pdf.');
  const report = await collectAttendanceReport(req.user, req.query);
  if (format === 'pdf') {
    const pdf = buildReportPdf({
      attendance: report.records.map((record) => ({
        ...record,
        employee: { name: record.employeeName, employeeId: record.employeeId },
      })),
      summary: report.summary,
    }, 'attendance');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="gen-vyro-attendance-report.pdf"');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(pdf);
  }
  const workbook = await buildWorkbook([{
    name: 'Attendance',
    columns: [
      { header: 'Employee', value: (row) => row.employeeName },
      { header: 'Employee ID', value: (row) => row.employeeId },
      { header: 'Department', value: (row) => row.department },
      { header: 'Date', value: (row) => row.date },
      { header: 'Check In', value: (row) => row.checkInTime },
      { header: 'Check Out', value: (row) => row.checkOutTime },
      { header: 'Working Minutes', value: (row) => row.workingHoursMinutes },
      { header: 'Overtime Minutes', value: (row) => row.overtimeMinutes },
      { header: 'Status', value: (row) => row.status },
    ],
    rows: report.records,
  }]);
  sendWorkbook(res, workbook, 'attendance-report');
});

exports.checkIn = asyncHandler(async (req, res) => {
  const employee = req.user;
  const todayStart = toDateOnly(new Date());
  const existingRecord = await Attendance.findOne({ employee: employee._id, date: todayStart });
  if (existingRecord?.leaveRequest || existingRecord?.status === 'Leave') {
    throw ApiError.conflict('You have approved leave for today and cannot check in.');
  }
  if (existingRecord && existingRecord.checkInTime && !existingRecord.checkOutTime) {
    throw ApiError.conflict('You already checked in for today. Please check out before checking in again.');
  }
  if (existingRecord && existingRecord.checkOutTime) {
    throw ApiError.conflict('Your attendance for today has already been completed.');
  }

  const rules = await getAttendanceRules();
  const checkInMoment = new Date();
  const startMinutes = parseTimeToMinutes(rules.officeStartTime);
  const currentMinutes = (checkInMoment.getHours() * 60) + checkInMoment.getMinutes();
  const lateMinutes = Math.max(0, currentMinutes - (startMinutes + rules.gracePeriod));
  const photo = req.file?.filename || '';
  const record = await Attendance.create({
    employee: employee._id,
    employeeName: employee.name,
    employeeId: employee.employeeId || `EMP-${String(employee._id).slice(-6).toUpperCase()}`,
    department: employee.department || 'General',
    date: todayStart,
    checkInTime: checkInMoment,
    status: lateMinutes > 0 ? 'Late' : 'Checked In',
    lateMinutes,
    location: req.body.location || '',
    photo,
    deviceInfo: req.body.deviceInfo || '',
    ipAddress: req.body.ipAddress || '',
    createdBy: employee._id,
    updatedBy: employee._id,
  });
  const time = checkInMoment.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await notifyAttendance(
    employee._id,
    employee._id,
    lateMinutes > 0 ? 'attendance_late' : 'attendance_checkin',
    lateMinutes > 0
      ? `You checked in late at ${time} (${lateMinutes} minute(s) late).`
      : `You checked in successfully at ${time}.`,
    record._id
  );

  res.status(201).json({ message: `You checked in successfully at ${checkInMoment.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, record: { ...record.toObject(), status: statusFromRecord(record.toObject(), rules) } });
});

exports.checkOut = asyncHandler(async (req, res) => {
  const todayStart = toDateOnly(new Date());
  const record = await Attendance.findOne({
    employee: req.user._id,
    date: todayStart,
    checkInTime: { $ne: null },
    checkOutTime: null,
    leaveRequest: null,
  }).sort({ checkInTime: -1 });
  if (!record) {
    throw ApiError.badRequest('Checkout is only allowed after a successful check-in.');
  }

  const rules = await getAttendanceRules();
  const now = new Date();
  const workingMinutes = diffMinutes(record.checkInTime, now);
  const officeStartMinutes = parseTimeToMinutes(rules.officeStartTime);
  const officeEndMinutes = parseTimeToMinutes(rules.officeEndTime);
  const checkInMinutes = (record.checkInTime.getHours() * 60) + record.checkInTime.getMinutes();
  const currentMinutes = (now.getHours() * 60) + now.getMinutes();
  const overtimeMinutes = Math.max(0, workingMinutes - rules.overtimeThresholdMinutes);
  const lateMinutes = Math.max(0, checkInMinutes - (officeStartMinutes + rules.gracePeriod));
  const earlyCheckoutMinutes = Math.max(0, officeEndMinutes - currentMinutes);
  const nextStatus = workingMinutes < rules.halfDayThresholdMinutes ? 'Half Day' : (lateMinutes > 0 ? 'Late' : 'Present');

  record.checkOutTime = now;
  record.workingHoursMinutes = workingMinutes;
  record.overtimeMinutes = overtimeMinutes;
  record.earlyCheckoutMinutes = earlyCheckoutMinutes;
  record.lateMinutes = lateMinutes;
  record.status = nextStatus;
  record.location = req.body.location || record.location || '';
  record.photo = req.file?.filename || record.photo || '';
  record.deviceInfo = req.body.deviceInfo || record.deviceInfo || '';
  record.ipAddress = req.body.ipAddress || record.ipAddress || '';
  record.updatedBy = req.user._id;
  await record.save();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  await notifyAttendance(
    req.user._id,
    req.user._id,
    earlyCheckoutMinutes > 0 ? 'attendance_early_checkout' : 'attendance_checkout',
    earlyCheckoutMinutes > 0
      ? `You checked out early at ${time} (${earlyCheckoutMinutes} minute(s) early).`
      : `You checked out successfully at ${time}.`,
    record._id
  );

  res.json({ message: 'You checked out successfully.', record: { ...record.toObject(), status: statusFromRecord(record.toObject(), rules) } });
});

exports.updateAttendance = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const record = await Attendance.findById(id);
  if (!record) throw ApiError.notFound('Attendance record not found.');

  await assertCanAccessEmployee(req.user, record.employee);
  if (record.leaveRequest) throw ApiError.conflict('Attendance linked to approved leave cannot be manually edited.');

  const rules = await getAttendanceRules();
  const previous = record.toObject();
  const date = Object.hasOwn(req.body, 'date') ? toDateOnly(parseAttendanceDate(req.body.date)) : record.date;
  const checkInTime = Object.hasOwn(req.body, 'checkInTime') ? parseAttendanceTime(req.body.checkInTime, 'checkInTime') : record.checkInTime;
  const checkOutTime = Object.hasOwn(req.body, 'checkOutTime') ? parseAttendanceTime(req.body.checkOutTime, 'checkOutTime') : record.checkOutTime;
  const correctionReason = typeof req.body.correctionReason === 'string' ? req.body.correctionReason.trim() : '';
  if (!correctionReason) throw ApiError.badRequest('A reason for the attendance correction is required.');
  if (checkOutTime && !checkInTime) throw ApiError.badRequest('Checkout time cannot be set without a check-in time.');
  if (checkInTime && checkOutTime && checkOutTime < checkInTime) {
    throw ApiError.badRequest('Checkout time must be after check-in time.');
  }
  const validStatuses = ['Present', 'Late', 'Absent', 'Checked In', 'Checked Out', 'Half Day', 'Leave'];
  if (req.body.status && !validStatuses.includes(req.body.status)) throw ApiError.badRequest('Attendance status is invalid.');

  const update = {
    employeeName: req.body.employeeName || record.employeeName,
    employeeId: req.body.employeeId || record.employeeId,
    department: req.body.department || record.department,
    date,
    checkInTime,
    checkOutTime,
    status: req.body.status || record.status,
    correctionReason,
    notes: req.body.notes || record.notes,
    updatedBy: req.user._id,
  };

  const duplicate = await Attendance.exists({ employee: record.employee, date, _id: { $ne: record._id } });
  if (duplicate) throw ApiError.conflict('An attendance record already exists for this employee on the selected date.');

  if (update.checkInTime && update.checkOutTime) {
    const minutes = diffMinutes(update.checkInTime, update.checkOutTime);
    update.workingHoursMinutes = minutes;
    update.lateMinutes = Math.max(0, ((update.checkInTime.getHours() * 60) + update.checkInTime.getMinutes()) - (parseTimeToMinutes(rules.officeStartTime) + rules.gracePeriod));
    update.earlyCheckoutMinutes = Math.max(0, parseTimeToMinutes(rules.officeEndTime) - ((update.checkOutTime.getHours() * 60) + update.checkOutTime.getMinutes()));
    update.overtimeMinutes = Math.max(0, minutes - rules.overtimeThresholdMinutes);
  } else if (!update.checkInTime) {
    update.workingHoursMinutes = 0;
    update.overtimeMinutes = 0;
    update.lateMinutes = 0;
    update.earlyCheckoutMinutes = 0;
  } else {
    update.workingHoursMinutes = 0;
    update.overtimeMinutes = 0;
    update.lateMinutes = Math.max(0, ((update.checkInTime.getHours() * 60) + update.checkInTime.getMinutes()) - (parseTimeToMinutes(rules.officeStartTime) + rules.gracePeriod));
    update.earlyCheckoutMinutes = 0;
  }

  Object.assign(record, update);
  await record.save();
  await AuditLog.create({
    actor: req.user._id,
    targetUser: record.employee,
    action: 'ATTENDANCE_CORRECTED',
    ip: req.ip || '',
    metadata: {
      attendanceId: String(record._id),
      correctionReason,
      previous: {
        date: previous.date,
        checkInTime: previous.checkInTime,
        checkOutTime: previous.checkOutTime,
        status: previous.status,
      },
      updated: {
        date: record.date,
        checkInTime: record.checkInTime,
        checkOutTime: record.checkOutTime,
        status: record.status,
      },
    },
  });
  await notifyAttendance(
    record.employee,
    req.user._id,
    'attendance_corrected',
    'An administrator or manager corrected your attendance record.',
    record._id
  );

  res.json({ message: 'Attendance record updated successfully.', record: { ...record.toObject(), status: statusFromRecord(record.toObject(), rules) } });
});

exports.createManualAttendance = asyncHandler(async (req, res) => {
  const employee = await User.findById(req.body.employee).lean();
  if (!employee) throw ApiError.notFound('Employee not found.');
  await assertCanAccessEmployee(req.user, employee._id);

  const dateValue = toDateOnly(parseAttendanceDate(req.body.date || new Date()));
  const existing = await Attendance.findOne({ employee: employee._id, date: dateValue });
  if (existing) throw ApiError.conflict('An attendance record already exists for this employee on the selected date.');

  const checkIn = parseAttendanceTime(req.body.checkInTime, 'checkInTime');
  const checkOut = parseAttendanceTime(req.body.checkOutTime, 'checkOutTime');
  const status = req.body.status || 'Present';
  const correctionReason = typeof req.body.correctionReason === 'string' ? req.body.correctionReason.trim() : '';
  if (!correctionReason) throw ApiError.badRequest('A reason for the attendance entry is required.');
  if (checkOut && !checkIn) throw ApiError.badRequest('Checkout time cannot be set without a check-in time.');
  if (checkIn && checkOut && checkOut < checkIn) throw ApiError.badRequest('Checkout time must be after check-in time.');
  if (!['Present', 'Late', 'Absent', 'Checked In', 'Checked Out', 'Half Day', 'Leave'].includes(status)) {
    throw ApiError.badRequest('Attendance status is invalid.');
  }
  const rules = await getAttendanceRules();
  const workingHoursMinutes = checkIn && checkOut ? diffMinutes(checkIn, checkOut) : 0;
  const lateMinutes = checkIn
    ? Math.max(0, ((checkIn.getHours() * 60) + checkIn.getMinutes()) - (parseTimeToMinutes(rules.officeStartTime) + rules.gracePeriod))
    : 0;
  const earlyCheckoutMinutes = checkOut
    ? Math.max(0, parseTimeToMinutes(rules.officeEndTime) - ((checkOut.getHours() * 60) + checkOut.getMinutes()))
    : 0;
  const attendance = await Attendance.create({
    employee: employee._id,
    employeeName: employee.name,
    employeeId: employee.employeeId || `EMP-${String(employee._id).slice(-6).toUpperCase()}`,
    department: employee.department || 'General',
    date: dateValue,
    checkInTime: checkIn,
    checkOutTime: checkOut,
    workingHoursMinutes,
    overtimeMinutes: Math.max(0, workingHoursMinutes - rules.overtimeThresholdMinutes),
    lateMinutes,
    earlyCheckoutMinutes,
    status,
    correctionReason,
    notes: req.body.notes || '',
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });
  await AuditLog.create({
    actor: req.user._id,
    targetUser: employee._id,
    action: 'ATTENDANCE_MANUALLY_ADDED',
    ip: req.ip || '',
    metadata: {
      attendanceId: String(attendance._id),
      correctionReason,
      date: attendance.date,
      status: attendance.status,
    },
  });
  await notifyAttendance(
    employee._id,
    req.user._id,
    'attendance_corrected',
    'An administrator or manager added an attendance record for you.',
    attendance._id
  );

  res.status(201).json({ message: 'Attendance record created successfully.', record: attendance });
});

exports.getSettings = asyncHandler(async (req, res) => {
  const rules = await getAttendanceRules();
  res.json({ rules });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const existingRules = await getAttendanceRules();
  const payload = {
    officeStartTime: req.body.officeStartTime ?? existingRules.officeStartTime,
    officeEndTime: req.body.officeEndTime ?? existingRules.officeEndTime,
    gracePeriod: Number(req.body.gracePeriod ?? existingRules.gracePeriod),
    halfDayThresholdMinutes: Number(req.body.halfDayThresholdMinutes ?? existingRules.halfDayThresholdMinutes),
    overtimeThresholdMinutes: Number(req.body.overtimeThresholdMinutes ?? existingRules.overtimeThresholdMinutes),
    missingCheckoutReminderEnabled: req.body.missingCheckoutReminderEnabled ?? existingRules.missingCheckoutReminderEnabled,
    missingCheckoutReminderMinutes: Number(req.body.missingCheckoutReminderMinutes ?? existingRules.missingCheckoutReminderMinutes),
    workDays: req.body.workDays ?? existingRules.workDays,
    holidays: req.body.holidays ?? existingRules.holidays,
  };
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(payload.officeStartTime) ||
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(payload.officeEndTime)) {
    throw ApiError.badRequest('Office start and end times must use 24-hour HH:MM format.');
  }
  if (![payload.gracePeriod, payload.halfDayThresholdMinutes, payload.overtimeThresholdMinutes, payload.missingCheckoutReminderMinutes]
    .every((value) => Number.isInteger(value) && value >= 0 && value <= 1440)) {
    throw ApiError.badRequest('Attendance thresholds must be whole numbers between 0 and 1440.');
  }
  if (typeof payload.missingCheckoutReminderEnabled !== 'boolean') {
    throw ApiError.badRequest('Missing-checkout reminder setting must be true or false.');
  }
  if (!Array.isArray(payload.workDays) || !payload.workDays.length ||
    payload.workDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6) ||
    new Set(payload.workDays).size !== payload.workDays.length) {
    throw ApiError.badRequest('Select at least one unique working day from Sunday through Saturday.');
  }
  if (!Array.isArray(payload.holidays) || payload.holidays.length > 1000 ||
    payload.holidays.some((holiday) => !holiday || typeof holiday !== 'object' ||
      !isValidDateOnly(holiday.date) ||
      typeof holiday.name !== 'string' || !holiday.name.trim() || holiday.name.trim().length > 100) ||
    new Set(payload.holidays.map((holiday) => holiday.date)).size !== payload.holidays.length) {
    throw ApiError.badRequest('Holidays must have a unique valid date and a name of up to 100 characters.');
  }
  payload.holidays = payload.holidays
    .map((holiday) => ({ date: holiday.date, name: holiday.name.trim() }))
    .sort((a, b) => a.date.localeCompare(b.date));
  await Setting.findOneAndUpdate({ key: 'attendance.rules' }, { key: 'attendance.rules', value: payload, updatedBy: req.user._id }, { upsert: true, new: true });
  res.json({ message: 'Attendance rules updated successfully.', rules: payload });
});
