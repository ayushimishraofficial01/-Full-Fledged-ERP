const Attendance = require('../models/Attendance');
const Setting = require('../models/Setting');
const HRNotification = require('../models/HRNotification');
const { User } = require('../models');
const { sendMail, isEmailConfigured } = require('./email.service');

const DEFAULT_RULES = {
  officeEndTime: '18:30',
  missingCheckoutReminderEnabled: true,
  missingCheckoutReminderMinutes: 60,
};

function clockMinutes(value) {
  const [hours, minutes] = String(value || '').split(':').map(Number);
  return Number.isInteger(hours) && Number.isInteger(minutes) ? hours * 60 + minutes : 0;
}

function duplicateKey(error) {
  return error?.code === 11000;
}

async function runMissingCheckoutReminders(now = new Date()) {
  const setting = await Setting.findOne({ key: 'attendance.rules' }).lean();
  const rules = { ...DEFAULT_RULES, ...(setting?.value || {}) };
  if (!rules.missingCheckoutReminderEnabled) return { scanned: 0, notified: 0 };

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const oldestDate = new Date(today);
  oldestDate.setDate(oldestDate.getDate() - 7);
  const records = await Attendance.find({
    date: { $gte: oldestDate, $lt: new Date(today.getTime() + 86400000) },
    checkInTime: { $ne: null },
    checkOutTime: null,
    leaveRequest: null,
  }).select('_id employee employeeName date').lean();

  let notified = 0;
  for (const record of records) {
    const recordDate = new Date(record.date);
    const sameDay = recordDate.getFullYear() === now.getFullYear()
      && recordDate.getMonth() === now.getMonth()
      && recordDate.getDate() === now.getDate();
    const dueAt = clockMinutes(rules.officeEndTime) + Number(rules.missingCheckoutReminderMinutes || 0);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (sameDay && nowMinutes < dueAt) continue;

    const message = `You have not checked out for your attendance on ${recordDate.toLocaleDateString('en-IN')}. Please update your attendance.`;
    let notification;
    try {
      notification = await HRNotification.create({
        recipient: record.employee,
        type: 'attendance_missing_checkout',
        message,
        relatedId: record._id,
        emailStatus: isEmailConfigured() ? 'pending' : 'not_configured',
      });
      notified += 1;
    } catch (error) {
      if (!duplicateKey(error)) throw error;
      notification = await HRNotification.findOne({
        recipient: record.employee,
        type: 'attendance_missing_checkout',
        relatedId: record._id,
      });
      if (!notification || !isEmailConfigured() || notification.emailStatus === 'delivered') continue;
      notification.emailStatus = 'pending';
      await notification.save();
    }

    if (!isEmailConfigured()) continue;
    const employee = await User.findById(record.employee).select('name email').lean();
    if (!employee?.email) {
      notification.emailStatus = 'failed';
      await notification.save();
      console.error(`Missing-checkout reminder has no recipient email for attendance ${record._id}.`);
      continue;
    }
    try {
      await sendMail({
        to: employee.email,
        subject: 'Gen Vyro attendance reminder: checkout missing',
        text: `Hi ${employee.name},\n\n${message}\n\nPlease sign in to Gen Vyro to complete your attendance record.`,
      });
      notification.emailStatus = 'delivered';
      await notification.save();
    } catch (error) {
      notification.emailStatus = 'failed';
      await notification.save();
      console.error(`Unable to send missing-checkout reminder for attendance ${record._id}:`, error);
    }
  }
  return { scanned: records.length, notified };
}

function startAttendanceReminderScheduler() {
  const timer = setInterval(() => {
    runMissingCheckoutReminders().catch((error) => {
      console.error('Missing-checkout reminder scan failed:', error);
    });
  }, 5 * 60 * 1000);
  timer.unref();
  return timer;
}

module.exports = { runMissingCheckoutReminders, startAttendanceReminderScheduler };
