const mongoose = require('mongoose');

const productionRecordSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productionStock: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStock', required: true },
    quantityProduced: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    batchNumber: { type: String, trim: true, maxlength: 100, default: '' },
    referenceNumber: { type: String, trim: true, maxlength: 100, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    productionDate: { type: Date, required: true, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

productionRecordSchema.index({ productionDate: -1, createdAt: -1 });
productionRecordSchema.index({ product: 1, productionDate: -1 });
productionRecordSchema.index({ batchNumber: 1, productionDate: -1 });

module.exports = mongoose.model('ProductionRecord', productionRecordSchema);
