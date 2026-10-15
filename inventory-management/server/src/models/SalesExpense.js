const mongoose = require('mongoose');

const salesExpenseSchema = new mongoose.Schema({
  expenseDate: { type: Date, required: true },
  amount: { type: Number, required: true, min: 0.01, max: 1e12 },
  note: { type: String, required: true, trim: true, maxlength: 1000 },
  receipt: { type: String, default: null },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  submittedByName: { type: String, required: true, trim: true, maxlength: 100 },
}, { timestamps: true });

salesExpenseSchema.index({ submittedBy: 1, expenseDate: -1, createdAt: -1 });

module.exports = mongoose.model('SalesExpense', salesExpenseSchema);
