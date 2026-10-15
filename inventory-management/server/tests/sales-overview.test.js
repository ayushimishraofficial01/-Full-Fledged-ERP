const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const { setup, teardown, request } = require('./helpers');
const { SalesExpense, SalesOrder, SalesStaff, SalesShift, SalesVisit, User } = require('../src/models');

let app;
let admin;

before(async () => {
  ({ app, agent: admin } = await setup());
});

after(teardown);

test('admin sales overview combines and filters employees expenses, orders, and visits', async () => {
  const employee = await User.create({
    name: 'Overview Salesperson',
    email: 'overview-sales@example.com',
    password: 'Passw0rd!',
    role: 'sales',
  });
  const staff = await SalesStaff.create({ user: employee._id });
  const expenseDate = new Date();
  const shift = await SalesShift.create({
    salesStaff: staff._id,
    user: employee._id,
    startedAt: expenseDate,
    consentAt: expenseDate,
    latestLocation: { latitude: 28.6139, longitude: 77.209, accuracy: 10, recordedAt: expenseDate },
    track: [],
  });
  await SalesExpense.create({
    expenseDate,
    amount: 325.5,
    note: 'Travel for customer visit',
    submittedBy: employee._id,
    submittedByName: employee.name,
  });
  await SalesOrder.create({
    orderNumber: 'ORD-OVERVIEW-001',
    customerName: 'Overview Customer',
    items: [{ product: new mongoose.Types.ObjectId(), productName: 'Overview Product', sku: 'OVERVIEW-1', quantity: 3, unit: 'PCS' }],
    orderDate: expenseDate,
    createdBy: employee._id,
  });
  await SalesVisit.create({
    shift: shift._id,
    salesStaff: staff._id,
    user: employee._id,
    placeName: 'Overview Customer',
    notes: 'Discussed requirements',
    geofence: { latitude: 28.6139, longitude: 77.209, radiusMeters: 150 },
    checkIn: {
      location: { latitude: 28.6139, longitude: 77.209, accuracy: 10, recordedAt: expenseDate },
      at: expenseDate,
    },
  });

  const result = await admin.get('/api/sales-overview')
    .query({ from: expenseDate.toISOString(), to: new Date(expenseDate.getTime() + 1000).toISOString() })
    .expect(200);
  assert.equal(result.body.summary.expenses.count, 1);
  assert.equal(result.body.summary.expenses.amount, 325.5);
  assert.equal(result.body.summary.orders.count, 1);
  assert.equal(result.body.summary.visits.count, 1);
  assert.ok(result.body.employees.some((item) => String(item._id) === String(employee._id)));
  assert.equal(result.body.expenses.items[0].submittedByName, employee.name);
  assert.equal(result.body.orders.items[0].createdBy.name, employee.name);
  assert.equal(result.body.visits.items[0].user.name, employee.name);

  const filtered = await admin.get('/api/sales-overview').query({ userId: String(employee._id) }).expect(200);
  assert.equal(filtered.body.summary.expenses.count, 1);
  assert.equal(filtered.body.orders.pagination.total, 1);
  assert.equal(filtered.body.visits.pagination.total, 1);

  const salesperson = request.agent(app);
  await salesperson.post('/api/auth/login').send({ email: employee.email, password: 'Passw0rd!' }).expect(200);
  await salesperson.get('/api/sales-overview').expect(403);

  const managerUser = await User.create({
    name: 'Overview Manager',
    email: 'overview-manager@example.com',
    password: 'Passw0rd!',
    role: 'manager',
  });
  const manager = request.agent(app);
  await manager.post('/api/auth/login').send({ email: managerUser.email, password: 'Passw0rd!' }).expect(200);
  await manager.get('/api/sales-overview').expect(403);
});
