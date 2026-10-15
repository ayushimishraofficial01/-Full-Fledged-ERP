const mongoose = require('mongoose');

const payrollComponentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ['earning', 'deduction'], required: true },
  },
  { _id: false }
);

const payrollRunSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    employeeName: { type: String, trim: true, default: '' },
    employeeId: { type: String, trim: true, default: '' },
    period: { type: String, required: true, match: /^\d{4}-(0[1-9]|1[0-2])$/ },
    currency: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3 },
    baseSalary: { type: Number, required: true, min: 0 },
    components: { type: [payrollComponentSchema], default: [] },
    grossPay: { type: Number, required: true, min: 0 },
    totalDeductions: { type: Number, required: true, min: 0 },
    netPay: { type: Number, required: true, min: 0 },
    workingDays: { type: Number, default: 0, min: 0 },
    workedDays: { type: Number, default: 0, min: 0 },
    paidLeaveDays: { type: Number, default: 0, min: 0 },
    unpaidLeaveDays: { type: Number, default: 0, min: 0 },
    overtimeMinutes: { type: Number, default: 0, min: 0 },
    prorationDeduction: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['pending_approval', 'approved', 'rejected'], default: 'pending_approval', index: true },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    approvalNote: { type: String, trim: true, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

payrollRunSchema.index({ employee: 1, period: 1 }, { unique: true });

module.exports = mongoose.model('PayrollRun', payrollRunSchema);
