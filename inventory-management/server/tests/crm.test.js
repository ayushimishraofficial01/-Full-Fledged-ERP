const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown } = require('./helpers');

let agent;

before(async () => {
  ({ agent } = await setup());
});

after(teardown);

test('lead product categories can be saved, listed, and filtered', async () => {
  await agent.post('/api/crm/leads').send({
    name: 'Bagasse Buyer', productCategory: 'Bagasse', requirement: '500 ml bowls',
  }).expect(201);
  await agent.post('/api/crm/leads').send({
    name: 'Custom Category Buyer', productCategory: 'Jute', requirement: 'Custom packaging',
  }).expect(201);
  await agent.post('/api/crm/leads').send({ name: 'Legacy Lead' }).expect(201);

  const categories = await agent.get('/api/crm/leads').expect(200);
  assert.deepEqual(categories.body.categories, ['Bagasse', 'Jute']);

  const bagasse = await agent.get('/api/crm/leads').query({ productCategory: 'Bagasse' }).expect(200);
  assert.equal(bagasse.body.pagination.total, 1);
  assert.equal(bagasse.body.items[0].name, 'Bagasse Buyer');
  assert.equal(bagasse.body.items[0].requirement, '500 ml bowls');

  const uncategorized = await agent.get('/api/crm/leads').query({ productCategory: '__uncategorized__' }).expect(200);
  assert.equal(uncategorized.body.pagination.total, 1);
  assert.equal(uncategorized.body.items[0].name, 'Legacy Lead');
});