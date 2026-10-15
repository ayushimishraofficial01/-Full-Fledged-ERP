const mongoose = require('mongoose');
const crmActivitySchema = new mongoose.Schema({ action: { type: String, required: true }, description: String, actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }, metadata: mongoose.Schema.Types.Mixed }, { timestamps: { createdAt: true, updatedAt: false } });
crmActivitySchema.index({ customer: 1, createdAt: -1 }); crmActivitySchema.index({ lead: 1, createdAt: -1 });
module.exports = mongoose.model('CRMActivity', crmActivitySchema);
