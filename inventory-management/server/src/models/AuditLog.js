const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true, trim: true, maxlength: 100 },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    targetRole: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
    oldRole: { type: String, default: '' },
    newRole: { type: String, default: '' },
    oldPermissions: { type: [String], default: undefined },
    newPermissions: { type: [String], default: undefined },
    ip: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ targetUser: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
