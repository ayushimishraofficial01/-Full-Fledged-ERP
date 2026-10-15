const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    leaveRequest: { type: mongoose.Schema.Types.ObjectId, ref: 'LeaveRequest', default: null, index: true },
    employeeName: { type: String, required: true, trim: true, maxlength: 120 },
    employeeId: { type: String, trim: true, maxlength: 60, default: '' },
    department: { type: String, trim: true, maxlength: 80, default: 'General' },
    date: { type: Date, required: true, index: true },
    checkInTime: { type: Date, default: null },
    checkOutTime: { type: Date, default: null },
    workingHoursMinutes: { type: Number, default: 0, min: 0 },
    overtimeMinutes: { type: Number, default: 0, min: 0 },
    lateMinutes: { type: Number, default: 0, min: 0 },
    earlyCheckoutMinutes: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ['Present', 'Late', 'Absent', 'Checked In', 'Checked Out', 'Half Day', 'Leave'],
      default: 'Checked In',
    },
    location: { type: String, trim: true, default: '' },
    photo: { type: String, trim: true, default: '' },
    deviceInfo: { type: String, trim: true, default: '' },
    ipAddress: { type: String, trim: true, default: '' },
    correctionReason: { type: String, trim: true, default: '' },
    notes: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

attendanceSchema.index({ employee: 1, date: 1 }, { unique: true });
attendanceSchema.index({ date: 1, status: 1 });
attendanceSchema.index({ department: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
