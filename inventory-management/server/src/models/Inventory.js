const mongoose = require('mongoose');

/**
 * One document per product per warehouse. This is the single source of truth for
 * current stock; the Product document never stores quantities.
 */
const inventorySchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', required: true },
    quantity: { type: Number, required: true, default: 0, min: [0, 'Stock cannot be negative'] },
    unit: { type: String, required: true },
    lastTransactionAt: Date,
  },
  { timestamps: true }
);

inventorySchema.index({ product: 1, warehouse: 1 }, { unique: true });
inventorySchema.index({ warehouse: 1, quantity: 1 });

module.exports = mongoose.model('Inventory', inventorySchema);
