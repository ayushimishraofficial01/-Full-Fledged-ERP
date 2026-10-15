const mongoose = require('mongoose');
const { TRANSACTION_TYPES } = require('../utils/stock');

/** Immutable ledger of every stock movement. Never updated or deleted by the application. */
const stockTransactionSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    productionStock: { type: mongoose.Schema.Types.ObjectId, ref: 'ProductionStock' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    customerName: { type: String, trim: true, maxlength: 160, default: '' },
    batchNumber: { type: String, trim: true, maxlength: 100, default: '' },
    type: { type: String, enum: Object.values(TRANSACTION_TYPES), required: true },
    quantity: { type: Number, required: true, min: [0, 'Quantity must be positive'] },
    unit: { type: String, required: true },
    balanceAfter: { type: Number, required: true },
    referenceNumber: { type: String, trim: true, maxlength: 100, default: '' },
    supplier: { type: String, trim: true, maxlength: 150, default: '' },
    reason: { type: String, trim: true, maxlength: 150, default: '' },
    notes: { type: String, trim: true, maxlength: 1000, default: '' },
    transfer: { type: mongoose.Schema.Types.ObjectId, ref: 'StockTransfer' },
    counterpartWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse' },
    source: { type: String, enum: ['manual', 'transfer', 'import', 'seed'], default: 'manual' },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

stockTransactionSchema.index({ date: -1, createdAt: -1 });
stockTransactionSchema.index({ product: 1, date: -1 });
stockTransactionSchema.index({ warehouse: 1, date: -1 });
stockTransactionSchema.index({ type: 1, date: -1 });
stockTransactionSchema.index({ transfer: 1 });

module.exports = mongoose.model('StockTransaction', stockTransactionSchema);
