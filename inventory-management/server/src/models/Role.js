const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true, trim: true, uppercase: true, maxlength: 50 },
    description: { type: String, trim: true, maxlength: 300, default: '' },
    permissions: { type: [String], default: [] },
    isSystemRole: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Role', roleSchema);
