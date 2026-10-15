const mongoose = require('mongoose');
const interactionSchema = new mongoose.Schema({ interactionId: { type: String, unique: true, required: true }, customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' }, lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' }, user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, type: { type: String, enum: ['Call', 'Email', 'Meeting', 'WhatsApp', 'Visit', 'Note', 'Other'], default: 'Note' }, subject: String, description: String, outcome: String, nextFollowUp: Date, attachment: String, date: { type: Date, default: Date.now } }, { timestamps: true });
interactionSchema.index({ customer: 1, date: -1 }); interactionSchema.index({ lead: 1, date: -1 });
module.exports = mongoose.model('Interaction', interactionSchema);
