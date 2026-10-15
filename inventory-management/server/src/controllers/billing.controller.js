const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Invoice, Setting } = require('../models');

const BUSINESS_SETTINGS_KEY = 'billing.business-settings';

const getSettings = asyncHandler(async (_req, res) => {
  const record = await Setting.findOne({ key: BUSINESS_SETTINGS_KEY }).lean();
  res.json({ settings: record?.value || null });
});

const saveSettings = asyncHandler(async (req, res) => {
  const record = await Setting.findOne({ key: BUSINESS_SETTINGS_KEY }).lean();
  const settings = { ...(record?.value || {}), ...req.body };
  await Setting.updateOne(
    { key: BUSINESS_SETTINGS_KEY },
    { $set: { value: settings, updatedBy: req.user._id } },
    { upsert: true }
  );
  res.json({ message: 'Billing business settings saved.', settings });
});

const list = asyncHandler(async (_req, res) => {
  const invoices = await Invoice.find({})
    .sort({ date: -1, updatedAt: -1 })
    .limit(2000)
    .lean();
  res.json({ invoices: invoices.map(({ data, _id, createdAt, updatedAt }) => ({ ...data, _id, createdAt, updatedAt })) });
});

const save = asyncHandler(async (req, res) => {
  const { invoiceId, customer, date, status, subtotal, total, data } = req.body;
  const invoice = await Invoice.findOneAndUpdate(
    { invoiceId },
    { $set: { invoiceId, customer, date, status, subtotal, total, data, savedBy: req.user._id } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  ).lean();
  res.status(200).json({ message: 'Invoice saved.', invoice: { ...invoice.data, _id: invoice._id, createdAt: invoice.createdAt, updatedAt: invoice.updatedAt } });
});

const remove = asyncHandler(async (req, res) => {
  const invoice = await Invoice.findOneAndDelete({ invoiceId: req.params.invoiceId });
  if (!invoice) throw ApiError.notFound('Invoice not found.');
  res.json({ message: 'Invoice removed.' });
});

module.exports = { getSettings, saveSettings, list, save, remove };
