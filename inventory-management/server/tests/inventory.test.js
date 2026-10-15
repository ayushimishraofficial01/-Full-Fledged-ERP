const { test, before, after, describe } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { setup, teardown, request } = require('./helpers');

let app;
let agent;
const ids = {};

const qty = async (product, warehouse) => {
  const res = await agent.get('/api/inventory/available').query({ product: String(product), warehouse: String(warehouse) }).expect(200);
  return res.body.quantity;
};

before(async () => {
  ({ app, agent } = await setup());
});
after(teardown);

describe('Authentication', () => {
  test('rejects unauthenticated API access', async () => {
    await request(app).get('/api/products').expect(401);
  });

  test('rejects duplicate email and mismatched passwords', async () => {
    const dup = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'test@example.com', password: 'Passw0rd!', confirmPassword: 'Passw0rd!' });
    assert.equal(dup.status, 409);
    const mismatch = await request(app).post('/api/auth/register').send({ name: 'X Y', email: 'x@example.com', password: 'Passw0rd!', confirmPassword: 'other123' });
    assert.equal(mismatch.status, 400);
  });

  test('login with wrong password fails, correct password works, logout clears session', async () => {
    await request(app).post('/api/auth/login').send({ email: 'test@example.com', password: 'wrong-pass1' }).expect(401);
    const a = request.agent(app);
    await a.post('/api/auth/login').send({ email: 'test@example.com', password: 'Passw0rd!' }).expect(200);
    await a.get('/api/auth/me').expect(200);
    await a.post('/api/auth/logout').expect(200);
    await a.get('/api/auth/me').expect(401);
  });

  test('password is stored hashed', async () => {
    const { User } = require('../src/models');
    const u = await User.findOne({ email: 'test@example.com' }).select('+password').lean();
    assert.notEqual(u.password, 'Passw0rd!');
    assert.match(u.password, /^\$2[aby]\$/);
  });

  test('forgot/reset password flow', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'test@example.com' }).expect(200);
    const token = res.body.devResetUrl.split('/').pop();
    await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' }).expect(200);
    await request(app).post(`/api/auth/reset-password/${token}`).send({ password: 'NewPassw0rd', confirmPassword: 'NewPassw0rd' }).expect(400);
    // old sessions are revoked
    await agent.get('/api/auth/me').expect(401);
    await agent.post('/api/auth/login').send({ email: 'test@example.com', password: 'NewPassw0rd' }).expect(200);
  });
});

describe('Settings', () => {
  test('updates general preferences without changing the fixed company logo', async () => {
    const { Setting } = require('../src/models');
    const logo = 'branding/company-logo.png';
    await Setting.create({ key: 'logo', value: logo });

    const res = await agent.put('/api/settings')
      .send({ companyName: 'Updated Company', defaultStockUnit: 'BOX' })
      .expect(200);
    assert.equal(res.body.settings.logo, logo);
    assert.equal(res.body.settings.companyName, 'Updated Company');
    assert.equal((await Setting.findOne({ key: 'logo' })).value, logo);

    await agent.put('/api/settings')
      .send({ companyName: 'Another Company', defaultStockUnit: 'PCS', logo: null })
      .expect(400);
    await agent.put('/api/settings')
      .field('companyName', 'Another Company')
      .field('defaultStockUnit', 'PCS')
      .attach('logo', Buffer.from('not an image'), 'logo.png')
      .expect(400);
    assert.equal((await Setting.findOne({ key: 'logo' })).value, logo);
  });
});

describe('Warehouses and products', () => {
  test('creates warehouses and enforces unique code', async () => {
    for (const [key, name, code] of [['K', 'Kanpur Warehouse', 'KNP-01'], ['L', 'Lucknow Warehouse', 'LKO-01'], ['D', 'Delhi Warehouse', 'DEL-01']]) {
      const res = await agent.post('/api/warehouses').send({ name, code, location: name.split(' ')[0], city: name.split(' ')[0], state: 'UP', pincode: '208001' }).expect(201);
      ids[key] = res.body.warehouse._id;
    }
    const dup = await agent.post('/api/warehouses').send({ name: 'Other', code: 'knp-01', location: 'X', city: 'X', state: 'X' });
    assert.equal(dup.status, 409);
    assert.match(dup.body.message, /code already exists/i);
  });

  test('creates product with size/unit/stock unit, no image, and rejects duplicate SKU', async () => {
    const res = await agent.post('/api/products').field('name', 'PLA Cup').field('sku', 'p001').field('category', 'Cups').field('hsn', '3923')
      .field('size', '250').field('unit', 'ml').field('stockUnit', 'pcs').field('minimumStock', '500').field('price', '12.34').expect(201);
    ids.P = res.body.product._id;
    assert.equal(res.body.product.sku, 'P001');
    assert.equal(res.body.product.unit, 'ML');
    assert.equal(res.body.product.stockUnit, 'PCS');
    assert.equal(res.body.product.price, 12.34);
    assert.equal(res.body.product.image, null);

    await agent.post('/api/products')
      .field('name', 'Negative Price')
      .field('sku', 'NEG-PRICE')
      .field('category', 'Testing')
      .field('unit', 'PCS')
      .field('stockUnit', 'PCS')
      .field('price', '-1')
      .expect(400);

    const dup = await agent.post('/api/products').field('name', 'Another').field('sku', 'P001').field('category', 'Cups').field('unit', 'ML').field('stockUnit', 'PCS');
    assert.equal(dup.status, 409);
    assert.match(dup.body.message, /SKU already exists/);
  });

  test('accepts an initial stock quantity at product creation', async () => {
    const { Product } = require('../src/models');
    const res = await agent.post('/api/products')
      .field('name', 'Demo Initial Stock')
      .field('sku', 'INIT-01')
      .field('category', 'Testing')
      .field('unit', 'PCS')
      .field('stockUnit', 'PCS')
      .field('minimumStock', '10')
      .field('warehouse', ids.K)
      .field('quantity', '25')
      .field('date', '2024-01-01')
      .expect(201);

    ids.P_INITIAL = res.body.product._id;
    assert.equal(await qty(ids.P_INITIAL, ids.K), 25);

    const product = await Product.findById(ids.P_INITIAL);
    product.isArchived = true;
    product.archivedAt = new Date();
    product.status = 'inactive';
    await product.save();
  });

  test('validates HSN and rejects non-image uploads', async () => {
    const bad = await agent.post('/api/products').field('name', 'X').field('sku', 'X1').field('category', 'C').field('hsn', '12').field('unit', 'KG').field('stockUnit', 'PCS');
    assert.equal(bad.status, 400);
    const fake = await agent.post('/api/products').field('name', 'X').field('sku', 'X2').field('category', 'C').field('unit', 'KG').field('stockUnit', 'PCS')
      .attach('image', Buffer.from('not really an image'), { filename: 'photo.png', contentType: 'image/png' });
    assert.equal(fake.status, 400);
  });

  test('accepts a real PNG image', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const res = await agent.post('/api/products').field('name', 'Imaged').field('sku', 'IMG1').field('category', 'C').field('unit', 'KG').field('stockUnit', 'PCS')
      .attach('image', png, { filename: 'p.png', contentType: 'image/png' }).expect(201);
    assert.match(res.body.product.image, /^products\/.+\.png$/);
    await request(app).get(`/uploads/${res.body.product.image}`).expect(200);
    await agent.delete(`/api/products/${res.body.product._id}`).expect(200);
  });
});

describe('Stock engine (spec section 41 scenario)', () => {
  test('Kanpur 1000 +500 -200 transfer 300 => Kanpur 1000, Lucknow 300', async () => {
    const { Customer } = require('../src/models');
    const customer = await Customer.create({
      customerId: 'CUS-STOCK-OUT-001',
      fullName: 'Stock Out Test Customer',
      phone: '5559001234',
    });
    await agent.post('/api/stock/in').send({ product: ids.P, warehouse: ids.K, quantity: 1000, referenceNumber: 'OPEN' }).expect(201);
    const inRes = await agent.post('/api/stock/in').send({ product: ids.P, warehouse: ids.K, quantity: 500, supplier: 'EcoWare' }).expect(201);
    assert.equal(inRes.body.previousQuantity, 1000);
    assert.equal(inRes.body.newQuantity, 1500);

    const stockOut = await agent.post('/api/stock/out').send({
      product: ids.P,
      warehouse: ids.K,
      customer: String(customer._id),
      customerName: customer.fullName,
      quantity: 200,
      reason: 'Dispatch',
      referenceNumber: 'INV-2026-001',
    }).expect(201);
    assert.equal(stockOut.body.transaction.customerName, customer.fullName);
    assert.equal(stockOut.body.transaction.customer.fullName, customer.fullName);
    assert.equal(stockOut.body.transaction.referenceNumber, 'INV-2026-001');
    const tr = await agent.post('/api/stock/transfer').send({ product: ids.P, fromWarehouse: ids.K, toWarehouse: ids.L, quantity: 300 }).expect(201);
    assert.equal(tr.body.source.newQuantity, 1000);
    assert.equal(tr.body.destination.newQuantity, 300);

    assert.equal(await qty(ids.P, ids.K), 1000);
    assert.equal(await qty(ids.P, ids.L), 300);

    const hist = await agent.get('/api/stock/transactions').query({ product: ids.P, order: 'asc' }).expect(200);
    assert.deepEqual(hist.body.items.map((t) => t.type), ['STOCK_IN', 'STOCK_IN', 'STOCK_OUT', 'TRANSFER_OUT', 'TRANSFER_IN']);
    assert.deepEqual(hist.body.items.map((t) => t.balanceAfter), [1000, 1500, 1300, 1000, 300]);
    assert.ok(hist.body.items.every((t) => t.performedBy && t.performedBy.name === 'Test User'));
    const searchedHistory = await agent.get('/api/stock/transactions').query({ search: 'Stock Out Test Customer' }).expect(200);
    assert.equal(searchedHistory.body.pagination.total, 1);
    assert.equal(searchedHistory.body.items[0].referenceNumber, 'INV-2026-001');
    const transfers = await agent.get('/api/stock/transfers').expect(200);
    assert.equal(transfers.body.items.length, 1);
    assert.equal(transfers.body.items[0].fromWarehouse.code, 'KNP-01');
  });

  test('stock out never goes negative and reports available quantity', async () => {
    const res = await agent.post('/api/stock/out').send({ product: ids.P, warehouse: ids.L, quantity: 500, reason: 'Dispatch' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Insufficient stock. Available quantity is 300 PCS.');
    assert.equal(await qty(ids.P, ids.L), 300);
  });

  test('stock out from a warehouse with no record is rejected', async () => {
    const res = await agent.post('/api/stock/out').send({ product: ids.P, warehouse: ids.D, quantity: 1, reason: 'x' });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Available quantity is 0/);
  });

  test('transfer rejects same warehouse, insufficient stock and changes nothing', async () => {
    const same = await agent.post('/api/stock/transfer').send({ product: ids.P, fromWarehouse: ids.K, toWarehouse: ids.K, quantity: 1 });
    assert.equal(same.status, 400);
    const tooMuch = await agent.post('/api/stock/transfer').send({ product: ids.P, fromWarehouse: ids.L, toWarehouse: ids.D, quantity: 301 });
    assert.equal(tooMuch.status, 400);
    assert.equal(await qty(ids.P, ids.L), 300);
    assert.equal(await qty(ids.P, ids.D), 0);
  });

  test('validates quantity and unit', async () => {
    assert.equal((await agent.post('/api/stock/in').send({ product: ids.P, warehouse: ids.K, quantity: -5 })).status, 400);
    assert.equal((await agent.post('/api/stock/in').send({ product: ids.P, warehouse: ids.K, quantity: 'abc' })).status, 400);
    assert.equal((await agent.post('/api/stock/in').send({ product: ids.P, warehouse: ids.K, quantity: 1, unit: 'KG' })).status, 400);
    assert.equal((await agent.post('/api/stock/out').send({ product: ids.P, warehouse: ids.K, quantity: 1 })).status, 400); // reason required
  });

  test('concurrent stock-outs can never oversell', async () => {
    // Lucknow has 300. Fire 10 parallel requests of 50 => at most 6 can succeed.
    const results = await Promise.all(Array.from({ length: 10 }, () =>
      agent.post('/api/stock/out').send({ product: ids.P, warehouse: ids.L, quantity: 50, reason: 'Race' })));
    const ok = results.filter((r) => r.status === 201).length;
    assert.equal(ok, 6);
    assert.equal(await qty(ids.P, ids.L), 0);
  });

  test('decimal quantities stay exact', async () => {
    const res = await agent.post('/api/products').send({ name: 'Resin', sku: 'RM-1', category: 'Raw', unit: 'KG', stockUnit: 'KG', minimumStock: 1 }).expect(201);
    const id = res.body.product._id;
    await agent.post('/api/stock/in').send({ product: id, warehouse: ids.K, quantity: 0.1 }).expect(201);
    await agent.post('/api/stock/in').send({ product: id, warehouse: ids.K, quantity: 0.2 }).expect(201);
    assert.equal(await qty(id, ids.K), 0.3);
    await agent.post('/api/stock/out').send({ product: id, warehouse: ids.K, quantity: 0.3, reason: 'Use' }).expect(201);
    assert.equal(await qty(id, ids.K), 0);
    ids.RM = id;
  });
});

describe('Inventory views, dashboard and reports', () => {
  test('inventory status and warehouse summary', async () => {
    const res = await agent.get(`/api/inventory/warehouse/${ids.K}`).expect(200);
    const row = res.body.items.find((i) => i.product.sku === 'P001');
    assert.equal(row.quantity, 1000);
    assert.equal(row.status, 'IN_STOCK');
    assert.ok(res.body.summary.totalProducts >= 1);

    const low = await agent.get('/api/inventory/low-stock').expect(200);
    const lko = low.body.items.find((i) => i.product.sku === 'P001' && i.warehouse.code === 'LKO-01');
    assert.equal(lko.status, 'OUT_OF_STOCK');
  });

  test('product list totals and stock-status filter', async () => {
    const res = await agent.get('/api/products').query({ search: 'pla' }).expect(200);
    assert.equal(res.body.items[0].totalStock, 1000);
    const out = await agent.get('/api/products').query({ stockStatus: 'OUT_OF_STOCK' }).expect(200);
    assert.ok(out.body.items.some((p) => p.sku === 'RM-1'));
  });

  test('dashboard summary counts today', async () => {
    const res = await agent.get('/api/dashboard/summary').expect(200);
    assert.equal(res.body.cards.totalProducts, 2);
    assert.equal(res.body.cards.totalWarehouses, 3);
    assert.equal(res.body.cards.todayStockIn.byUnit.find((u) => u.unit === 'PCS').quantity, 1500);
    assert.ok(res.body.recentTransactions.length > 0);
  });

  test('reports return totals and exports are valid xlsx', async () => {
    const r = await agent.get('/api/reports/stock-out').expect(200);
    assert.equal(r.body.totals.byUnit.find((u) => u.unit === 'PCS').quantity, 500);
    for (const path of ['/api/export/products', '/api/export/inventory', '/api/export/transactions?type=STOCK_IN', '/api/export/transfers', `/api/export/inventory?warehouse=${ids.K}`]) {
      const res = await agent.get(path).buffer(true).parse((resp, cb) => {
        const chunks = [];
        resp.on('data', (c) => chunks.push(c));
        resp.on('end', () => cb(null, Buffer.concat(chunks)));
      }).expect(200);
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(res.body);
      const sheet = workbook.getWorksheet(1);
      assert.ok(sheet.rowCount >= 2, `${path} has rows`);
    }
  });
});

describe('Excel import', () => {
  const makeFile = async (rows) => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Products');
    rows.forEach((row) => sheet.addRow(row));
    return workbook.xlsx.writeBuffer();
  };
  const header = ['Product Name', 'SKU', 'Category', 'Brand', 'HSN', 'Size', 'Unit', 'Warehouse', 'Quantity', 'Minimum Stock', 'Description', 'Price (INR)'];

  test('preview validates rows without writing', async () => {
    const file = await makeFile([
      header,
      ['Paper Cup', 'P004', 'Cups', '', '4823', 150, 'ML', 'Kanpur', 800, 1000, '', 49.5],
      ['Paper Cup', 'P004', 'Cups', '', '4823', 150, 'ML', 'LKO-01', 200, 1000, '', 49.5],
      ['PLA Cup', 'P001', 'Cups', '', '3923', 250, 'ML', 'Delhi Warehouse', 100, '', ''],
      ['', 'P009', 'Cups', '', '', '', 'ML', 'Kanpur', 5, '', ''],
      ['Bad Qty', 'P010', 'Cups', '', '', '', 'ML', 'Kanpur', 'ten', '', ''],
      ['Nowhere', 'P011', 'Cups', '', '', '', 'ML', 'Mumbai', 5, '', ''],
      ['Neg', 'P012', 'Cups', '', '12', 'big', 'Furlong', 'Kanpur', -5, '', ''],
      ['Clash', 'P004', 'Cups', '', '', 300, 'ML', 'Delhi', 5, '', '', 49.5],
    ]);
    const res = await agent.post('/api/import/products/preview').attach('file', file, 'products.xlsx').expect(200);
    const byRow = Object.fromEntries(res.body.rows.map((r) => [r.row, r]));
    assert.equal(byRow[2].status, 'valid');
    assert.equal(byRow[2].action, 'create');
    assert.equal(byRow[4].action, 'stock');
    assert.ok(byRow[5].errors.includes('Product Name missing'));
    assert.ok(byRow[6].errors.includes('Quantity must be numeric'));
    assert.ok(byRow[7].errors.some((e) => /Warehouse "Mumbai" not found/.test(e)));
    assert.ok(byRow[8].errors.includes('Quantity cannot be negative'));
    assert.ok(byRow[8].errors.includes('Size must be numeric'));
    assert.ok(byRow[8].errors.some((e) => /HSN/.test(e)));
    assert.ok(byRow[8].errors.some((e) => /Unit "Furlong"/.test(e)));
    assert.ok(byRow[9].errors.some((e) => /used in row 2 with a different .*size/.test(e)));
    assert.equal(res.body.summary.validRows, 3);
    const { Product } = require('../src/models');
    assert.equal(await Product.countDocuments({ sku: 'P004' }), 0);

    // Confirm only the valid rows
    const valid = res.body.rows.filter((r) => r.status === 'valid').map((r) => r.input);
    const commit = await agent.post('/api/import/products').send({ rows: valid, fileName: 'products.xlsx' });
    assert.equal(commit.status, 201, JSON.stringify(commit.body));
    assert.equal(commit.body.productsCreated, 1);
    assert.equal(commit.body.stockTransactions, 3);

    const p4 = await Product.findOne({ sku: 'P004' }).lean();
    assert.equal(p4.price, 49.5);
    assert.equal(await qty(p4._id, ids.K), 800);
    assert.equal(await qty(p4._id, ids.L), 200);
    assert.equal(await qty(ids.P, ids.D), 100);
  });

  test('commit refuses invalid rows', async () => {
    const res = await agent.post('/api/import/products').send({ rows: [{ row: 2, name: '', sku: 'Z1', unit: 'ML', warehouse: 'Kanpur', quantity: 1 }] });
    assert.equal(res.status, 422);
  });

  test('missing required columns are reported', async () => {
    const res = await agent.post('/api/import/products/preview').attach('file', await makeFile([['Name', 'Qty'], ['x', 1]]), 'bad.xlsx');
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Missing required column/);
  });
});

describe('Delete / archive rules', () => {
  test('product with stock cannot be deleted', async () => {
    const res = await agent.delete(`/api/products/${ids.P}`);
    assert.equal(res.status, 409);
  });

  test('product with history but no stock is archived, not deleted', async () => {
    const res = await agent.delete(`/api/products/${ids.RM}`).expect(200);
    assert.equal(res.body.mode, 'archived');
    const hist = await agent.get('/api/stock/transactions').query({ product: ids.RM }).expect(200);
    assert.equal(hist.body.items.length, 3);
    await agent.post('/api/stock/in').send({ product: ids.RM, warehouse: ids.K, quantity: 1 }).expect(400);
  });

  test('warehouse with stock cannot be deleted; empty one without history is deleted', async () => {
    assert.equal((await agent.delete(`/api/warehouses/${ids.K}`)).status, 409);
    const w = await agent.post('/api/warehouses').send({ name: 'Temp', code: 'TMP', location: 'X', city: 'X', state: 'X' }).expect(201);
    const res = await agent.delete(`/api/warehouses/${w.body.warehouse._id}`).expect(200);
    assert.equal(res.body.mode, 'deleted');
  });

  test('stock unit is locked once stock has moved', async () => {
    const res = await agent.put(`/api/products/${ids.P}`).send({ name: 'PLA Cup', sku: 'P001', category: 'Cups', unit: 'ML', stockUnit: 'Box', minimumStock: 500 });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /Stock unit cannot be changed/);
  });
});

describe('Security', () => {
  test('operator injection in body is stripped/rejected', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
  });

  test('regex characters in search are escaped', async () => {
    await agent.get('/api/products').query({ search: '(.*)+$[' }).expect(200);
  });
});
