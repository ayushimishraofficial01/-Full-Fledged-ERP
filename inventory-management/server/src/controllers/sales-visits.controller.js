const path = require('path');
const asyncHandler = require('../utils/asyncHandler');
const ApiError = require('../utils/ApiError');
const { Product, SalesOrder, SalesShift, SalesStaff, SalesVisit, Unit } = require('../models');
const { createVisitOrder } = require('./orders.controller');
const { can } = require('../services/access.service');
const { ensureSalesStaff, getOfficeSchedule } = require('../services/sales-staff.service');
const { isWithinOfficeHours } = require('../services/office-hours.service');
const { salesVisitEvidencePath, removeSalesVisitEvidence } = require('../middleware/upload');
const { listProducts } = require('../services/product.service');
const { resolveUnit } = require('../services/unit.service');

const GEOFENCE_RADIUS_METERS = 150;
const MAX_VISIT_ACCURACY_METERS = 100;
const MAX_TRACK_POINTS = 2880;
const MIN_LOCATION_INTERVAL_MS = 15000;

function radians(value) {
  return (value * Math.PI) / 180;
}

function distanceMeters(a, b) {
  const earthRadius = 6371000;
  const dLat = radians(b.latitude - a.latitude);
  const dLon = radians(b.longitude - a.longitude);
  const startLat = radians(a.latitude);
  const endLat = radians(b.latitude);
  const arc = Math.sin(dLat / 2) ** 2 + Math.cos(startLat) * Math.cos(endLat) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function locationSnapshot(location) {
  return {
    latitude: location.latitude,
    longitude: location.longitude,
    accuracy: location.accuracy,
    recordedAt: new Date(),
  };
}

function assertVisitLocation(location, geofence) {
  if (location.accuracy > MAX_VISIT_ACCURACY_METERS) {
    throw ApiError.unprocessable(`GPS accuracy must be ${MAX_VISIT_ACCURACY_METERS} metres or better. Please wait for a more accurate location.`);
  }
  const distance = distanceMeters(location, geofence);
  if (distance > GEOFENCE_RADIUS_METERS) {
    throw ApiError.forbidden(`You are outside this visit's ${GEOFENCE_RADIUS_METERS} metre geofence (${Math.round(distance)} metres away).`);
  }
  return Math.round(distance);
}

async function activeShiftFor(userId, salesStaffId) {
  const shift = await SalesShift.findOne({ user: userId, salesStaff: salesStaffId, isActive: true });
  if (!shift) throw ApiError.conflict('Start working hours before recording a visit.');
  return shift;
}

const current = asyncHandler(async (req, res) => {
  const staff = await ensureSalesStaff(req.user._id);
  const [shift, officeSchedule] = await Promise.all([
    SalesShift.findOne({ user: req.user._id, salesStaff: staff._id, isActive: true }).select('-track').lean(),
    getOfficeSchedule(req.user._id),
  ]);
  const visits = shift ? await SalesVisit.find({ shift: shift._id }).sort({ 'checkIn.at': -1 }).limit(50).lean() : [];
  res.json({ shift, visits, officeSchedule, geofenceRadiusMeters: GEOFENCE_RADIUS_METERS, locationIntervalSeconds: 30 });
});

const startShift = asyncHandler(async (req, res) => {
  const now = new Date();
  const staff = await ensureSalesStaff(req.user._id);
  const officeSchedule = await getOfficeSchedule(req.user._id);
  if (!isWithinOfficeHours(officeSchedule, now)) {
    throw ApiError.forbidden('Working hours can only start during this user’s configured office hours.');
  }
  const firstLocation = locationSnapshot(req.body.location);
  const shift = await SalesShift.create({
    salesStaff: staff._id,
    user: req.user._id,
    startedAt: now,
    consentAt: now,
    latestLocation: firstLocation,
    track: [firstLocation],
  });
  res.status(201).json({ shift });
});

const recordLocation = asyncHandler(async (req, res) => {
  const staff = await ensureSalesStaff(req.user._id);
  const shift = await activeShiftFor(req.user._id, staff._id);
  const now = new Date();
  const officeSchedule = await getOfficeSchedule(req.user._id);
  if (!isWithinOfficeHours(officeSchedule, now)) {
    const ended = await SalesShift.findOneAndUpdate(
      { _id: shift._id, user: req.user._id, salesStaff: staff._id, isActive: true, visitActive: false },
      { $set: { isActive: false, endedAt: now } },
      { new: true }
    );
    if (ended) return res.json({ recorded: false, shiftEnded: true, reason: 'outside-office-hours' });
    throw ApiError.conflict('Working hours are over. Check out of your active visit before ending working hours.');
  }
  const lastPoint = shift.track[shift.track.length - 1];
  if (lastPoint && now.getTime() - new Date(lastPoint.recordedAt).getTime() < MIN_LOCATION_INTERVAL_MS) {
    return res.json({ recorded: false, nextAllowedAt: new Date(new Date(lastPoint.recordedAt).getTime() + MIN_LOCATION_INTERVAL_MS) });
  }
  const point = locationSnapshot(req.body.location);
  shift.latestLocation = point;
  shift.track.push(point);
  if (shift.track.length > MAX_TRACK_POINTS) shift.track.splice(0, shift.track.length - MAX_TRACK_POINTS);
  await shift.save();
  res.json({ recorded: true, latestLocation: point });
});

const endShift = asyncHandler(async (req, res) => {
  const staff = await ensureSalesStaff(req.user._id);
  const shift = await activeShiftFor(req.user._id, staff._id);
  if (shift.visitActive) throw ApiError.conflict('Check out of your active visit before ending working hours.');
  const now = new Date();
  const point = locationSnapshot(req.body.location);
  const ended = await SalesShift.findOneAndUpdate(
    { _id: shift._id, user: req.user._id, salesStaff: staff._id, isActive: true, visitActive: false },
    { $set: { endedAt: now, isActive: false, latestLocation: point }, $push: { track: { $each: [point], $slice: -MAX_TRACK_POINTS } } },
    { new: true }
  );
  if (!ended) throw ApiError.conflict('This shift has already ended or still has an active visit.');
  res.json({ shift: ended });
});

const checkIn = asyncHandler(async (req, res) => {
  const staff = await ensureSalesStaff(req.user._id);
  const shift = await activeShiftFor(req.user._id, staff._id);
  const geofence = { ...req.body.geofence, radiusMeters: GEOFENCE_RADIUS_METERS };
  const distance = assertVisitLocation(req.body.location, geofence);
  const point = locationSnapshot(req.body.location);
  const lockedShift = await SalesShift.findOneAndUpdate(
    { _id: shift._id, user: req.user._id, salesStaff: staff._id, isActive: true, visitActive: false },
    {
      $set: { visitActive: true, latestLocation: point },
      $push: { track: { $each: [point], $slice: -MAX_TRACK_POINTS } },
    },
    { new: true }
  );
  if (!lockedShift) throw ApiError.conflict('A visit is already active, or your working hours have ended.');

  let visit;
  try {
    const products = req.body.requirements.length
      ? await Product.find({
        _id: { $in: req.body.requirements.map((item) => item.productId) },
        status: 'active',
        isArchived: { $ne: true },
      }).select('name sku stockUnit price').lean()
      : [];
    if (products.length !== req.body.requirements.length) {
      throw ApiError.badRequest('One or more selected products are no longer active. Refresh the product list and try again.');
    }
    const productsById = new Map(products.map((product) => [String(product._id), product]));
    const requirements = await Promise.all(req.body.requirements.map(async (item) => {
      const product = productsById.get(item.productId);
      const unit = item.unit ? await resolveUnit(item.unit) : product.stockUnit;
      if (!unit) {
        throw ApiError.badRequest('One or more selected requirement units are no longer active. Refresh the unit list and try again.');
      }
      return {
        product: product._id,
        productName: product.name,
        sku: product.sku,
        quantity: item.quantity,
        unit,
        unitPrice: item.unitPrice ?? product.price ?? null,
        note: item.note,
      };
    }));
    const now = new Date();
    visit = await SalesVisit.create({
      shift: lockedShift._id,
      salesStaff: lockedShift.salesStaff,
      user: req.user._id,
      placeName: req.body.placeName,
      notes: req.body.notes || '',
      requirements,
      geofence,
      checkIn: { location: point, at: now },
    });
    const order = await createVisitOrder({ visit, userId: req.user._id });
    res.status(201).json({ visit, order, distanceFromLocationMeters: distance });
  } catch (error) {
    if (visit) {
      await SalesOrder.deleteOne({ salesVisit: visit._id });
      await SalesVisit.deleteOne({ _id: visit._id });
    }
    await SalesShift.updateOne(
      { _id: lockedShift._id, user: req.user._id, salesStaff: staff._id },
      { $set: { visitActive: false } },
    );
    throw error;
  }
});

const checkOut = asyncHandler(async (req, res) => {
  const staff = await ensureSalesStaff(req.user._id);
  const { id } = req.params;
  if (!/^[a-f\d]{24}$/i.test(id)) throw ApiError.notFound('Visit not found.');
  const visit = await SalesVisit.findOne({ _id: id, user: req.user._id, salesStaff: staff._id, 'checkOut.at': null });
  if (!visit) throw ApiError.notFound('Active visit not found.');

  let distance;
  let checkedOutAt;
  let point;
  let updated;
  const officeSchedule = await getOfficeSchedule(req.user._id);
  try {
    distance = assertVisitLocation(req.body.location, visit.geofence);
    checkedOutAt = new Date();
    point = locationSnapshot(req.body.location);
    updated = await SalesVisit.findOneAndUpdate(
      { _id: visit._id, user: req.user._id, salesStaff: staff._id, 'checkOut.at': null },
      {
        $set: {
          checkOut: { location: point, at: checkedOutAt },
          durationSeconds: Math.max(0, Math.round((checkedOutAt - visit.checkIn.at) / 1000)),
          evidenceFilename: req.file.filename,
        },
      },
      { new: true }
    );
    if (!updated) throw ApiError.conflict('This visit has already been checked out.');
  } catch (error) {
    removeSalesVisitEvidence(req.file.filename);
    throw error;
  }
  await SalesShift.updateOne(
    { _id: visit.shift, user: req.user._id, salesStaff: staff._id, visitActive: true },
    {
      $set: {
        visitActive: false,
        latestLocation: point,
        ...(!isWithinOfficeHours(officeSchedule, new Date()) ? { isActive: false, endedAt: new Date() } : {}),
      },
      $push: { track: { $each: [point], $slice: -MAX_TRACK_POINTS } },
    }
  );
  res.json({ visit: updated, distanceFromLocationMeters: distance });
});

const history = asyncHandler(async (req, res) => {
  const staff = await ensureSalesStaff(req.user._id);
  const [shifts, visits] = await Promise.all([
    SalesShift.find({ salesStaff: staff._id }).select('salesStaff user startedAt endedAt isActive').sort({ startedAt: -1 }).limit(30).lean(),
    SalesVisit.find({ salesStaff: staff._id }).sort({ 'checkIn.at': -1 }).limit(100).lean(),
  ]);
  res.json({ shifts, visits });
});

const productCatalog = asyncHandler(async (req, res) => {
  const [result, units] = await Promise.all([
    listProducts({
      search: req.query.search,
      status: 'active',
      archived: 'false',
      sort: 'name',
      order: 'asc',
      page: req.query.page,
      limit: req.query.limit || 30,
    }),
    Unit.find({ isActive: true }).select('name label category').sort({ category: 1, name: 1 }).lean(),
  ]);
  res.json({
    products: result.items.map((product) => ({
      id: product._id,
      name: product.name,
      sku: product.sku,
      unit: product.stockUnit,
      price: product.price,
    })),
    units: units.map(({ name, label, category }) => ({ name, label, category })),
    pagination: result.pagination,
  });
});

const team = asyncHandler(async (req, res) => {
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 25));
  const userId = req.query.userId && /^[a-f\d]{24}$/i.test(req.query.userId) ? req.query.userId : null;
  if (req.query.userId && !userId) throw ApiError.badRequest('Please select a valid user.');
  const staffRecords = await SalesStaff.find()
    .select('user officeSchedule')
    .populate({ path: 'user', select: 'name email role status' })
    .lean();
  const salesStaff = staffRecords.filter((staff) => staff.user);
  const users = salesStaff.map((staff) => ({
    ...staff.user,
    officeSchedule: staff.officeSchedule,
    salesStaffId: staff._id,
  })).sort((left, right) => left.name.localeCompare(right.name));
  const selectedStaffIds = salesStaff
    .filter((staff) => !userId || String(staff.user._id) === userId)
    .map((staff) => staff._id);
  const [total, shifts] = await Promise.all([
    SalesShift.countDocuments({ salesStaff: { $in: selectedStaffIds } }),
    SalesShift.find({ salesStaff: { $in: selectedStaffIds } })
    .select('salesStaff user startedAt endedAt isActive latestLocation track')
    .slice('track', -20).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit)
    .populate('user', 'name email role')
    .populate('salesStaff', 'officeSchedule').lean(),
  ]);
  const visits = await SalesVisit.find({ shift: { $in: shifts.map((shift) => shift._id) } })
    .sort({ 'checkIn.at': -1 }).lean();
  const visitsByShift = new Map();
  for (const visit of visits) {
    const key = String(visit.shift);
    if (!visitsByShift.has(key)) visitsByShift.set(key, []);
    visitsByShift.get(key).push(visit);
  }
  res.json({
    users,
    shifts: shifts.map((shift) => ({
      ...shift,
      user: shift.user ? { ...shift.user, officeSchedule: shift.salesStaff?.officeSchedule || null } : shift.user,
      visits: visitsByShift.get(String(shift._id)) || [],
    })),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  });
});

const photo = asyncHandler(async (req, res, next) => {
  if (!/^[a-f\d]{24}$/i.test(req.params.id)) throw ApiError.notFound('Visit photo not found.');
  const visit = await SalesVisit.findById(req.params.id).select('user evidenceFilename').lean();
  if (!visit || !visit.evidenceFilename) throw ApiError.notFound('Visit photo not found.');
  if (String(visit.user) !== String(req.user._id) && !can(req.user, 'sales_visits.view')) throw ApiError.notFound('Visit photo not found.');
  const filename = path.basename(visit.evidenceFilename);
  const filePath = salesVisitEvidencePath(filename);
  if (!filePath) throw ApiError.notFound('Visit photo not found.');
  res.set('Cache-Control', 'private, no-store');
  res.type(path.extname(filename));
  res.sendFile(filePath, (error) => {
    if (error && !res.headersSent) next(error);
  });
});

module.exports = { current, startShift, recordLocation, endShift, checkIn, checkOut, history, productCatalog, team, photo };
