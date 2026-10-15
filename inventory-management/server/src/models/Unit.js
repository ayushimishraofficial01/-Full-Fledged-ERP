const mongoose = require('mongoose');

const unitSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 20 },
    key: { type: String, required: true }, // upper-cased name for case-insensitive uniqueness
    label: { type: String, trim: true, maxlength: 50, default: '' },
    category: { type: String, enum: ['weight', 'volume', 'quantity', 'length', 'other'], default: 'other' },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

unitSchema.index({ key: 1 }, { unique: true });

module.exports = mongoose.model('Unit', unitSchema);
