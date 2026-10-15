const { z } = require('zod');
const { Unit, Setting, Product } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { unitKey } = require('../utils/units');
const { invalidateUnitCache } = require('../services/unit.service');

const DEFAULT_SETTINGS = { companyName: 'My Company', defaultStockUnit: 'PCS', logo: null };

exports.unitSchema = z.object({
  name: z.string().trim().min(1, 'Unit name is required').max(20, 'Unit name must be at most 20 characters').regex(/^[A-Za-z][A-Za-z0-9 ._-]*$/, 'Use letters, numbers, spaces, ".", "-" or "_"'),
  label: z.string().trim().max(50).optional().default(''),
  category: z.enum(['weight', 'volume', 'quantity', 'length', 'other']).default('other'),
});

exports.settingsSchema = z.object({
  companyName: z.string().trim().min(1, 'Company name is required').max(120),
  defaultStockUnit: z.string().trim().min(1).max(20),
}).strict();

exports.listUnits = asyncHandler(async (req, res) => {
  const filter = req.query.all === 'true' ? {} : { isActive: true };
  const units = await Unit.find(filter).sort({ category: 1, isSystem: -1, name: 1 }).lean();
  res.json({ success: true, units });
});

exports.createUnit = asyncHandler(async (req, res) => {
  const key = unitKey(req.body.name);
  if (await Unit.exists({ key })) throw ApiError.conflict(`Unit "${req.body.name}" already exists`, [{ field: 'name', message: 'Unit already exists' }]);
  const unit = await Unit.create({ ...req.body, key, isSystem: false, createdBy: req.user._id });
  invalidateUnitCache();
  res.status(201).json({ success: true, message: 'Unit added', unit });
});

exports.toggleUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw ApiError.notFound('Unit not found');
  unit.isActive = !unit.isActive;
  await unit.save();
  invalidateUnitCache();
  res.json({ success: true, message: `Unit ${unit.isActive ? 'enabled' : 'disabled'}`, unit });
});

exports.deleteUnit = asyncHandler(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw ApiError.notFound('Unit not found');
  if (unit.isSystem) throw ApiError.badRequest('Built-in units cannot be deleted. You can disable them instead.');
  if (await Product.exists({ $or: [{ unit: unit.name }, { stockUnit: unit.name }] })) {
    throw ApiError.conflict('This unit is used by products. Disable it instead of deleting.');
  }
  await unit.deleteOne();
  invalidateUnitCache();
  res.json({ success: true, message: 'Unit deleted' });
});

exports.getSettings = asyncHandler(async (req, res) => {
  const rows = await Setting.find({ key: { $in: Object.keys(DEFAULT_SETTINGS) } }).lean();
  const settings = { ...DEFAULT_SETTINGS };
  rows.forEach((r) => { settings[r.key] = r.value; });
  res.json({ success: true, settings });
});

exports.updateSettings = asyncHandler(async (req, res) => {
  const currentLogo = await Setting.findOne({ key: 'logo' }).lean();
  const updates = { companyName: req.body.companyName, defaultStockUnit: req.body.defaultStockUnit };

  await Setting.bulkWrite(Object.entries(updates).map(([key, value]) => ({
    updateOne: { filter: { key }, update: { $set: { value, updatedBy: req.user._id } }, upsert: true },
  })));
  res.json({ success: true, message: 'Settings saved', settings: { ...DEFAULT_SETTINGS, ...updates, logo: currentLogo?.value || null } });
});
