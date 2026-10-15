const mongoose = require('mongoose');

/** Header record for a warehouse-to-warehouse move; links its TRANSFER_OUT and TRANSFER_IN ledger lines. */
const stockTransferSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    fromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    referenceNumber: { type: String, trim: true, maxlength: 100, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    outTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction' },
    inTransaction: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransaction' },
    status: { type: String, enum: ['completed'], default: 'completed' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockTransferSchema.index({ date: -1, createdAt: -1 });
stockTransferSchema.index({ product: 1, date: -1 });
stockTransferSchema.index({ fromWarehouse: 1, date: -1 });
stockTransferSchema.index({ toWarehouse: 1, date: -1 });

module.exports = mongoose.model('StockTransfer', stockTransferSchema);
