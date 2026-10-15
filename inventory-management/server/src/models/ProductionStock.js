const mongoose = require('mongoose');

const productionStockSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true, unique: true },
    quantity: { type: Number, required: true, min: 0, default: 0 },
    totalProduced: { type: Number, required: true, min: 0, default: 0 },
    totalTransferred: { type: Number, required: true, min: 0, default: 0 },
    unit: { type: String, required: true },
    lastProductionDate: Date,
    lastTransactionAt: Date,
  },
  { timestamps: true }
);

productionStockSchema.index({ quantity: 1 });
productionStockSchema.index({ lastProductionDate: -1 });

module.exports = mongoose.model('ProductionStock', productionStockSchema);
