const { z, objectId, optionalText, requiredText, optionalNumeric, quantity } = require('./common');

const item = z.object({
  productId: objectId('Product'),
  quantity,
  unit: optionalText(20, 'Order unit').optional(),
  unitPrice: optionalNumeric('Unit price').refine((n) => n === undefined || (n >= 0 && n <= 1e12 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6), 'Unit price must be a non-negative amount with at most 2 decimal places'),
  note: optionalText(500, 'Product note').optional().default(''),
});

const createOrder = z.object({
  customerId: objectId('Customer').optional(),
  customerName: requiredText('Customer name', 160),
  phone: optionalText(40, 'Phone').optional(),
  email: z.string().trim().email('Email must be valid').max(254).optional().or(z.literal('')),
  gstNumber: optionalText(30, 'GST number').optional(),
  address: optionalText(500, 'Address').optional(),
  notes: optionalText(2000, 'Notes').optional(),
  items: z.array(item).min(1, 'Add at least one product').max(50, 'An order can have at most 50 products')
    .refine((items) => new Set(items.map((value) => value.productId)).size === items.length, 'Choose each product only once'),
});

const updateStatus = z.object({
  status: z.enum(['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled']),
});

module.exports = { createOrder, updateStatus };
