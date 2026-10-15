/**
 * Test helpers. Tests need a running MongoDB-compatible server.
 * Set TEST_MONGO_URI (defaults to a local "ims_test" database, which is dropped).
 */
process.env.NODE_ENV = 'test';
process.env.MONGO_URI = process.env.TEST_MONGO_URI || 'mongodb://127.0.0.1:27017/ims_test';
process.env.JWT_SECRET = 'test-secret-that-is-long-enough-for-tests-123456';

const mongoose = require('mongoose');
const request = require('supertest');
const { connectDB } = require('../src/config/db');
const { ensureDefaultUnits } = require('../src/services/unit.service');
const createApp = require('../src/app');

async function setup() {
  await connectDB(process.env.MONGO_URI);
  await mongoose.connection.db.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
  await ensureDefaultUnits();
  const app = createApp();
  const agent = request.agent(app);
  await agent
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'test@example.com', password: 'Passw0rd!', confirmPassword: 'Passw0rd!' })
    .expect(201);
  return { app, agent };
}

async function teardown() {
  await mongoose.connection.db.dropDatabase();
  await mongoose.disconnect();
}

module.exports = { setup, teardown, request };
