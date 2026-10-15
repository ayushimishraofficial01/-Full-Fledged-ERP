const mongoose = require('mongoose');

const leaveTypeSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    code: { type: String, required: true, trim: true, uppercase: true, maxlength: 20 },
    annualAllowance: { type: Number, required: true, min: 0, max: 366 },
    isPaid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

leaveTypeSchema.index({ code: 1 }, { unique: true });

module.exports = mongoose.model('LeaveType', leaveTypeSchema);
