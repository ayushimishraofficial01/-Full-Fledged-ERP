const mongoose = require('mongoose');

/** Escape user input before using it inside a RegExp (prevents ReDoS / regex injection). */
function escapeRegex(value = '') {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function searchRegex(value) {
  const trimmed = String(value || '').trim().slice(0, 100);
  return trimmed ? new RegExp(escapeRegex(trimmed), 'i') : null;
}

function getPagination(query, { defaultLimit = 20, maxLimit = 100 } = {}) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

function paginated(items, total, { page, limit }) {
  return { items, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } };
}

function getSort(query, allowed, fallback) {
  const field = allowed[query.sort] ? query.sort : fallback.field;
  const order = query.order === 'asc' ? 1 : query.order === 'desc' ? -1 : fallback.order;
  return { [allowed[field]]: order, _id: order };
}

function toObjectId(id) {
  return mongoose.isValidObjectId(id) ? new mongoose.Types.ObjectId(String(id)) : null;
}

/** Parse "from"/"to" query params into a Mongo date range. "to" is inclusive to the end of that day when date-only. */
function dateRange(from, to) {
  const range = {};
  if (from) {
    const d = new Date(from);
    if (!Number.isNaN(d.getTime())) range.$gte = d;
  }
  if (to) {
    const d = new Date(to);
    if (!Number.isNaN(d.getTime())) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(String(to))) d.setUTCHours(23, 59, 59, 999);
      range.$lte = d;
    }
  }
  return Object.keys(range).length ? range : null;
}

module.exports = { escapeRegex, searchRegex, getPagination, paginated, getSort, toObjectId, dateRange };
