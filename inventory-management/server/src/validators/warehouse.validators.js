const { z, optionalText, requiredText, status } = require('./common');

const warehouseBody = z.object({
  name: requiredText('Warehouse name', 120),
  code: requiredText('Warehouse code', 30)
    .transform((v) => v.toUpperCase())
    .refine((v) => /^[A-Z0-9][A-Z0-9_-]*$/.test(v), 'Code may contain letters, numbers, "-" and "_" only'),
  location: requiredText('Location', 120),
  address: optionalText(300, 'Address'),
  city: requiredText('City', 80),
  state: requiredText('State', 80),
  pincode: optionalText(10, 'Pincode').refine((v) => v === '' || /^\d{6}$/.test(v), 'Pincode must be 6 digits'),
  contactPerson: optionalText(100, 'Contact person'),
  contactNumber: optionalText(20, 'Contact number').refine((v) => v === '' || /^\+?[0-9\s-]{7,20}$/.test(v), 'Please enter a valid contact number'),
  status,
});

module.exports = { warehouseBody };
