/**
 * Development seed. Usage:
 *   npm run seed         -> adds demo data if the database has no products yet
 *   npm run seed:reset   -> wipes ALL inventory data and users, then seeds
 *
 * All stock is created through the real stock service, so inventory and history are consistent.
 */
const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const { User, Warehouse, Product, Inventory, StockTransaction, StockTransfer, Unit, Setting, Role, AuditLog, ProductionStock, ProductionRecord, ProductionTransfer, SampleDispatch } = require('../models');
const { ensureDefaultUnits } = require('../services/unit.service');
const { stockIn, stockOut, transferStock } = require('../services/stock.service');

const DEMO_USER = { name: 'Demo User', email: 'demo@inventory.local', password: 'Demo@1234' };

const WAREHOUSES = [
  { name: 'Kanpur Warehouse', code: 'KNP-01', location: 'Kanpur', address: 'Plot 14, Panki Industrial Area, Site 2', city: 'Kanpur', state: 'Uttar Pradesh', pincode: '208022', contactPerson: 'Ravi Verma', contactNumber: '+91 98390 11111' },
  { name: 'Lucknow Warehouse', code: 'LKO-01', location: 'Lucknow', address: 'B-27, Talkatora Industrial Estate', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226011', contactPerson: 'Anita Singh', contactNumber: '+91 94150 22222' },
  { name: 'Delhi Warehouse', code: 'DEL-01', location: 'Delhi', address: 'Shed 9, Okhla Industrial Area Phase II', city: 'New Delhi', state: 'Delhi', pincode: '110020', contactPerson: '', contactNumber: '' },
];

const PRODUCTS = [
  { name: 'Product 1', sku: 'P001', category: 'Cups', brand: 'EcoWare', hsn: '3923', size: 250, unit: 'ML', stockUnit: 'PCS', minimumStock: 500, description: 'Sample description for Product 1.' },
  { name: 'Product 2', sku: 'P002', category: 'Containers', brand: 'EcoWare', hsn: '3923', size: 750, unit: 'ML', stockUnit: 'PCS', minimumStock: 500, description: 'Sample description for Product 2.' },
  { name: 'Product 3', sku: 'P003', category: 'Plates', brand: 'GreenLeaf', hsn: '4823', size: 50, unit: 'PCS', stockUnit: 'Packet', minimumStock: 100, description: 'Sample description for Product 3.' },
  { name: 'Product 4', sku: 'P004', category: 'Cups', brand: 'GreenLeaf', hsn: '4823', size: 150, unit: 'ML', stockUnit: 'PCS', minimumStock: 1000, description: 'Sample description for Product 4.' },
  { name: 'Product 5', sku: 'P005', category: 'Bags', brand: 'EarthPack', hsn: '3923', size: 5, unit: 'KG', stockUnit: 'PCS', minimumStock: 300, description: 'Sample description for Product 5.' },
];

const daysAgo = (n, hour = 11) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hour, 0, 0, 0);
  return d;
};

async function reset() {
  await Promise.all([User, Warehouse, Product, Inventory, StockTransaction, StockTransfer, Unit, Setting, Role, AuditLog, ProductionStock, ProductionRecord, ProductionTransfer, SampleDispatch].map((M) => M.deleteMany({})));
}

async function seed() {
  const doReset = process.argv.includes('--reset');
  if (env.isProd && doReset && !process.argv.includes('--force')) {
    throw new Error('Refusing to reset a production database. Add --force if you really mean it.');
  }
  await connectDB();
  if (doReset) {
    await reset();
    console.log('Database cleared.');
  } else if (await Product.estimatedDocumentCount()) {
    console.log('Products already exist - skipping seed. Use "npm run seed:reset" to start fresh.');
    return;
  }

  await ensureDefaultUnits();

  let user = await User.findOne({ email: DEMO_USER.email });
  if (!user) user = await User.create(DEMO_USER);

  const warehouses = {};
  for (const w of WAREHOUSES) {
    warehouses[w.code] = await Warehouse.findOneAndUpdate({ code: w.code }, { $setOnInsert: { ...w, createdBy: user._id, updatedBy: user._id } }, { upsert: true, new: true });
  }
  const products = {};
  for (const p of PRODUCTS) {
    products[p.sku] = await Product.findOneAndUpdate({ sku: p.sku }, { $setOnInsert: { ...p, createdBy: user._id, updatedBy: user._id } }, { upsert: true, new: true });
  }

  const K = warehouses['KNP-01']._id;
  const L = warehouses['LKO-01']._id;
  const D = warehouses['DEL-01']._id;
  const P = (sku) => products[sku]._id;
  const src = { source: 'seed' };

  const moves = [
    // Opening stock
    () => stockIn({ product: P('P001'), warehouse: K, quantity: 5000, date: daysAgo(14), referenceNumber: 'GRN-1001', supplier: 'EcoWare Industries', ...src }, user),
    () => stockIn({ product: P('P001'), warehouse: L, quantity: 2000, date: daysAgo(14), referenceNumber: 'GRN-1002', supplier: 'EcoWare Industries', ...src }, user),
    () => stockIn({ product: P('P001'), warehouse: D, quantity: 1200, date: daysAgo(13), referenceNumber: 'GRN-1003', supplier: 'EcoWare Industries', ...src }, user),
    () => stockIn({ product: P('P002'), warehouse: K, quantity: 3000, date: daysAgo(12), referenceNumber: 'GRN-1004', supplier: 'EcoWare Industries', ...src }, user),
    () => stockIn({ product: P('P002'), warehouse: L, quantity: 600, date: daysAgo(12), referenceNumber: 'GRN-1005', supplier: 'EcoWare Industries', ...src }, user),
    () => stockIn({ product: P('P003'), warehouse: K, quantity: 400, date: daysAgo(11), referenceNumber: 'GRN-1006', supplier: 'GreenLeaf Mouldings', ...src }, user),
    () => stockIn({ product: P('P003'), warehouse: D, quantity: 150, date: daysAgo(11), referenceNumber: 'GRN-1007', supplier: 'GreenLeaf Mouldings', ...src }, user),
    () => stockIn({ product: P('P004'), warehouse: K, quantity: 8000, date: daysAgo(10), referenceNumber: 'GRN-1008', supplier: 'GreenLeaf Mouldings', ...src }, user),
    () => stockIn({ product: P('P004'), warehouse: L, quantity: 1500, date: daysAgo(10), referenceNumber: 'GRN-1009', supplier: 'GreenLeaf Mouldings', ...src }, user),
    () => stockIn({ product: P('P005'), warehouse: K, quantity: 1000, date: daysAgo(9), referenceNumber: 'GRN-1010', supplier: 'EarthPack Pvt Ltd', ...src }, user),
    // Movements
    () => stockOut({ product: P('P001'), warehouse: K, quantity: 500, reason: 'Customer dispatch', date: daysAgo(8), referenceNumber: 'DC-2001', ...src }, user),
    () => transferStock({ product: P('P001'), fromWarehouse: K, toWarehouse: L, quantity: 1000, date: daysAgo(7), referenceNumber: 'TRF-3001', notes: 'Rebalancing for Lucknow demand', ...src }, user),
    () => stockOut({ product: P('P002'), warehouse: L, quantity: 450, reason: 'Customer dispatch', date: daysAgo(6), referenceNumber: 'DC-2002', ...src }, user),
    () => transferStock({ product: P('P004'), fromWarehouse: K, toWarehouse: D, quantity: 2000, date: daysAgo(5), referenceNumber: 'TRF-3002', ...src }, user),
    () => stockOut({ product: P('P003'), warehouse: D, quantity: 90, reason: 'Customer dispatch', date: daysAgo(4), referenceNumber: 'DC-2003', ...src }, user),
    () => stockOut({ product: P('P005'), warehouse: K, quantity: 780, reason: 'Customer dispatch', date: daysAgo(3), referenceNumber: 'DC-2004', ...src }, user),
    () => transferStock({ product: P('P002'), fromWarehouse: K, toWarehouse: D, quantity: 800, date: daysAgo(2), referenceNumber: 'TRF-3003', ...src }, user),
    () => stockOut({ product: P('P004'), warehouse: L, quantity: 1500, reason: 'Customer dispatch', date: daysAgo(1), referenceNumber: 'DC-2005', ...src }, user),
    // Today
    () => stockIn({ product: P('P001'), warehouse: K, quantity: 2500, date: daysAgo(0, new Date().getHours()), referenceNumber: 'GRN-1011', supplier: 'EcoWare Industries', ...src }, user),
    () => stockOut({ product: P('P004'), warehouse: K, quantity: 1200, reason: 'Customer dispatch', date: daysAgo(0, new Date().getHours()), referenceNumber: 'DC-2006', ...src }, user),
    () => stockOut({ product: P('P001'), warehouse: D, quantity: 300, reason: 'Damaged', date: daysAgo(0, new Date().getHours()), referenceNumber: 'ADJ-01', notes: 'Crushed in handling', ...src }, user),
  ];
  for (const move of moves) await move();

  await Setting.updateOne({ key: 'companyName' }, { $set: { value: 'Bharat Kitchen Demo' } }, { upsert: true });

  console.log('Seed complete.');
  console.log(`  Login: ${DEMO_USER.email} / ${DEMO_USER.password}`);
  console.log(`  ${WAREHOUSES.length} warehouses, ${PRODUCTS.length} products, ${moves.length} stock operations`);
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDB());
