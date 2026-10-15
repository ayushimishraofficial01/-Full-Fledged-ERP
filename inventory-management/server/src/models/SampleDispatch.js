const mongoose = require('mongoose');

const sampleProductSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true, trim: true },
  sku: { type: String, trim: true, default: '' },
  quantity: { type: Number, required: true, min: 0.001 },
  unit: { type: String, required: true, trim: true },
});

const sampleDispatchSchema = new mongoose.Schema({
  dispatchId: { type: String, required: true, unique: true, trim: true },
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', default: null },
  customerName: { type: String, required: true, trim: true, maxlength: 160 },
  companyName: { type: String, trim: true, default: '' },
  phone: { type: String, trim: true, default: '' },
  email: { type: String, lowercase: true, trim: true, default: '' },
  completeAddress: { type: String, trim: true, default: '' },
  city: { type: String, trim: true, default: '' },
  state: { type: String, trim: true, default: '' },
  pincode: { type: String, trim: true, default: '' },
  sampleProducts: { type: [sampleProductSchema], validate: [(rows) => rows.length > 0, 'At least one sample product is required'] },
  dispatchDate: { type: Date, required: true, default: Date.now },
  dispatchMethod: { type: String, trim: true, default: '' },
  trackingNumber: { type: String, trim: true, default: '' },
  expectedDeliveryDate: { type: Date, default: null },
  status: { type: String, enum: ['Pending', 'Dispatched', 'Delivered', 'Cancelled'], default: 'Pending' },
  remarks: { type: String, trim: true, default: '' },
  assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  deliveredAt: { type: Date, default: null },
}, { timestamps: true });

sampleDispatchSchema.index({ customer: 1, dispatchDate: -1 });
sampleDispatchSchema.index({ status: 1, dispatchDate: -1 });
sampleDispatchSchema.index({ 'sampleProducts.product': 1 });
sampleDispatchSchema.index({ 'sampleProducts.sku': 1 });

module.exports = mongoose.model('SampleDispatch', sampleDispatchSchema);
