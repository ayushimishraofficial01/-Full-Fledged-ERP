const mongoose = require('mongoose');

const hrNotificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  type: {
    type: String,
    required: true,
    enum: [
      'leave_request', 'leave_review', 'payroll_approved', 'attendance_checkin',
      'attendance_checkout', 'attendance_late', 'attendance_early_checkout', 'attendance_corrected',
      'attendance_missing_checkout',
    ],
  },
  message: { type: String, required: true, trim: true, maxlength: 500 },
  relatedId: { type: mongoose.Schema.Types.ObjectId, default: null },
  readAt: { type: Date, default: null },
  emailStatus: { type: String, enum: ['not_configured', 'pending', 'delivered', 'failed'], default: 'not_configured' },
}, { timestamps: true });

hrNotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
hrNotificationSchema.index(
  { recipient: 1, type: 1, relatedId: 1 },
  { unique: true, partialFilterExpression: { relatedId: { $type: 'objectId' } } }
);

module.exports = mongoose.model('HRNotification', hrNotificationSchema);
