const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, required: true, min: 0 },
  recordedAt: { type: Date, required: true },
}, { _id: false });

const productRequirementSchema = new mongoose.Schema({
  product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  productName: { type: String, required: true, trim: true, maxlength: 200 },
  sku: { type: String, required: true, trim: true, maxlength: 60 },
  quantity: { type: Number, required: true, min: 0.001, max: 1e12 },
  unit: { type: String, required: true, trim: true, maxlength: 20 },
  unitPrice: { type: Number, min: 0, max: 1e12, default: null },
  note: { type: String, trim: true, maxlength: 500, default: '' },
}, { _id: false });

const salesVisitSchema = new mongoose.Schema({
  shift: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesShift', required: true, index: true },
  salesStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesStaff', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  placeName: { type: String, required: true, trim: true, maxlength: 160 },
  notes: { type: String, trim: true, maxlength: 2000, default: '' },
  requirements: { type: [productRequirementSchema], default: [] },
  geofence: {
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
    radiusMeters: { type: Number, required: true, default: 150 },
  },
  checkIn: {
    location: { type: locationSchema, required: true },
    at: { type: Date, required: true, default: Date.now },
  },
  checkOut: {
    location: { type: locationSchema, default: null },
    at: { type: Date, default: null },
  },
  durationSeconds: { type: Number, default: null, min: 0 },
  evidenceFilename: { type: String, default: null },
}, { timestamps: true });

salesVisitSchema.index({ shift: 1, 'checkOut.at': 1 });
salesVisitSchema.index({ user: 1, createdAt: -1 });
salesVisitSchema.index({ salesStaff: 1, 'checkIn.at': -1 });

module.exports = mongoose.model('SalesVisit', salesVisitSchema);
