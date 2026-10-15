const { SalesShift, SalesStaff, SalesVisit, User } = require('../models');

async function ensureSalesStaff(userId, officeSchedule) {
  const update = { $setOnInsert: { user: userId } };
  if (officeSchedule !== undefined) update.$set = { officeSchedule: officeSchedule || null };
  return SalesStaff.findOneAndUpdate(
    { user: userId },
    update,
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
}

async function getOfficeSchedule(userId) {
  const staff = await SalesStaff.findOne({ user: userId }).select('officeSchedule').lean();
  return staff?.officeSchedule || null;
}

async function getOfficeSchedules(userIds) {
  const staff = await SalesStaff.find({ user: { $in: userIds } }).select('user officeSchedule').lean();
  return new Map(staff.map((item) => [String(item.user), item.officeSchedule || null]));
}

async function setOfficeSchedule(userId, officeSchedule) {
  return ensureSalesStaff(userId, officeSchedule);
}

async function migrateSalesStaffData() {
  const legacyUsers = await User.collection.find({ officeSchedule: { $exists: true, $ne: null } })
    .project({ _id: 1, officeSchedule: 1 })
    .toArray();

  for (const user of legacyUsers) {
    const staff = await SalesStaff.findOne({ user: user._id });
    if (!staff) await ensureSalesStaff(user._id, user.officeSchedule);
    else if (!staff.officeSchedule) {
      staff.officeSchedule = user.officeSchedule;
      await staff.save();
    }
    await User.collection.updateOne({ _id: user._id }, { $unset: { officeSchedule: '' } });
  }

  const [shiftUsers, visitUsers, salesUsers] = await Promise.all([
    SalesShift.distinct('user', { salesStaff: { $exists: false } }),
    SalesVisit.distinct('user', { salesStaff: { $exists: false } }),
    User.distinct('_id', { role: 'sales' }),
  ]);
  const userIds = new Map([...shiftUsers, ...visitUsers, ...salesUsers].map((id) => [String(id), id]));
  for (const userId of userIds.values()) {
    const staff = await ensureSalesStaff(userId);
    await Promise.all([
      SalesShift.updateMany({ user: userId, salesStaff: { $exists: false } }, { $set: { salesStaff: staff._id } }),
      SalesVisit.updateMany({ user: userId, salesStaff: { $exists: false } }, { $set: { salesStaff: staff._id } }),
    ]);
  }
}

module.exports = { ensureSalesStaff, getOfficeSchedule, getOfficeSchedules, setOfficeSchedule, migrateSalesStaffData };
