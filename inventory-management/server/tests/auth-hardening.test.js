const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setup, teardown, request } = require('./helpers');
const { User } = require('../src/models');
const env = require('../src/config/env');

let app;
const originalRegistrationSetting = env.allowRegistration;
const originalGoogleClientId = env.googleClientId;
const originalFetch = global.fetch;

before(async () => {
  ({ app } = await setup());
});

after(async () => {
  env.allowRegistration = originalRegistrationSetting;
  env.googleClientId = originalGoogleClientId;
  global.fetch = originalFetch;
  await teardown();
});

test('public signup creates a non-admin account without billing permissions', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'Public User',
    email: 'public-user@example.com',
    password: 'Passw0rd!',
    confirmPassword: 'Passw0rd!',
  }).expect(201);

  assert.equal(response.body.user.role, 'user');
  assert.ok(!response.body.user.permissions.includes('billing.view'));
  assert.ok(!response.body.user.permissions.includes('billing.manage'));
  assert.ok(!response.body.user.permissions.includes('stock.in'));
  assert.ok(!response.body.user.permissions.includes('stock.out'));
  assert.equal(await User.countDocuments({ role: 'admin' }), 1);
});

test('registration remains closed on an empty database when disabled', async () => {
  await User.deleteMany({});
  env.allowRegistration = false;

  await request(app).post('/api/auth/register').send({
    name: 'Unapproved Admin',
    email: 'claim-admin@example.com',
    password: 'Passw0rd!',
    confirmPassword: 'Passw0rd!',
  }).expect(403);
  assert.equal(await User.estimatedDocumentCount(), 0);
});

test('Google signup cannot claim admin when registration is disabled on an empty database', async () => {
  env.googleClientId = 'test-google-client-id';
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      aud: env.googleClientId,
      email_verified: 'true',
      email: 'google-claim@example.com',
      name: 'Google Claim',
      exp: Math.floor(Date.now() / 1000) + 60,
    }),
  });

  await request(app).post('/api/auth/google').send({ credential: 'a-valid-test-credential-long-enough' }).expect(403);
  assert.equal(await User.estimatedDocumentCount(), 0);
});

test('Google signup never grants admin privileges when registration is enabled', async () => {
  env.allowRegistration = true;

  const response = await request(app).post('/api/auth/google')
    .send({ credential: 'a-valid-test-credential-long-enough' })
    .expect(200);

  assert.equal(response.body.user.role, 'user');
  assert.equal(await User.countDocuments({ role: 'admin' }), 0);
});
