const mongoose = require('mongoose');

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true, maxlength: 200 },
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
      maxlength: 60,
      match: [/^[A-Z0-9][A-Z0-9._\-/]*$/, 'SKU may contain letters, numbers, ".", "-", "_" and "/" only'],
    },
    image: { type: String, default: null }, // relative path under /uploads, optional
    category: { type: String, required: [true, 'Category is required'], trim: true, maxlength: 80 },
    brand: { type: String, trim: true, maxlength: 80, default: '' },
    hsn: { type: String, trim: true, default: '', match: [/^(\d{4}|\d{6}|\d{8})?$/, 'HSN must be 4, 6 or 8 digits'] },
    // Size + unit describe the item itself, e.g. 250 ML cup or 50 KG sack.
    size: { type: Number, min: 0, default: null },
    unit: { type: String, required: [true, 'Unit is required'], trim: true },
    // Unit in which stock is counted in every warehouse, e.g. PCS of a 250 ML cup.
    stockUnit: { type: String, required: [true, 'Stock unit is required'], trim: true, default: 'PCS' },
    price: { type: Number, min: 0, max: 1e12, default: null },
    minimumStock: { type: Number, min: 0, default: 0 },
    description: { type: String, trim: true, maxlength: 2000, default: '' },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
    isArchived: { type: Boolean, default: false },
    archivedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ name: 1 });
productSchema.index({ hsn: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isArchived: 1, status: 1 });

module.exports = mongoose.model('Product', productSchema);
