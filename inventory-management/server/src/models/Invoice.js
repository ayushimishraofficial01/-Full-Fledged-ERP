const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema({
  invoiceId: { type: String, required: true, trim: true, maxlength: 60 },
  customer: { type: String, required: true, trim: true, maxlength: 200 },
  date: { type: String, required: true, maxlength: 10 },
  status: { type: String, enum: ['Paid', 'Unpaid'], required: true, default: 'Unpaid' },
  subtotal: { type: Number, required: true, min: 0, max: 1e12 },
  total: { type: Number, required: true, min: 0, max: 1e12 },
  data: { type: mongoose.Schema.Types.Mixed, required: true },
  savedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

invoiceSchema.index({ invoiceId: 1 }, { unique: true });
invoiceSchema.index({ date: -1, updatedAt: -1 });
invoiceSchema.index({ customer: 1 });

module.exports = mongoose.model('Invoice', invoiceSchema);
