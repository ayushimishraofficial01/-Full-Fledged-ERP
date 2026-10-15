const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown } = require('./helpers');
const { Customer, Product, Role, SampleDispatch, User } = require('../src/models');

let agent;
let customer;
let product;
let secondProduct;

before(async () => {
  ({ agent } = await setup());
  const user = await User.findOne({ email: 'test@example.com' });
  customer = await Customer.create({
    customerId: 'CUS-SAMPLE-001', fullName: 'Sample Test Customer', phone: '5551001000', email: 'sample.customer@example.test',
    address: { line1: '10 Test Road', city: 'Test City', state: 'Test State', pincode: '100100' }, createdBy: user._id, updatedBy: user._id,
  });
  product = await Product.create({ name: 'Sample Cup', sku: 'SAMPLE-CUP', category: 'Samples', unit: 'PCS', stockUnit: 'PCS' });
  secondProduct = await Product.create({ name: 'Sample Lid', sku: 'SAMPLE-LID', category: 'Samples', unit: 'PCS', stockUnit: 'PCS' });
});

after(teardown);

test('sample dispatch lifecycle, customer history, permissions, and Excel import/export', async () => {
  const created = await agent.post('/api/crm/sample-dispatch').send({
    customer: String(customer._id), customerName: customer.fullName, phone: customer.phone,
    sampleProducts: [
      { product: String(product._id), quantity: 2, unit: 'PCS' },
      { product: String(secondProduct._id), quantity: 1, unit: 'PCS' },
    ],
    dispatchDate: '2026-10-01', status: 'Pending', trackingNumber: 'TRACK-001',
  }).expect(201);

  const dispatch = created.body.dispatch;
  assert.match(dispatch.dispatchId, /^SD-\d{8}-[A-Z0-9]{5}$/);
  assert.equal(String(dispatch.customer), String(customer._id));
  assert.equal(dispatch.sampleProducts.length, 2);
  assert.equal(dispatch.trackingNumber, 'TRACK-001');

  const autoLinked = await agent.post('/api/crm/sample-dispatch').send({
    customerName: customer.fullName, email: customer.email,
    sampleProducts: [{ product: String(product._id), quantity: 1, unit: 'PCS' }],
    dispatchDate: '2026-10-01',
  }).expect(201);
  assert.equal(String(autoLinked.body.dispatch.customer), String(customer._id));

  const filtered = await agent.get('/api/crm/sample-dispatch')
    .query({ dispatchId: dispatch.dispatchId, customerSearch: 'Sample Test', productSearch: 'SAMPLE-LID', status: 'Pending', from: '2026-10-01', to: '2026-10-01' })
    .expect(200);
  assert.equal(filtered.body.pagination.total, 1);
  assert.equal(filtered.body.items[0].dispatchId, dispatch.dispatchId);
  assert.equal(filtered.body.items[0].assignedUser.name, 'Test User');

  const history = await agent.get(`/api/crm/customers/${customer._id}/sample-dispatches`).expect(200);
  assert.equal(history.body.items.length, 2);
  const linkedDispatch = history.body.items.find((item) => item.dispatchId === dispatch.dispatchId);
  assert.equal(linkedDispatch.sampleProducts[0].productName, 'Sample Cup');

  await agent.put(`/api/crm/sample-dispatch/${dispatch._id}`).send({
    customer: String(customer._id), customerName: customer.fullName, phone: customer.phone,
    sampleProducts: [{ product: String(product._id), quantity: 3, unit: 'PCS' }],
    dispatchDate: '2026-10-01', status: 'Dispatched', trackingNumber: 'TRACK-UPDATED',
  }).expect(200);
  const delivered = await agent.patch(`/api/crm/sample-dispatch/${dispatch._id}/delivered`).expect(200);
  assert.equal(delivered.body.dispatch.status, 'Delivered');
  assert.ok(delivered.body.dispatch.deliveredAt);

  const exported = await agent.get('/api/crm/sample-dispatch/export').expect(200);
  assert.match(exported.headers['content-type'], /spreadsheetml/);
  assert.match(exported.headers['content-disposition'], /sample-dispatch-/);
  const template = await agent.get('/api/crm/sample-dispatch/import/template').expect(200);
  assert.match(template.headers['content-disposition'], /sample-dispatch-template/);

  const csv = Buffer.from([
    'Customer Name,Customer Email,Sample Products (SKU:Quantity:Unit; ...),Dispatch Date,Status',
    'Sample Test Customer,sample.customer@example.test,SAMPLE-CUP:2:PCS; SAMPLE-LID:1:PCS,2026-10-01,Pending',
  ].join('\n'));
  const preview = await agent.post('/api/crm/sample-dispatch/import/preview').attach('file', csv, 'sample-dispatch.csv').expect(200);
  assert.equal(preview.body.summary.validRows, 1);
  assert.equal(preview.body.rows[0].data.sampleProducts.length, 2);
  assert.equal(String(preview.body.rows[0].data.customer), String(customer._id));

  const imported = await agent.post('/api/crm/sample-dispatch/import').send({ rows: preview.body.rows.map((row) => row.data) }).expect(201);
  assert.equal(imported.body.imported, 1);
  assert.equal(await SampleDispatch.countDocuments({ customer: customer._id }), 3);

  const manager = await Role.findOne({ name: 'MANAGER' }).lean();
  for (const permission of ['sample_dispatch.view', 'sample_dispatch.create', 'sample_dispatch.edit', 'sample_dispatch.delete', 'sample_dispatch.export']) {
    assert.ok(manager.permissions.includes(permission), `Manager role missing ${permission}`);
  }

  const user = await User.findOne({ email: 'test@example.com' });
  user.role = 'user';
  await user.save();
  await agent.get('/api/crm/sample-dispatch').expect(403);
  user.role = 'admin';
  await user.save();

  await agent.delete(`/api/crm/sample-dispatch/${dispatch._id}`).expect(200);
  await SampleDispatch.deleteMany({ customer: customer._id });
  assert.equal(await SampleDispatch.countDocuments({ customer: customer._id }), 0);
});
