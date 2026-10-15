const mongoose = require('mongoose');

const officeScheduleSchema = new mongoose.Schema({
  startTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  endTime: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
  timezone: { type: String, required: true, maxlength: 64 },
  weekdays: { type: [{ type: Number, min: 0, max: 6 }], required: true },
}, { _id: false });

const salesStaffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  officeSchedule: { type: officeScheduleSchema, default: null },
}, { timestamps: true });

module.exports = mongoose.model('SalesStaff', salesStaffSchema);
