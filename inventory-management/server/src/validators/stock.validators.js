const { z, objectId, optionalText, quantity, dateInput } = require('./common');

const stockIn = z.object({
  warehouse: objectId('warehouse'),
  product: objectId('product'),
  quantity,
  unit: optionalText(20, 'Unit'),
  date: dateInput,
  referenceNumber: optionalText(100, 'Reference number'),
  supplier: optionalText(150, 'Supplier'),
  notes: optionalText(1000, 'Notes'),
});

const stockOut = z.object({
  warehouse: objectId('warehouse'),
  product: objectId('product'),
  customer: objectId('customer').optional(),
  customerName: optionalText(160, 'Customer name'),
  quantity,
  unit: optionalText(20, 'Unit'),
  date: dateInput,
  reason: z.preprocess((v) => (v == null ? '' : String(v)), z.string().trim().min(1, 'Reason is required').max(150)),
  referenceNumber: optionalText(100, 'Reference number'),
  notes: optionalText(1000, 'Notes'),
});

const transfer = z
  .object({
    fromWarehouse: objectId('source warehouse'),
    toWarehouse: objectId('destination warehouse'),
    product: objectId('product'),
    quantity,
    date: dateInput,
    referenceNumber: optionalText(100, 'Reference number'),
    notes: optionalText(1000, 'Notes'),
  })
  .refine((d) => d.fromWarehouse !== d.toWarehouse, {
    message: 'Source and destination warehouse must be different',
    path: ['toWarehouse'],
  });

module.exports = { stockIn, stockOut, transfer };
