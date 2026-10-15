const crypto = require('crypto');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Customer, Product, SalesOrder, SalesVisit, Unit } = require('../models');
const { can } = require('../services/access.service');
const { resolveUnit } = require('../services/unit.service');
const { getPagination, paginated, searchRegex } = require('../utils/query');

const STATUSES = ['Pending', 'Confirmed', 'Processing', 'Completed', 'Cancelled'];
const makeOrderNumber = () => `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
let visitOrderBackfill;

function visibleOrdersFor(user) {
  return can(user, 'sales_visits.view') ? {} : { createdBy: user._id };
}

function buildFilter(query, user) {
  const filter = visibleOrdersFor(user);
  if (STATUSES.includes(query.status)) filter.status = query.status;
  const search = searchRegex(query.search);
  if (search) {
    filter.$or = [
      { orderNumber: search },
      { customerName: search },
      { phone: search },
      { email: search },
      { gstNumber: search },
      { address: search },
      { 'items.productName': search },
      { 'items.sku': search },
    ];
  }
  return filter;
}

async function backfillVisitOrders() {
  if (!visitOrderBackfill) {
    visitOrderBackfill = (async () => {
      const visits = await SalesVisit.find({ 'requirements.0': { $exists: true } }).lean();
      if (!visits.length) return;
      const existing = await SalesOrder.find({ salesVisit: { $in: visits.map((visit) => visit._id) } })
        .select('salesVisit')
        .lean();
      const linkedVisits = new Set(existing.map((order) => String(order.salesVisit)));
      for (const visit of visits) {
        if (!linkedVisits.has(String(visit._id))) {
          try {
            await createVisitOrder({ visit, userId: visit.user });
          } catch (error) {
            const createdByAnotherRequest = await SalesOrder.exists({ salesVisit: visit._id });
            if (!createdByAnotherRequest) throw error;
          }
        }
      }
    })().catch((error) => {
      visitOrderBackfill = null;
      throw error;
    });
  }
  await visitOrderBackfill;
}

const list = asyncHandler(async (req, res) => {
  await backfillVisitOrders();
  const pagination = getPagination(req.query, { defaultLimit: 25 });
  const filter = buildFilter(req.query, req.user);
  const [items, total] = await Promise.all([
    SalesOrder.find(filter)
      .populate('createdBy', 'name')
      .populate('salesVisit', 'placeName')
      .sort({ orderDate: -1, createdAt: -1 })
      .skip(pagination.skip)
      .limit(pagination.limit)
      .lean(),
    SalesOrder.countDocuments(filter),
  ]);
  res.json({ ...paginated(items, total, pagination), statuses: STATUSES });
});

const options = asyncHandler(async (req, res) => {
  const [products, units] = await Promise.all([
    Product.find({ status: 'active', isArchived: { $ne: true } })
      .select('name sku stockUnit price')
      .sort({ name: 1 })
      .limit(1000)
      .lean(),
    Unit.find({ isActive: true }).select('name').sort({ name: 1 }).lean(),
  ]);
  res.json({
    products: products.map(({ _id, name, sku, stockUnit, price }) => ({ id: _id, name, sku, unit: stockUnit, price })),
    units: [...new Set([...units.map((unit) => unit.name), ...products.map((product) => product.stockUnit).filter(Boolean)])],
  });
});

async function normalizeItems(items) {
  const productIds = items.map((item) => item.productId);
  const products = await Product.find({
    _id: { $in: productIds },
    status: 'active',
    isArchived: { $ne: true },
  }).select('name sku stockUnit price').lean();
  if (products.length !== productIds.length) {
    throw ApiError.badRequest('One or more selected products are no longer active. Refresh the product list and try again.');
  }
  const productsById = new Map(products.map((product) => [String(product._id), product]));
  return Promise.all(items.map(async (item) => {
    const product = productsById.get(item.productId);
    const unit = item.unit ? await resolveUnit(item.unit) : product.stockUnit;
    if (!unit) throw ApiError.badRequest('One or more selected order units are no longer active. Refresh the unit list and try again.');
    const unitPrice = item.unitPrice ?? product.price ?? 0;
    const lineTotal = Math.round((item.quantity * unitPrice + Number.EPSILON) * 100) / 100;
    return {
      product: product._id,
      productName: product.name,
      sku: product.sku,
      quantity: item.quantity,
      unit,
      unitPrice,
      lineTotal,
      note: item.note || '',
    };
  }));
}

const create = asyncHandler(async (req, res) => {
  const items = await normalizeItems(req.body.items);
  if (req.body.customerId && !await Customer.exists({ _id: req.body.customerId, status: { $ne: 'archived' } })) {
    throw ApiError.badRequest('The selected customer is no longer available. Search for the customer again.');
  }
  const order = await SalesOrder.create({
    orderNumber: makeOrderNumber(),
    ...(req.body.customerId ? { customer: req.body.customerId } : {}),
    customerName: req.body.customerName,
    phone: req.body.phone || '',
    email: req.body.email || '',
    gstNumber: req.body.gstNumber || '',
    address: req.body.address || '',
    items,
    totalAmount: Math.round((items.reduce((total, item) => total + item.lineTotal, 0) + Number.EPSILON) * 100) / 100,
    notes: req.body.notes || '',
    source: 'Manual',
    createdBy: req.user._id,
  });
  res.status(201).json({ message: 'Order created.', order });
});

const updateStatus = asyncHandler(async (req, res) => {
  const order = await SalesOrder.findOneAndUpdate(
    { _id: req.params.id, ...visibleOrdersFor(req.user) },
    { $set: { status: req.body.status } },
    { new: true, runValidators: true }
  );
  if (!order) throw ApiError.notFound('Order not found.');
  res.json({ message: 'Order status updated.', order });
});

async function createVisitOrder({ visit, userId }) {
  if (!visit.requirements.length) return null;
  return SalesOrder.create({
    orderNumber: makeOrderNumber(),
    customerName: visit.placeName,
    items: visit.requirements.map((item) => ({
      product: item.product,
      productName: item.productName,
      sku: item.sku,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice ?? 0,
      lineTotal: Math.round((item.quantity * (item.unitPrice ?? 0) + Number.EPSILON) * 100) / 100,
      note: item.note,
    })),
    totalAmount: Math.round((visit.requirements.reduce((total, item) => total + Math.round((item.quantity * (item.unitPrice ?? 0) + Number.EPSILON) * 100) / 100, 0) + Number.EPSILON) * 100) / 100,
    notes: visit.notes,
    source: 'Sales Visit',
    salesVisit: visit._id,
    createdBy: userId,
    orderDate: visit.checkIn.at,
  });
}

module.exports = { list, options, create, updateStatus, createVisitOrder };
