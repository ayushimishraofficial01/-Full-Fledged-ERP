const mongoose = require('mongoose');

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Warehouse name is required'], trim: true, maxlength: 120 },
    code: {
      type: String,
      required: [true, 'Warehouse code is required'],
      trim: true,
      uppercase: true,
      maxlength: 30,
      match: [/^[A-Z0-9][A-Z0-9_-]*$/, 'Code may contain letters, numbers, "-" and "_" only'],
    },
    location: { type: String, trim: true, maxlength: 120, default: '' },
    address: { type: String, trim: true, maxlength: 300, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    pincode: { type: String, trim: true, maxlength: 10, default: '' },
    contactPerson: { type: String, trim: true, maxlength: 100, default: '' },
    contactNumber: { type: String, trim: true, maxlength: 20, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

warehouseSchema.index({ code: 1 }, { unique: true });
warehouseSchema.index({ name: 1 });
warehouseSchema.index({ isArchived: 1, status: 1 });

module.exports = mongoose.model('Warehouse', warehouseSchema);
