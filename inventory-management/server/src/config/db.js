const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const env = require('./env');

mongoose.set('strictQuery', true);

let transactionSupport = null;
let memoryMongoServer = null;

async function connectDB(uri = env.mongoUri, { allowMemoryFallback = true } = {}) {
  const connectOptions = { autoIndex: true, serverSelectionTimeoutMS: 10000 };

  try {
    await mongoose.connect(uri, connectOptions);
  } catch (error) {
    const shouldFallbackToMemoryDb = allowMemoryFallback && !env.isProd && (
      uri === env.mongoUri ||
      uri.includes('127.0.0.1') ||
      uri.includes('localhost')
    );

    if (!shouldFallbackToMemoryDb) {
      throw error;
    }

    if (!memoryMongoServer) {
      console.warn(`MongoDB not reachable at ${uri}; starting in-memory MongoDB for development.`);
      memoryMongoServer = await MongoMemoryServer.create({
        binary: { version: '7.0.14' },
        instance: { dbName: 'inventory_management' },
      });
    }

    await mongoose.connect(memoryMongoServer.getUri(), connectOptions);
  }

  transactionSupport = null;
  await detectTransactionSupport();
  return mongoose.connection;
}

/**
 * Multi-document transactions need a replica set or sharded cluster.
 * MongoDB Atlas always supports them; a standalone local mongod does not.
 */
async function detectTransactionSupport() {
  if (env.useTransactions === 'always') return (transactionSupport = true);
  if (env.useTransactions === 'never') return (transactionSupport = false);
  try {
    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    transactionSupport = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    transactionSupport = false;
  }
  return transactionSupport;
}

function supportsTransactions() {
  return transactionSupport === true;
}

async function disconnectDB() {
  await mongoose.disconnect();
}

module.exports = { connectDB, disconnectDB, supportsTransactions, detectTransactionSupport };
