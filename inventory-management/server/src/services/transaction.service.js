const mongoose = require('mongoose');
const { supportsTransactions } = require('../config/db');

/**
 * Runs `work(session, undo)` atomically.
 *
 * - Replica set / Atlas: a real MongoDB multi-document transaction. Any thrown error aborts
 *   every write made with `session`.
 * - Standalone MongoDB (no transactions): writes run without a session and each step
 *   registers a compensating action in `undo`; on failure they run in reverse order so
 *   stock is restored. Every individual stock write is still an atomic conditional update,
 *   so stock can never go negative even under concurrency.
 *
 * Duplicate-key races on first-time inventory upserts are retried once.
 */
async function runAtomic(work, { retries = 1 } = {}) {
  try {
    return await attempt(work);
  } catch (err) {
    if (retries > 0 && err && err.code === 11000 && /inventor/i.test(String(err.message))) {
      return runAtomic(work, { retries: retries - 1 });
    }
    throw err;
  }
}

async function attempt(work) {
  if (supportsTransactions()) {
    const session = await mongoose.startSession();
    try {
      let result;
      await session.withTransaction(
        async () => {
          result = await work(session, null);
        },
        { readConcern: { level: 'snapshot' }, writeConcern: { w: 'majority' } }
      );
      return result;
    } finally {
      await session.endSession();
    }
  }

  const undo = [];
  try {
    return await work(null, undo);
  } catch (err) {
    for (const step of undo.reverse()) {
      try {
        await step();
      } catch (rollbackErr) {
        console.error('[CRITICAL] Stock rollback step failed. Manual review required.', rollbackErr);
      }
    }
    throw err;
  }
}

module.exports = { runAtomic };
