const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, request } = require('./helpers');
const { User } = require('../src/models');

let app;
let admin;

before(async () => {
  ({ app, agent: admin } = await setup());
});

after(teardown);

test('admins can create custom roles, assign them to users, and reject duplicate or unknown roles', async () => {
  const createdRole = await admin.post('/api/access/roles').send({
    name: 'Sales Supervisor',
    description: 'Sales oversight access',
    permissions: ['dashboard.view', 'orders.view', 'sales_visits.view'],
  }).expect(201);
  assert.equal(createdRole.body.role.name, 'SALES SUPERVISOR');
  assert.deepEqual(createdRole.body.role.permissions, ['dashboard.view', 'orders.view', 'sales_visits.view']);

  await admin.post('/api/access/roles').send({
    name: 'sales supervisor',
    description: 'Duplicate role',
    permissions: [],
  }).expect(409);

  const user = await admin.post('/api/access/users').send({
    name: 'Custom Role User',
    email: 'custom-role@example.com',
    password: 'Passw0rd!',
    role: 'sales supervisor',
  }).expect(201);
  assert.equal(user.body.user.role, 'sales supervisor');

  const login = request.agent(app);
  const loggedIn = await login.post('/api/auth/login').send({
    email: 'custom-role@example.com',
    password: 'Passw0rd!',
  }).expect(200);
  assert.ok(loggedIn.body.user.permissions.includes('sales_visits.view'));
  assert.ok(!loggedIn.body.user.permissions.includes('sales_expenses.create'));

  await admin.put(`/api/access/users/${user.body.user.id}`).send({ role: 'missing role' }).expect(400);
  await admin.put(`/api/access/users/${user.body.user.id}`).send({ role: 'sales supervisor' }).expect(200);

  const storedUser = await User.findById(user.body.user.id).lean();
  assert.equal(storedUser.role, 'sales supervisor');
});
