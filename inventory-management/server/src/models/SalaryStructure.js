const mongoose = require('mongoose');

const componentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    amount: { type: Number, required: true, min: 0 },
    kind: { type: String, enum: ['earning', 'deduction'], required: true },
  },
  { _id: false }
);

const salaryStructureSchema = new mongoose.Schema(
  {
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    baseSalary: { type: Number, required: true, min: 0 },
    overtimeRate: { type: Number, min: 0, default: 0 },
    currency: { type: String, required: true, uppercase: true, trim: true, minlength: 3, maxlength: 3, default: 'INR' },
    components: { type: [componentSchema], default: [] },
    effectiveFrom: { type: Date, required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

salaryStructureSchema.index({ employee: 1 }, { unique: true });

module.exports = mongoose.model('SalaryStructure', salaryStructureSchema);
