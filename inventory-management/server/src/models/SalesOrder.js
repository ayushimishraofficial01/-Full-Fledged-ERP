const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true, trim: true, maxlength: 200 },
  sku: { type: String, required: true, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, min: 0.001, max: 1e12 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  unitPrice: { type: Number, min: 0, max: 1e12, default: 0 },
  lineTotal: { type: Number, min: 0, max: 1e24, default: 0 },
  note: { type: String, trim: true, maxlength: 500, default: '' },
}, { _id: false });

const salesOrderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: undefined },
  customerName: { type: String, required: true, trim: true, maxlength: 160 },
  phone: { type: String, trim: true, maxlength: 40, default: '' },
  email: { type: String, trim: true, lowercase: true, maxlength: 254, default: '' },
  gstNumber: { type: String, trim: true, maxlength: 30, default: '' },
  address: { type: String, trim: true, maxlength: 500, default: '' },
  items: { type: [orderItemSchema], validate: [(rows) => rows.length > 0, 'At least one product is required'] },
  totalAmount: { type: Number, min: 0, max: 1e24, default: 0 },
  orderDate: { type: Date, required: true, default: Date.now },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'], default: 'Pending' },
  source: { type: String, enum: ['Manual', 'Sales Visit'], required: true, default: 'Manual' },
  salesVisit: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesVisit', default: undefined },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

salesOrderSchema.index({ salesVisit: 1 }, { unique: true, sparse: true });
salesOrderSchema.index({ createdBy: 1, orderDate: -1 });
salesOrderSchema.index({ status: 1, orderDate: -1 });

module.exports = mongoose.model('SalesOrder', salesOrderSchema);
