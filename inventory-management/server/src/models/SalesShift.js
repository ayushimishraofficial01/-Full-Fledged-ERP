const mongoose = require('mongoose');

const locationSchema = new mongoose.Schema({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  accuracy: { type: Number, required: true, min: 0 },
  recordedAt: { type: Date, required: true, default: Date.now },
}, { _id: false });

const salesShiftSchema = new mongoose.Schema({
  salesStaff: { type: mongoose.Schema.Types.ObjectId, ref: 'SalesStaff', required: true, index: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  startedAt: { type: Date, required: true, default: Date.now },
  endedAt: { type: Date, default: null },
  consentAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  visitActive: { type: Boolean, default: false },
  latestLocation: { type: locationSchema, required: true },
  track: { type: [locationSchema], default: [] },
}, { timestamps: true });

salesShiftSchema.index({ user: 1, isActive: 1 }, {
  unique: true,
  partialFilterExpression: { isActive: true },
});
salesShiftSchema.index({ salesStaff: 1, isActive: 1 }, {
  unique: true,
  partialFilterExpression: { isActive: true, salesStaff: { $exists: true } },
});

module.exports = mongoose.model('SalesShift', salesShiftSchema);
