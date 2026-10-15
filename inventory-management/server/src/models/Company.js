const mongoose = require('mongoose');
const companySchema = new mongoose.Schema({ companyId: { type: String, unique: true, required: true }, name: { type: String, required: true, trim: true }, industry: String, gstNumber: String, pan: String, website: String, phone: String, email: String, address: String, city: String, state: String, pincode: String, assignedUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, status: { type: String, enum: ['active', 'inactive', 'archived'], default: 'active' }, notes: String, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true });
companySchema.index({ name: 1 });
module.exports = mongoose.model('Company', companySchema);
