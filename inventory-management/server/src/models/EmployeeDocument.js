const mongoose = require('mongoose');

const employeeDocumentSchema = new mongoose.Schema({
  employee: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  category: { type: String, enum: ['document', 'profile_photo'], default: 'document', index: true },
  originalName: { type: String, required: true, trim: true, maxlength: 180 },
  storageName: { type: String, required: true, unique: true },
  mimeType: { type: String, required: true, enum: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] },
  size: { type: Number, required: true, min: 1 },
}, { timestamps: true });

employeeDocumentSchema.index({ employee: 1, createdAt: -1 });

module.exports = mongoose.model('EmployeeDocument', employeeDocumentSchema);
