const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { setup, teardown, request } = require('./helpers');
const { Customer, Inventory, Product, SalesOrder, SalesVisit, User } = require('../src/models');

let app;
let agent;
let product;

before(async () => {
  ({ app, agent } = await setup());
  product = await Product.create({
    name: 'Order Test Product',
    sku: 'ORDER-TEST-001',
    category: 'Test',
    unit: 'PCS',
    stockUnit: 'PCS',
    price: 25,
  });
});

after(teardown);

test('manual orders validate products, preserve inventory, and allow authorized status changes', async () => {
  const admin = await User.findOne({ email: 'test@example.com' });
  const customer = await Customer.create({
    customerId: 'CUS-ORDER-LOOKUP-001',
    fullName: 'Lookup Order Customer',
    phone: '5551222333',
    email: 'lookup-order@example.com',
    gstNumber: 'GST-LOOKUP-001',
    address: { line1: '12 Example Road', city: 'New Delhi', state: 'Delhi', pincode: '110001', country: 'India' },
  });
  const customerLookup = await agent.get('/api/crm/customer-lookup').query({ search: '5551222333' }).expect(200);
  assert.equal(customerLookup.body.items.length, 1);
  assert.equal(customerLookup.body.items[0].fullName, customer.fullName);
  assert.equal(customerLookup.body.items[0].address.city, 'New Delhi');
  const legacyVisit = await SalesVisit.create({
    shift: new mongoose.Types.ObjectId(),
    salesStaff: new mongoose.Types.ObjectId(),
    user: admin._id,
    placeName: 'Legacy Requirement Customer',
    requirements: [{
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: 4,
      unit: 'PCS',
      note: 'Previously recorded in a sales visit.',
    }],
    geofence: { latitude: 28.6139, longitude: 77.209, radiusMeters: 150 },
    checkIn: {
      location: { latitude: 28.6139, longitude: 77.209, accuracy: 10, recordedAt: new Date() },
      at: new Date(),
    },
  });

  const options = await agent.get('/api/orders/options').expect(200);
  assert.ok(options.body.products.some((item) => String(item.id) === String(product._id)));
  assert.equal(options.body.products.find((item) => String(item.id) === String(product._id)).price, 25);

  const created = await agent.post('/api/orders').send({
    customerId: String(customer._id),
    customerName: 'Manual Order Customer',
    phone: '5551234567',
    email: 'manual-order@example.com',
    gstNumber: 'GST-MANUAL-001',
    address: '12 Example Road, New Delhi, Delhi 110001',
    notes: 'Customer asked for delivery next week.',
    items: [{ productId: String(product._id), quantity: 12, unit: 'PCS', unitPrice: 30.5, note: 'Blue packaging' }],
  }).expect(201);
  const order = created.body.order;
  assert.match(order.orderNumber, /^ORD-\d{8}-[A-F0-9]{6}$/);
  assert.equal(order.source, 'Manual');
  assert.equal(order.status, 'Pending');
  assert.equal(order.address, '12 Example Road, New Delhi, Delhi 110001');
  assert.equal(String(order.customer), String(customer._id));
  assert.equal(order.email, 'manual-order@example.com');
  assert.equal(order.gstNumber, 'GST-MANUAL-001');
  assert.equal(order.items[0].productName, product.name);
  assert.equal(order.items[0].quantity, 12);
  assert.equal(order.items[0].unitPrice, 30.5);
  assert.equal(order.items[0].lineTotal, 366);
  assert.equal(order.totalAmount, 366);

  await agent.post('/api/orders').send({
    customerName: 'Invalid Price Order',
    items: [{ productId: String(product._id), quantity: 1, unitPrice: -1 }],
  }).expect(400);

  await agent.post('/api/orders').send({
    customerName: 'Invalid Order',
    items: [{ productId: String(product._id), quantity: 0 }],
  }).expect(400);

  const listed = await agent.get('/api/orders').query({ search: 'Manual Order Customer', status: 'Pending' }).expect(200);
  assert.equal(listed.body.pagination.total, 1);
  assert.equal(String(listed.body.items[0]._id), String(order._id));
  const addressSearch = await agent.get('/api/orders').query({ search: 'Example Road' }).expect(200);
  assert.equal(addressSearch.body.pagination.total, 1);
  const migratedOrder = await SalesOrder.findOne({ salesVisit: legacyVisit._id }).lean();
  assert.equal(migratedOrder.source, 'Sales Visit');
  assert.equal(migratedOrder.items[0].note, 'Previously recorded in a sales visit.');

  const updated = await agent.patch(`/api/orders/${order._id}/status`).send({ status: 'Confirmed' }).expect(200);
  assert.equal(updated.body.order.status, 'Confirmed');
  assert.equal(await Inventory.countDocuments({ product: product._id }), 0);

  const stored = await SalesOrder.findById(order._id).lean();
  assert.equal(stored.status, 'Confirmed');
});

test('sales staff can create orders but only see their own and cannot change order status', async () => {
  await Customer.create({
    customerId: 'CUS-ORDER-LOOKUP-002',
    fullName: 'Sales Lookup Customer',
    phone: '5551222444',
  });
  const salesperson = await User.create({
    name: 'Order Salesperson',
    email: 'orders-sales@example.com',
    password: 'Passw0rd!',
    role: 'sales',
  });
  const staff = request.agent(app);
  await staff.post('/api/auth/login').send({ email: salesperson.email, password: 'Passw0rd!' }).expect(200);

  const customerLookup = await staff.get('/api/crm/customer-lookup').query({ search: '5551222444' }).expect(200);
  assert.equal(customerLookup.body.items[0].fullName, 'Sales Lookup Customer');
  await staff.get('/api/orders').expect(200).then((response) => {
    assert.equal(response.body.pagination.total, 0);
  });
  const created = await staff.post('/api/orders').send({
    customerName: 'Sales Customer',
    items: [{ productId: String(product._id), quantity: 2, unit: 'PCS' }],
  }).expect(201);
  assert.equal(created.body.order.items[0].unitPrice, 25);
  assert.equal(created.body.order.totalAmount, 50);
  await staff.get('/api/orders').expect(200).then((response) => {
    assert.equal(response.body.pagination.total, 1);
    assert.equal(response.body.items[0].customerName, 'Sales Customer');
  });
  await staff.patch(`/api/orders/${created.body.order._id}/status`).send({ status: 'Confirmed' }).expect(403);
  await agent.get('/api/orders').expect(200).then((response) => {
    assert.equal(response.body.pagination.total, 3);
  });
});
