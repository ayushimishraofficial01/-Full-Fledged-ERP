const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, request } = require('./helpers');
const { removeSalesVisitEvidence } = require('../src/middleware/upload');

let app;
let agent;
let evidenceFilename;
const site = { latitude: 28.6139, longitude: 77.209 };

before(async () => {
  ({ app, agent } = await setup());
});

after(async () => {
  if (evidenceFilename) removeSalesVisitEvidence(evidenceFilename);
  await teardown();
});

test('admins can create scheduled sales users and office hours are enforced', async () => {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
  const weekdayNumber = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[weekday];
  const { isWithinOfficeHours } = require('../src/services/office-hours.service');
  assert.equal(isWithinOfficeHours({
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'Asia/Kolkata',
    weekdays: [(weekdayNumber + 1) % 7],
  }), false);

  const created = await agent.post('/api/access/users').send({
    name: 'Scheduled Sales User',
    email: 'sales@example.com',
    password: 'Passw0rd!',
    role: 'sales',
    officeSchedule: {
      startTime: '00:00',
      endTime: '23:59',
      timezone: 'Asia/Kolkata',
      weekdays: [(weekdayNumber + 1) % 7],
    },
  }).expect(201);
  const userId = created.body.user.id;
  assert.equal(created.body.user.role, 'sales');
  assert.equal(created.body.user.officeSchedule.timezone, 'Asia/Kolkata');
  const { User, SalesStaff } = require('../src/models');
  const storedUser = await User.collection.findOne({ _id: new (require('mongoose').Types.ObjectId)(userId) });
  assert.equal(storedUser.officeSchedule, undefined);
  const salesStaff = await SalesStaff.findOne({ user: userId }).lean();
  assert.equal(salesStaff.officeSchedule.timezone, 'Asia/Kolkata');
  await agent.get('/api/access/users').expect(200).then((response) => {
    const listed = response.body.users.find((user) => String(user._id) === String(userId));
    assert.equal(listed.officeSchedule.startTime, '00:00');
  });

  const staff = request.agent(app);
  const login = await staff.post('/api/auth/login').send({ email: 'sales@example.com', password: 'Passw0rd!' }).expect(200);
  assert.ok(login.body.user.permissions.includes('sales_visits.track'));
  await staff.get('/api/sales-visits/current').expect(200).then((response) => {
    assert.equal(response.body.officeSchedule.timezone, 'Asia/Kolkata');
  });
  await staff.post('/api/sales-visits/shifts/start')
    .send({ consent: true, location: { ...site, accuracy: 10 } })
    .expect(403);
  await agent.put(`/api/access/users/${userId}`).send({
    officeSchedule: {
      startTime: '00:00',
      endTime: '23:59',
      timezone: 'Asia/Kolkata',
      weekdays: [0, 1, 2, 3, 4, 5, 6],
    },
  }).expect(200);
  const shift = await staff.post('/api/sales-visits/shifts/start')
    .send({ consent: true, location: { ...site, accuracy: 10 } })
    .expect(201);
  assert.equal(String(shift.body.shift.salesStaff), String(salesStaff._id));
  await agent.get('/api/sales-visits/team').expect(200).then((response) => {
    const teamShift = response.body.shifts.find((item) => String(item._id) === String(shift.body.shift._id));
    assert.equal(teamShift.user.officeSchedule.timezone, 'Asia/Kolkata');
    assert.equal(String(teamShift.salesStaff._id), String(salesStaff._id));
  });
  await staff.post('/api/sales-visits/shifts/end')
    .send({ location: { ...site, accuracy: 10 } })
    .expect(200);

  await agent.post('/api/access/users').send({
    name: 'Invalid Schedule User',
    email: 'invalid-schedule@example.com',
    password: 'Passw0rd!',
    role: 'user',
    officeSchedule: {
      startTime: '18:00',
      endTime: '09:00',
      timezone: 'Asia/Kolkata',
      weekdays: [1, 2, 3, 4, 5],
    },
  }).expect(400);
});

test('legacy sales schedules and history migrate into sales staff records', async () => {
  const mongoose = require('mongoose');
  const { User, SalesStaff } = require('../src/models');
  const legacyUser = await User.create({
    name: 'Legacy Sales User',
    email: 'legacy-sales@example.com',
    password: 'Passw0rd!',
    role: 'user',
  });
  const officeSchedule = {
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'Asia/Kolkata',
    weekdays: [1, 2, 3, 4, 5],
  };
  await User.collection.updateOne({ _id: legacyUser._id }, { $set: { officeSchedule } });
  const shiftId = new mongoose.Types.ObjectId();
  const oldLocation = { latitude: site.latitude, longitude: site.longitude, accuracy: 10, recordedAt: new Date() };
  await mongoose.connection.collection('salesshifts').insertOne({
    _id: shiftId,
    user: legacyUser._id,
    startedAt: new Date(),
    endedAt: new Date(),
    consentAt: new Date(),
    isActive: false,
    visitActive: false,
    latestLocation: oldLocation,
    track: [oldLocation],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  const visitId = new mongoose.Types.ObjectId();
  await mongoose.connection.collection('salesvisits').insertOne({
    _id: visitId,
    shift: shiftId,
    user: legacyUser._id,
    placeName: 'Legacy Visit',
    geofence: { latitude: site.latitude, longitude: site.longitude, radiusMeters: 150 },
    checkIn: { location: oldLocation, at: new Date() },
    checkOut: { location: null, at: null },
    durationSeconds: null,
    evidenceFilename: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await require('../src/services/sales-staff.service').migrateSalesStaffData();

  const storedUser = await User.collection.findOne({ _id: legacyUser._id });
  assert.equal(storedUser.officeSchedule, undefined);
  const staff = await SalesStaff.findOne({ user: legacyUser._id }).lean();
  assert.deepEqual(staff.officeSchedule, officeSchedule);
  const migratedShift = await mongoose.connection.collection('salesshifts').findOne({ _id: shiftId });
  const migratedVisit = await mongoose.connection.collection('salesvisits').findOne({ _id: visitId });
  assert.equal(String(migratedShift.salesStaff), String(staff._id));
  assert.equal(String(migratedVisit.salesStaff), String(staff._id));
});

test('sales shifts enforce consent, geofences, visit check-in/out and private photo access', async () => {
  const employee = request.agent(app);
  await employee.post('/api/auth/register')
    .send({ name: 'Field Staff', email: 'field@example.com', password: 'Passw0rd!', confirmPassword: 'Passw0rd!' })
    .expect(201);
  const { User } = require('../src/models');
  await User.updateOne({ email: 'field@example.com' }, { $set: { role: 'sales' } });
  await employee.get('/api/sales-visits/current').expect(200);
  await employee.get('/api/sales-visits/team').expect(403);
  const { Product } = require('../src/models');
  const product = await Product.create({
    name: 'Customer Requirement Sample',
    sku: 'REQ-SAMPLE-001',
    category: 'Samples',
    unit: 'PCS',
    stockUnit: 'Box',
    price: 48.5,
  });
  await employee.get('/api/sales-visits/products?search=REQ-SAMPLE').expect(200).then((response) => {
    assert.equal(response.body.products.length, 1);
    assert.equal(String(response.body.products[0].id), String(product._id));
    assert.equal(response.body.products[0].unit, 'Box');
    assert.equal(response.body.products[0].price, 48.5);
    assert.ok(response.body.units.some((unit) => unit.name === 'PCS'));
    assert.ok(response.body.units.some((unit) => unit.name === 'KG'));
  });
  await agent.get('/api/sales-visits/products').expect(200);

  await employee.get('/api/sales-visits/current').expect(200).then((response) => {
    assert.equal(response.body.shift, null);
    assert.equal(response.body.geofenceRadiusMeters, 150);
  });

  await employee.post('/api/sales-visits/shifts/start')
    .send({ consent: false, location: { ...site, accuracy: 10 } })
    .expect(400);

  const started = await employee.post('/api/sales-visits/shifts/start')
    .send({ consent: true, location: { ...site, accuracy: 10 } })
    .expect(201);
  const shiftId = started.body.shift._id;
  const { SalesStaff } = require('../src/models');
  const employeeUser = await User.findOne({ email: 'field@example.com' });
  const salesStaff = await SalesStaff.findOne({ user: employeeUser._id });
  assert.equal(String(started.body.shift.salesStaff), String(salesStaff._id));

  await agent.get('/api/sales-visits/team').expect(200);
  await employee.post('/api/sales-visits/shifts/location')
    .send({ location: { ...site, accuracy: 10 } })
    .expect(200)
    .then((response) => assert.equal(response.body.recorded, false));

  await employee.post('/api/sales-visits/shifts/start')
    .send({ consent: true, location: { ...site, accuracy: 10 } })
    .expect(409);

  const distant = await employee.post('/api/sales-visits/visits/check-in')
    .send({
      placeName: 'Visit Site',
      geofence: site,
      location: { latitude: 28.6339, longitude: 77.209, accuracy: 10 },
    })
    .expect(403);
  assert.match(distant.body.message, /outside this visit/i);

  await employee.post('/api/sales-visits/visits/check-in')
    .send({ placeName: 'Visit Site', geofence: site, location: { ...site, accuracy: 150 } })
    .expect(422);

  await employee.post('/api/sales-visits/visits/check-in')
    .send({
      placeName: 'Visit Site',
      requirements: [{ productId: product.id, quantity: 1.2345 }],
      geofence: site,
      location: { ...site, accuracy: 10 },
    })
    .expect(400);

  await employee.post('/api/sales-visits/visits/check-in')
    .send({
      placeName: 'Visit Site',
      requirements: [{ productId: new (require('mongoose').Types.ObjectId)().toString(), quantity: 2 }],
      geofence: site,
      location: { ...site, accuracy: 10 },
    })
    .expect(400);

  await employee.post('/api/sales-visits/visits/check-in')
    .send({
      placeName: 'Visit Site',
      requirements: [{ productId: String(product._id), quantity: 2, unit: 'made-up-unit' }],
      geofence: site,
      location: { ...site, accuracy: 10 },
    })
    .expect(400);

  const checkedIn = await employee.post('/api/sales-visits/visits/check-in')
    .send({
      placeName: 'Visit Site',
      requirements: [{ productId: String(product._id), quantity: 12, unit: 'KG', unitPrice: 53.25, note: 'Customer wants delivery this week.' }],
      geofence: site,
      location: { ...site, accuracy: 10 },
    })
    .expect(201);
  const visitId = checkedIn.body.visit._id;
  assert.equal(checkedIn.body.order.source, 'Sales Visit');
  assert.equal(String(checkedIn.body.order.salesVisit), String(visitId));
  assert.equal(checkedIn.body.order.customerName, 'Visit Site');
  assert.equal(checkedIn.body.order.items[0].quantity, 12);
  assert.equal(checkedIn.body.order.items[0].unitPrice, 53.25);
  assert.equal(checkedIn.body.order.items[0].lineTotal, 639);
  assert.equal(checkedIn.body.order.totalAmount, 639);
  assert.equal(String(checkedIn.body.visit.salesStaff), String(salesStaff._id));
  assert.deepEqual(checkedIn.body.visit.requirements.map((item) => ({
    productName: item.productName,
    sku: item.sku,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    note: item.note,
  })), [{
    productName: product.name,
    sku: product.sku,
    quantity: 12,
    unit: 'KG',
    unitPrice: 53.25,
    note: 'Customer wants delivery this week.',
  }]);
  await employee.get('/api/sales-visits/history').expect(200).then((response) => {
    assert.ok(response.body.shifts.some((item) => String(item.salesStaff) === String(salesStaff._id)));
    const historyVisit = response.body.visits.find((item) => String(item.salesStaff) === String(salesStaff._id));
    assert.equal(historyVisit.requirements[0].productName, product.name);
    assert.equal(historyVisit.requirements[0].quantity, 12);
  });
  await employee.get('/api/orders').expect(200).then((response) => {
    const visitOrder = response.body.items.find((item) => String(item.salesVisit?._id || item.salesVisit) === String(visitId));
    assert.ok(visitOrder);
    assert.equal(visitOrder.items[0].productName, product.name);
  });
  await agent.get('/api/sales-visits/team').expect(200).then((response) => {
    const teamVisit = response.body.shifts.find((item) => String(item._id) === String(shiftId)).visits
      .find((item) => String(item._id) === String(visitId));
    assert.equal(teamVisit.requirements[0].productName, product.name);
  });
  await employee.post('/api/sales-visits/shifts/end')
    .send({ location: { ...site, accuracy: 10 } })
    .expect(409);

  await employee.post('/api/sales-visits/visits/check-in')
    .send({ placeName: 'Second Site', geofence: site, location: { ...site, accuracy: 10 } })
    .expect(409);

  await employee.post(`/api/sales-visits/visits/${visitId}/check-out`)
    .field('location', JSON.stringify({ ...site, accuracy: 10 }))
    .expect(400);

  await employee.post(`/api/sales-visits/visits/${visitId}/check-out`)
    .field('location', JSON.stringify({ ...site, accuracy: 10 }))
    .attach('image', Buffer.from('not an image'), { filename: 'proof.png', contentType: 'image/png' })
    .expect(400);

  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/V9sAAAAASUVORK5CYII=', 'base64');
  await employee.post(`/api/sales-visits/visits/${visitId}/check-out`)
    .field('location', JSON.stringify({ latitude: 28.6339, longitude: 77.209, accuracy: 10 }))
    .attach('image', png, { filename: 'outside.png', contentType: 'image/png' })
    .expect(403);

  const checkedOut = await employee.post(`/api/sales-visits/visits/${visitId}/check-out`)
    .field('location', JSON.stringify({ ...site, accuracy: 10 }))
    .attach('image', png, { filename: 'proof.png', contentType: 'image/png' })
    .expect(200);
  evidenceFilename = checkedOut.body.visit.evidenceFilename;
  assert.ok(checkedOut.body.visit.checkOut.at);
  assert.ok(checkedOut.body.visit.durationSeconds >= 0);

  const photo = await employee.get(`/api/sales-visits/visits/${visitId}/photo`).expect(200);
  assert.equal(photo.headers['cache-control'], 'private, no-store');
  assert.match(photo.headers['content-type'], /image\/png/);
  await request(app).get(`/api/sales-visits/visits/${visitId}/photo`).expect(401);

  const ended = await employee.post('/api/sales-visits/shifts/end')
    .send({ location: { ...site, accuracy: 10 } })
    .expect(200);
  assert.equal(ended.body.shift.isActive, false);
  assert.equal(String(ended.body.shift._id), String(shiftId));

  await employee.post('/api/sales-visits/shifts/location')
    .send({ location: { ...site, accuracy: 10 } })
    .expect(409);
});
