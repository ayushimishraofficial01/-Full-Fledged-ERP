const mongoose = require('mongoose');
const noteSchema = new mongoose.Schema({ title: { type: String, required: true }, description: { type: String, required: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, company: { type: mongoose.Schema.Types.ObjectId, ref: 'Company' }, contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }, pinned: { type: Boolean, default: false }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true } }, { timestamps: true });
noteSchema.index({ customer: 1, createdAt: -1 });
module.exports = mongoose.model('CustomerNote', noteSchema);
