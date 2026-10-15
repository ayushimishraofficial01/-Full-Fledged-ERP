/**
 * Built-in units. The `name` is the value stored on products/inventory/transactions.
 * Additional units live in the `units` collection and can be added from Settings.
 */
const DEFAULT_UNITS = [
  { name: 'KG', label: 'Kilogram', category: 'weight' },
  { name: 'Gram', label: 'Gram', category: 'weight' },
  { name: 'LB', label: 'Pound', category: 'weight' },
  { name: 'OZ', label: 'Ounce', category: 'weight' },
  { name: 'Litre', label: 'Litre', category: 'volume' },
  { name: 'ML', label: 'Millilitre', category: 'volume' },
  { name: 'Fluid OZ', label: 'Fluid ounce', category: 'volume' },
  { name: 'PCS', label: 'Pieces', category: 'quantity' },
  { name: 'Box', label: 'Box', category: 'quantity' },
  { name: 'Packet', label: 'Packet', category: 'quantity' },
  { name: 'Carton', label: 'Carton', category: 'quantity' },
  { name: 'Dozen', label: 'Dozen', category: 'quantity' },
  { name: 'Bag', label: 'Bag', category: 'quantity' },
  { name: 'Bundle', label: 'Bundle', category: 'quantity' },
];

// Alternative spellings accepted from Excel imports and API input (keys are upper-case).
const UNIT_ALIASES = {
  KGS: 'KG', KILOGRAM: 'KG', KILOGRAMS: 'KG',
  G: 'Gram', GM: 'Gram', GMS: 'Gram', GRAMS: 'Gram', GRM: 'Gram',
  LBS: 'LB', POUND: 'LB', POUNDS: 'LB',
  OUNCE: 'OZ', OUNCES: 'OZ',
  L: 'Litre', LTR: 'Litre', LITER: 'Litre', LITERS: 'Litre', LITRES: 'Litre',
  MILLILITRE: 'ML', MILLILITER: 'ML', MLS: 'ML',
  'FL OZ': 'Fluid OZ', 'FL.OZ': 'Fluid OZ', 'FL. OZ': 'Fluid OZ', FLOZ: 'Fluid OZ', 'FLUID OUNCE': 'Fluid OZ', 'FLUID OUNCES': 'Fluid OZ', FL_OZ: 'Fluid OZ',
  PC: 'PCS', PIECE: 'PCS', PIECES: 'PCS', NOS: 'PCS', UNIT: 'PCS', UNITS: 'PCS',
  BOXES: 'Box', PACKETS: 'Packet', PKT: 'Packet', PACK: 'Packet', CARTONS: 'Carton', CTN: 'Carton',
  DOZ: 'Dozen', DOZENS: 'Dozen', BAGS: 'Bag', BUNDLES: 'Bundle',
};

function unitKey(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
}

module.exports = { DEFAULT_UNITS, UNIT_ALIASES, unitKey };
