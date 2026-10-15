const { z, objectId, optionalText, requiredText, numeric, optionalNumeric, quantity } = require('./common');

const coordinate = (label, min, max) => numeric(label)
  .refine((value) => value >= min && value <= max, `${label} must be between ${min} and ${max}`);
const accuracy = numeric('Location accuracy')
  .refine((value) => value >= 0 && value <= 500, 'Location accuracy must be between 0 and 500 metres');

const location = z.object({
  latitude: coordinate('Latitude', -90, 90),
  longitude: coordinate('Longitude', -180, 180),
  accuracy,
});

const startShift = z.object({
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm the location-tracking notice before starting working hours.' }) }),
  location,
});

const locationPing = z.object({ location });

const checkIn = z.object({
  placeName: requiredText('Visit location', 160),
  requirements: z.array(z.object({
    productId: objectId('Product'),
    quantity,
    unit: optionalText(20, 'Requirement unit').optional(),
    unitPrice: optionalNumeric('Unit price').refine((value) => value === undefined || (value >= 0 && value <= 1e12 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6), 'Unit price must be a non-negative amount with at most 2 decimal places'),
    note: optionalText(500, 'Requirement note').optional().default(''),
  })).max(50, 'A visit can have at most 50 product requirements').default([])
    .refine((items) => new Set(items.map((item) => item.productId)).size === items.length, 'Choose each product only once'),
  geofence: z.object({
    latitude: coordinate('Location latitude', -90, 90),
    longitude: coordinate('Location longitude', -180, 180),
  }),
  location,
});

const checkOut = z.preprocess((body) => {
  if (body && typeof body.location === 'string') {
    try {
      return { ...body, location: JSON.parse(body.location) };
    } catch {
      return body;
    }
  }
  return body;
}, z.object({ location }));

module.exports = { startShift, locationPing, checkIn, checkOut };
