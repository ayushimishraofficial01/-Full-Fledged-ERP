const env = require('./config/env');
const { connectDB, supportsTransactions } = require('./config/db');
const { ensureDefaultUnits } = require('./services/unit.service');
const { migrateSalesStaffData } = require('./services/sales-staff.service');
const createApp = require('./app');
const { startAttendanceReminderScheduler } = require('./services/attendance-reminder.service');

async function start() {
  await connectDB();
  await ensureDefaultUnits();
  await migrateSalesStaffData();
  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`Inventory API listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`MongoDB transactions: ${supportsTransactions() ? 'enabled (replica set)' : 'not available - using atomic updates with compensation'}`);
  });
  const attendanceReminderTimer = startAttendanceReminderScheduler();

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down...`);
    clearInterval(attendanceReminderTimer);
    server.close(async () => {
      const mongoose = require('mongoose');
      await mongoose.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
});

start().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
