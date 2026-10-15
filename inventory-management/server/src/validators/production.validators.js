const { z, objectId, optionalText, requiredText, numeric } = require('./common');

const productionBody = z.object({
  productionDate: z.preprocess(
    (value) => (value instanceof Date ? value : new Date(String(value || ''))),
    z.date({ invalid_type_error: 'Production date is required', required_error: 'Production date is required' })
      .refine((date) => !Number.isNaN(date.getTime()), 'Production date is invalid')
      .refine((date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000, 'Production date cannot be in the future')
  ),
  product: objectId('product'),
  quantityProduced: numeric('Quantity produced').refine((value) => value > 0, 'Quantity produced must be greater than zero'),
  unit: requiredText('Unit', 20),
  batchNumber: optionalText(100, 'Batch number'),
  referenceNumber: optionalText(100, 'Reference number'),
  notes: optionalText(1000, 'Notes'),
});

const productionTransferBody = z.object({
  transferDate: z.preprocess(
    (value) => (value instanceof Date ? value : new Date(String(value || ''))),
    z.date({ invalid_type_error: 'Transfer date is required', required_error: 'Transfer date is required' })
      .refine((date) => !Number.isNaN(date.getTime()), 'Transfer date is invalid')
      .refine((date) => date.getTime() <= Date.now() + 24 * 60 * 60 * 1000, 'Transfer date cannot be in the future')
  ),
  product: objectId('product'),
  toWarehouse: objectId('warehouse'),
  quantity: numeric('Quantity').refine((value) => value > 0, 'Quantity must be greater than zero'),
  unit: requiredText('Unit', 20),
  referenceNumber: optionalText(100, 'Reference number'),
  notes: optionalText(1000, 'Notes'),
});

module.exports = { productionBody, productionTransferBody };
