const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, request } = require('./helpers');
const { SalesExpense, User } = require('../src/models');

let app;
let agent;

before(async () => {
  ({ app, agent } = await setup());
});

after(teardown);

test('sales users can submit named daily expenses and only see their own records', async () => {
  const firstSalesperson = await User.create({
    name: 'Expense Salesperson One',
    email: 'expense-sales-one@example.com',
    password: 'Passw0rd!',
    role: 'sales',
  });
  const secondSalesperson = await User.create({
    name: 'Expense Salesperson Two',
    email: 'expense-sales-two@example.com',
    password: 'Passw0rd!',
    role: 'sales',
  });
  const firstAgent = request.agent(app);
  const secondAgent = request.agent(app);
  await firstAgent.post('/api/auth/login').send({ email: firstSalesperson.email, password: 'Passw0rd!' }).expect(200)
    .then((response) => {
      assert.ok(response.body.user.permissions.includes('sales_expenses.create'));
      assert.ok(response.body.user.permissions.includes('sales_expenses.view'));
    });
  await secondAgent.post('/api/auth/login').send({ email: secondSalesperson.email, password: 'Passw0rd!' }).expect(200);

  const created = await firstAgent.post('/api/sales-expenses').send({
    expenseDate: new Date().toISOString(),
    amount: 245.5,
    note: 'Taxi to customer visit',
  }).expect(201);
  assert.equal(created.body.expense.amount, 245.5);
  assert.equal(created.body.expense.note, 'Taxi to customer visit');
  assert.equal(created.body.expense.submittedByName, firstSalesperson.name);
  assert.equal(String(created.body.expense.submittedBy), String(firstSalesperson._id));

  await firstAgent.post('/api/sales-expenses').send({
    expenseDate: new Date().toISOString(),
    amount: 0.29,
    note: 'Small parking fee',
  }).expect(201);

  await firstAgent.get('/api/sales-expenses').expect(200).then((response) => {
    assert.equal(response.body.pagination.total, 2);
    assert.equal(response.body.items[0].submittedByName, firstSalesperson.name);
  });
  await secondAgent.get('/api/sales-expenses').expect(200).then((response) => {
    assert.equal(response.body.pagination.total, 0);
  });
  await firstAgent.post('/api/sales-expenses').send({
    expenseDate: new Date().toISOString(),
    amount: -10,
    note: 'Invalid expense',
  }).expect(400);

  const savedExpense = await SalesExpense.findById(created.body.expense._id).lean();
  assert.equal(String(savedExpense.submittedBy), String(firstSalesperson._id));
});
