const XLSX = require('xlsx');
const mongoose = require('mongoose');
const env = require('../config/env');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { SampleDispatch, Customer, Product, Unit, CRMActivity } = require('../models');
const { searchRegex, getPagination, paginated, dateRange } = require('../utils/query');
const { buildWorkbook, sendWorkbook } = require('../services/export.service');

const STATUSES = ['Pending', 'Dispatched', 'Delivered', 'Cancelled'];
const makeDispatchId = () => `SD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
const text = (value) => String(value ?? '').trim();
const addressText = (address = {}) => [address.line1, address.line2].filter(Boolean).join(', ');

function toObjectId(value) {
  return mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(String(value)) : null;
}

async function normalizePayload(body, userId) {
  if (!Array.isArray(body.sampleProducts) || !body.sampleProducts.length) {
    throw ApiError.badRequest('Add at least one sample product.');
  }

  const productIds = body.sampleProducts.map((item) => toObjectId(item.product)).filter(Boolean);
  if (productIds.length !== body.sampleProducts.length) throw ApiError.badRequest('Select a valid product for each sample item.');
  const products = await Product.find({ _id: { $in: productIds }, isArchived: { $ne: true }, status: 'active' }).select('name sku stockUnit').lean();
  const byId = new Map(products.map((product) => [String(product._id), product]));
  const sampleProducts = body.sampleProducts.map((item) => {
    const product = byId.get(String(item.product));
    const quantity = Number(item.quantity);
    if (!product) throw ApiError.badRequest('One or more selected products are unavailable.');
    if (!Number.isFinite(quantity) || quantity <= 0) throw ApiError.badRequest('Sample quantities must be greater than zero.');
    const unit = text(item.unit) || product.stockUnit;
    if (!unit) throw ApiError.badRequest(`Choose a unit for ${product.name}.`);
    return { product: product._id, productName: product.name, sku: product.sku, quantity, unit };
  });

  const customerId = body.customer && body.customer !== 'null' ? toObjectId(body.customer) : null;
  if (body.customer && !customerId) throw ApiError.badRequest('Select a valid CRM customer.');
  let customer = customerId
    ? await Customer.findOne({ _id: customerId, status: { $ne: 'archived' } }).populate('company', 'name').lean()
    : null;
  if (!customer && !customerId) {
    const email = text(body.email).toLowerCase();
    const phone = text(body.phone);
    if (email) customer = await Customer.findOne({ email, status: { $ne: 'archived' } }).populate('company', 'name').lean();
    if (!customer && phone) customer = await Customer.findOne({ phone, status: { $ne: 'archived' } }).populate('company', 'name').lean();
  }
  if (customerId && !customer) throw ApiError.badRequest('The selected CRM customer was not found.');
  const dispatchDate = body.dispatchDate ? new Date(body.dispatchDate) : new Date();
  const expectedDeliveryDate = body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null;
  if (Number.isNaN(dispatchDate.getTime())) throw ApiError.badRequest('Enter a valid dispatch date.');
  if (expectedDeliveryDate && Number.isNaN(expectedDeliveryDate.getTime())) throw ApiError.badRequest('Enter a valid expected delivery date.');
  const status = text(body.status) || 'Pending';
  if (!STATUSES.includes(status)) throw ApiError.badRequest('Choose a valid dispatch status.');
  const customerAddress = customer?.address || {};

  return {
    customer: customer?._id || null,
    customerName: text(body.customerName) || customer?.fullName || '',
    companyName: text(body.companyName) || (customer?.company && typeof customer.company === 'object' ? customer.company.name : ''),
    phone: text(body.phone) || customer?.phone || '',
    email: text(body.email) || customer?.email || '',
    completeAddress: text(body.completeAddress) || addressText(customerAddress),
    city: text(body.city) || customerAddress.city || '',
    state: text(body.state) || customerAddress.state || '',
    pincode: text(body.pincode) || customerAddress.pincode || '',
    sampleProducts,
    dispatchDate,
    dispatchMethod: text(body.dispatchMethod),
    trackingNumber: text(body.trackingNumber),
    expectedDeliveryDate,
    status,
    remarks: text(body.remarks),
    ...(userId ? { assignedUser: userId } : {}),
  };
}

function buildFilter(query) {
  const filter = {};
  if (STATUSES.includes(query.status)) filter.status = query.status;
  const dispatchId = searchRegex(query.dispatchId);
  if (dispatchId) filter.dispatchId = dispatchId;
  const range = dateRange(query.from, query.to);
  if (range) filter.dispatchDate = range;
  if (query.customer) {
    const customerId = toObjectId(query.customer);
    if (customerId) filter.customer = customerId;
  }
  const clauses = [];
  const customerSearch = searchRegex(query.customerSearch);
  if (customerSearch) clauses.push({ $or: [{ customerName: customerSearch }, { companyName: customerSearch }, { phone: customerSearch }, { email: customerSearch }] });
  const productSearch = searchRegex(query.productSearch);
  if (productSearch) clauses.push({ sampleProducts: { $elemMatch: { $or: [{ productName: productSearch }, { sku: productSearch }] } } });
  if (clauses.length) filter.$and = clauses;
  return filter;
}

const populate = (query) => query
  .populate('customer', 'fullName customerId')
  .populate('sampleProducts.product', 'name sku stockUnit unit')
  .populate('assignedUser', 'name');

function activityData(dispatch, action, description, actor) {
  return CRMActivity.create({
    action,
    customer: dispatch.customer || undefined,
    actor,
    description,
    metadata: { dispatchId: dispatch.dispatchId },
  });
}

exports.options = asyncHandler(async (req, res) => {
  const [customers, products, units] = await Promise.all([
    Customer.find({ status: { $ne: 'archived' } }).select('fullName phone email company address').populate('company', 'name').sort({ fullName: 1 }).limit(1000).lean(),
    Product.find({ status: 'active', isArchived: { $ne: true } }).select('name sku stockUnit unit').sort({ name: 1 }).lean(),
    Unit.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
  ]);
  res.json({ success: true, customers, products, units: [...new Set([...units.map((unit) => unit.name), ...products.map((product) => product.stockUnit).filter(Boolean)])] });
});

exports.list = asyncHandler(async (req, res) => {
  const pagination = getPagination(req.query, { defaultLimit: 25 });
  const filter = buildFilter(req.query);
  const [items, total] = await Promise.all([
    populate(SampleDispatch.find(filter).sort({ dispatchDate: -1, createdAt: -1 }).skip(pagination.skip).limit(pagination.limit)).lean(),
    SampleDispatch.countDocuments(filter),
  ]);
  res.json({ success: true, ...paginated(items, total, pagination) });
});

exports.get = asyncHandler(async (req, res) => {
  const dispatch = await populate(SampleDispatch.findById(req.params.id)).lean();
  if (!dispatch) throw ApiError.notFound('Sample dispatch not found.');
  res.json({ success: true, dispatch });
});

exports.create = asyncHandler(async (req, res) => {
  const payload = await normalizePayload(req.body, req.user._id);
  if (!payload.customerName) throw ApiError.badRequest('Customer name is required.');
  const dispatch = await SampleDispatch.create({ ...payload, dispatchId: makeDispatchId() });
  await activityData(dispatch, 'SAMPLE_DISPATCH_CREATED', `Sample dispatch ${dispatch.dispatchId} was created.`, req.user._id);
  res.status(201).json({ success: true, message: 'Sample dispatch created.', dispatch });
});

exports.update = asyncHandler(async (req, res) => {
  const dispatch = await SampleDispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Sample dispatch not found.');
  const payload = await normalizePayload(req.body, null);
  if (!payload.customerName) throw ApiError.badRequest('Customer name is required.');
  Object.assign(dispatch, payload);
  if (dispatch.status === 'Delivered' && !dispatch.deliveredAt) dispatch.deliveredAt = new Date();
  if (dispatch.status !== 'Delivered') dispatch.deliveredAt = null;
  await dispatch.save();
  await activityData(dispatch, 'SAMPLE_DISPATCH_UPDATED', `Sample dispatch ${dispatch.dispatchId} was updated.`, req.user._id);
  res.json({ success: true, message: 'Sample dispatch updated.', dispatch });
});

exports.remove = asyncHandler(async (req, res) => {
  const dispatch = await SampleDispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Sample dispatch not found.');
  await dispatch.deleteOne();
  await activityData(dispatch, 'SAMPLE_DISPATCH_DELETED', `Sample dispatch ${dispatch.dispatchId} was deleted.`, req.user._id);
  res.json({ success: true, message: 'Sample dispatch deleted.' });
});

exports.markDelivered = asyncHandler(async (req, res) => {
  const dispatch = await SampleDispatch.findById(req.params.id);
  if (!dispatch) throw ApiError.notFound('Sample dispatch not found.');
  dispatch.status = 'Delivered';
  dispatch.deliveredAt = new Date();
  await dispatch.save();
  await activityData(dispatch, 'SAMPLE_DISPATCH_DELIVERED', `Sample dispatch ${dispatch.dispatchId} was marked delivered.`, req.user._id);
  res.json({ success: true, message: 'Sample dispatch marked delivered.', dispatch });
});

exports.customerHistory = asyncHandler(async (req, res) => {
  const customerId = toObjectId(req.params.id);
  if (!customerId) throw ApiError.notFound('Customer not found.');
  const customer = await Customer.findById(customerId).select('_id').lean();
  if (!customer) throw ApiError.notFound('Customer not found.');
  const items = await populate(SampleDispatch.find({ customer: customerId }).sort({ dispatchDate: -1 })).lean();
  res.json({ success: true, items });
});

const workbookColumns = [
  { header: 'Dispatch ID', width: 24, value: (row) => row.dispatchId },
  { header: 'Customer Name', width: 24, value: (row) => row.customerName },
  { header: 'Company Name', width: 22, value: (row) => row.companyName },
  { header: 'Phone Number', width: 18, value: (row) => row.phone },
  { header: 'Email', width: 26, value: (row) => row.email },
  { header: 'Complete Address', width: 34, value: (row) => row.completeAddress },
  { header: 'City', width: 16, value: (row) => row.city },
  { header: 'State', width: 18, value: (row) => row.state },
  { header: 'PIN Code', width: 12, value: (row) => row.pincode },
  { header: 'Sample Products (SKU:Quantity:Unit; ...)', width: 40, value: (row) => row.sampleProducts.map((item) => `${item.sku}:${item.quantity}:${item.unit}`).join('; ') },
  { header: 'Dispatch Date', width: 18, value: (row) => row.dispatchDate ? new Date(row.dispatchDate).toISOString().slice(0, 10) : '' },
  { header: 'Dispatch Method / Courier', width: 24, value: (row) => row.dispatchMethod },
  { header: 'Tracking Number', width: 20, value: (row) => row.trackingNumber },
  { header: 'Expected Delivery Date', width: 22, value: (row) => row.expectedDeliveryDate ? new Date(row.expectedDeliveryDate).toISOString().slice(0, 10) : '' },
  { header: 'Status', width: 16, value: (row) => row.status },
  { header: 'Remarks / Notes', width: 36, value: (row) => row.remarks },
  { header: 'Assigned User', width: 20, value: (row) => row.assignedUser?.name || '' },
];

exports.export = asyncHandler(async (req, res) => {
  const rows = await populate(SampleDispatch.find(buildFilter(req.query)).sort({ dispatchDate: -1 }).limit(env.maxExportRows)).lean();
  sendWorkbook(res, buildWorkbook([{ name: 'Sample Dispatch', columns: workbookColumns, rows }]), 'sample-dispatch');
});

exports.template = asyncHandler(async (req, res) => {
  const headers = workbookColumns.filter((column) => column.header !== 'Dispatch ID' && column.header !== 'Assigned User');
  const sample = {
    customerName: 'Example Customer', companyName: '', phone: '', email: '', completeAddress: '', city: '', state: '', pincode: '',
    sampleProducts: [{ sku: 'P001', quantity: 2, unit: 'PCS' }, { sku: 'P002', quantity: 1, unit: 'PCS' }], dispatchDate: new Date(),
    dispatchMethod: '', trackingNumber: '', expectedDeliveryDate: null, status: 'Pending', remarks: 'Sample entry',
  };
  sendWorkbook(res, buildWorkbook([{ name: 'Sample Dispatch', columns: headers, rows: [sample] }]), 'sample-dispatch-template');
});

const HEADER_MAP = {
  customername: 'customerName', customer: 'customerName', companyname: 'companyName', phonenumber: 'phone', phone: 'phone',
  email: 'email', customeremail: 'email', customerphone: 'phone', completeaddress: 'completeAddress', address: 'completeAddress', city: 'city', state: 'state', pincode: 'pincode', postalcode: 'pincode',
  sampleproductsskuquantityunit: 'sampleProducts', sampleproducts: 'sampleProducts', dispatchdate: 'dispatchDate',
  dispatchmethodcourier: 'dispatchMethod', dispatchmethod: 'dispatchMethod', courier: 'dispatchMethod', trackingnumber: 'trackingNumber',
  expecteddeliverydate: 'expectedDeliveryDate', status: 'status', remarksnotes: 'remarks', remarks: 'remarks', notes: 'remarks',
};
const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function parseProductCell(value) {
  return text(value).split(';').map((entry) => entry.trim()).filter(Boolean).map((entry) => {
    const [sku, quantity, ...unitParts] = entry.split(':');
    return { sku: text(sku).toUpperCase(), quantity: Number(quantity), unit: text(unitParts.join(':')) };
  });
}

function workbookDate(value) {
  if (value instanceof Date) return value;
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    return parsed ? new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, parsed.H, parsed.M, parsed.S)) : null;
  }
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

exports.importPreview = asyncHandler(async (req, res) => {
  let workbook;
  try { workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true }); }
  catch { throw ApiError.badRequest('Could not read the Excel file.'); }
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw ApiError.badRequest('The Excel file has no worksheet.');
  const matrix = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '', blankrows: false });
  if (!matrix.length) throw ApiError.badRequest('The worksheet is empty.');
  const headers = matrix[0].map((header) => HEADER_MAP[normalizeHeader(header)] || null);
  const rows = matrix.slice(1).map((cells, index) => {
    const input = { row: index + 2 };
    headers.forEach((field, column) => { if (field) input[field] = cells[column]; });
    return input;
  }).filter((row) => Object.keys(row).some((key) => key !== 'row' && row[key] !== ''));
  if (!rows.length) throw ApiError.badRequest('No data rows found below the header row.');
  if (rows.length > env.maxImportRows) throw ApiError.badRequest(`Too many rows. Maximum ${env.maxImportRows} rows per import.`);

  const skus = [...new Set(rows.flatMap((row) => parseProductCell(row.sampleProducts).map((item) => item.sku)).filter(Boolean))];
  const [products, customers] = await Promise.all([
    Product.find({ sku: { $in: skus }, status: 'active', isArchived: { $ne: true } }).select('name sku stockUnit').lean(),
    Customer.find({ status: { $ne: 'archived' }, $or: [{ email: { $in: rows.map((row) => text(row.email).toLowerCase()).filter(Boolean) } }, { phone: { $in: rows.map((row) => text(row.phone)).filter(Boolean) } }] }).select('fullName email phone company address').populate('company', 'name').lean(),
  ]);
  const productBySku = new Map(products.map((product) => [product.sku.toUpperCase(), product]));
  const customerByContact = new Map();
  customers.forEach((customer) => { if (customer.email) customerByContact.set(customer.email.toLowerCase(), customer); if (customer.phone) customerByContact.set(customer.phone, customer); });
  const previewRows = rows.map((row) => {
    const errors = [];
    const requestedProducts = parseProductCell(row.sampleProducts);
    const customer = customerByContact.get(text(row.email).toLowerCase()) || customerByContact.get(text(row.phone));
    const customerName = text(row.customerName) || customer?.fullName || '';
    const dispatchDate = workbookDate(row.dispatchDate);
    const status = text(row.status) || 'Pending';
    if (!customerName) errors.push('Customer Name is required or provide a matching existing customer email/phone.');
    if (!dispatchDate) errors.push('A valid Dispatch Date is required.');
    if (!STATUSES.includes(status)) errors.push('Status must be Pending, Dispatched, Delivered or Cancelled.');
    if (!requestedProducts.length) errors.push('At least one Sample Product is required.');
    const sampleProducts = requestedProducts.map((item) => {
      const product = productBySku.get(item.sku);
      if (!product) errors.push(`Product SKU ${item.sku || '(blank)'} was not found or is inactive.`);
      if (!Number.isFinite(item.quantity) || item.quantity <= 0) errors.push(`Quantity for ${item.sku || 'sample product'} must be greater than zero.`);
      return product ? { product: product._id, quantity: item.quantity, unit: item.unit || product.stockUnit } : null;
    }).filter(Boolean);
    const payload = {
      customer: customer?._id || null,
      customerName,
      companyName: text(row.companyName) || (customer?.company && typeof customer.company === 'object' ? customer.company.name : ''),
      phone: text(row.phone) || customer?.phone || '', email: text(row.email) || customer?.email || '',
      completeAddress: text(row.completeAddress) || addressText(customer?.address),
      city: text(row.city) || customer?.address?.city || '', state: text(row.state) || customer?.address?.state || '', pincode: text(row.pincode) || customer?.address?.pincode || '',
      sampleProducts, dispatchDate, dispatchMethod: text(row.dispatchMethod), trackingNumber: text(row.trackingNumber),
      expectedDeliveryDate: workbookDate(row.expectedDeliveryDate), status, remarks: text(row.remarks),
    };
    return { row: row.row, status: errors.length ? 'error' : 'valid', errors, input: row, data: payload };
  });
  res.json({ success: true, fileName: req.file.originalname, sheetName, rows: previewRows, summary: { totalRows: previewRows.length, validRows: previewRows.filter((row) => row.status === 'valid').length, errorRows: previewRows.filter((row) => row.status === 'error').length } });
});

exports.importCommit = asyncHandler(async (req, res) => {
  if (!Array.isArray(req.body?.rows)) throw ApiError.badRequest('rows must be an array.');
  if (req.body.rows.length > env.maxImportRows) throw ApiError.badRequest(`Too many rows. Maximum ${env.maxImportRows} rows per import.`);
  const created = [];
  for (const row of req.body.rows) {
    const payload = await normalizePayload(row, req.user._id);
    if (!payload.customerName) throw ApiError.badRequest('Customer name is required.');
    const dispatch = await SampleDispatch.create({ ...payload, dispatchId: makeDispatchId() });
    await activityData(dispatch, 'SAMPLE_DISPATCH_CREATED', `Sample dispatch ${dispatch.dispatchId} was imported.`, req.user._id);
    created.push(dispatch);
  }
  res.status(201).json({ success: true, message: `Imported ${created.length} sample dispatch(es).`, imported: created.length, items: created });
});
