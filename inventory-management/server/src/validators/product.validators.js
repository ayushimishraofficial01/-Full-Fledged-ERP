const { z, objectId, optionalText, requiredText, numeric, optionalNumeric, status, dateInput } = require('./common');

const productBody = z
  .object({
    name: requiredText('Product name', 200),
    sku: requiredText('SKU', 60)
      .transform((v) => v.toUpperCase())
      .refine((v) => /^[A-Z0-9][A-Z0-9._\-/]*$/.test(v), 'SKU may contain letters, numbers, ".", "-", "_" and "/" only'),
    category: requiredText('Category', 80),
    brand: optionalText(80, 'Brand'),
    hsn: optionalText(8, 'HSN').refine((v) => v === '' || /^(\d{4}|\d{6}|\d{8})$/.test(v), 'HSN must be 4, 6 or 8 digits'),
    size: optionalNumeric('Size').refine((n) => n === undefined || n >= 0, 'Size cannot be negative').nullable(),
    unit: requiredText('Unit', 20),
    stockUnit: requiredText('Stock unit', 20),
    price: z.preprocess(
      (value) => value === '' || value === null ? null : typeof value === 'string' ? Number(value.trim()) : value,
      z.number({ invalid_type_error: 'Product price must be a number' }).finite().nullable()
    ).refine((value) => value === null || (value >= 0 && value <= 1e12 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6), 'Product price must be a non-negative amount with at most 2 decimal places').optional(),
    minimumStock: numeric('Minimum stock level').refine((n) => n >= 0, 'Minimum stock level cannot be negative').default(0),
    description: optionalText(2000, 'Description'),
    status,
    quantity: numeric('Initial quantity').refine((n) => n >= 0, 'Initial quantity cannot be negative').optional(),
    warehouse: objectId('warehouse').optional(),
    date: dateInput.optional(),
    removeImage: z.preprocess((v) => v === true || v === 'true' || v === '1', z.boolean()).optional(),
  })
  .refine((d) => !(d.warehouse && d.quantity === undefined), { message: 'Initial stock quantity is required when a warehouse is selected', path: ['quantity'] })
  .refine((d) => !(d.quantity !== undefined && !d.warehouse), { message: 'Select a warehouse to add initial stock', path: ['warehouse'] });

const listQuery = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().max(100).optional(),
  category: z.string().max(80).optional(),
  unit: z.string().max(20).optional(),
  stockStatus: z.enum(['IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK', '']).optional(),
  status: z.enum(['active', 'inactive', '']).optional(),
  archived: z.enum(['true', 'false', 'only', '']).optional(),
  sort: z.string().max(30).optional(),
  order: z.enum(['asc', 'desc', '']).optional(),
});

module.exports = { productBody, listQuery };
