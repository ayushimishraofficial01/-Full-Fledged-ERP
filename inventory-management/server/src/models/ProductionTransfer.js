const mongoose = require('mongoose');

const productionTransferSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productionStock: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStock', required: true },
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    referenceNumber: { type: String, trim: true, maxlength: 100, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    outTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', required: true },
    inTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction', required: true },
    transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    transferDate: { type: Date, required: true, default: Date.now },
  },
  { timestamps: true }
);

productionTransferSchema.index({ transferDate: -1, createdAt: -1 });
productionTransferSchema.index({ product: 1, transferDate: -1 });
productionTransferSchema.index({ toWarehouse: 1, transferDate: -1 });

module.exports = mongoose.model('ProductionTransfer', productionTransferSchema);
