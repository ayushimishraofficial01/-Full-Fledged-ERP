const mongoose = require('mongoose');
const { z } = require('zod');

const objectId = (label = 'id') =>
  z.string({ required_error: `${label} is required`, invalid_type_error: `${label} is required` })
    .trim()
    .refine((v) => mongoose.isValidObjectId(v), { message: `Please select a valid ${label}` });

const optionalText = (max, label = 'Value') =>
  z.preprocess((v) => (v === undefined || v === null ? '' : String(v)), z.string().trim().max(max, `${label} must be at most ${max} characters`));

const requiredText = (label, max = 200) =>
  z.preprocess((v) => (v === undefined || v === null ? '' : String(v)), z.string().trim().min(1, `${label} is required`).max(max, `${label} must be at most ${max} characters`));

/** Accepts numbers or numeric strings (multipart forms send strings). Empty -> undefined. */
const numeric = (label) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) : v),
    z.number({ invalid_type_error: `${label} must be a number`, required_error: `${label} is required` }).finite(`${label} must be a number`)
  );

const optionalNumeric = (label) =>
  z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? undefined : typeof v === 'string' ? Number(v.replace(/,/g, '').trim()) : v),
    z.number({ invalid_type_error: `${label} must be a number` }).finite(`${label} must be a number`).optional()
  );

/** Positive stock quantity with at most 3 decimals. */
const quantity = numeric('Quantity')
  .refine((n) => n > 0, 'Quantity must be greater than 0')
  .refine((n) => n <= 1e12, 'Quantity is too large')
  .refine((n) => Math.abs(n * 1000 - Math.round(n * 1000)) < 1e-6, 'Quantity can have at most 3 decimal places');

const dateInput = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.date({ invalid_type_error: 'Please enter a valid date' }).optional()
).refine((d) => !d || d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, 'Date cannot be in the future');

const status = z.enum(['active', 'inactive']).default('active');

module.exports = { z, objectId, optionalText, requiredText, numeric, optionalNumeric, quantity, dateInput, status };
