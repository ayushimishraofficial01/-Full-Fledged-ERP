const env = require('../config/env');
const ApiError = require('../utils/ApiError');

const DUPLICATE_MESSAGES = {
  sku: 'SKU already exists. Please use a unique SKU.',
  code: 'Warehouse code already exists. Please use a unique code.',
  email: 'An account with this email already exists.',
  key: 'This value already exists.',
  'product_1_warehouse_1': 'Inventory record already exists.',
};

function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.statusCode || 500;
  let message = err.message;
  let details = err.details;

  if (err.name === 'ZodError') {
    status = 400;
    message = 'Please correct the highlighted fields.';
    details = err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
  } else if (err.name === 'ValidationError' && err.errors) {
    status = 400;
    details = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message }));
    message = details[0]?.message || 'Validation failed';
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}`;
  } else if (err.code === 11000) {
    status = 409;
    let field = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (!field) {
      // Some MongoDB-compatible servers omit keyPattern; fall back to the index name in the message.
      const m = /index:?\s*'?([A-Za-z0-9]+)_-?1/i.exec(String(err.message));
      if (m) field = m[1];
    }
    message = DUPLICATE_MESSAGES[field] || 'Duplicate value. This record already exists.';
    details = field ? [{ field, message }] : undefined;
  } else if (err.name === 'MulterError') {
    status = 400;
    message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File is too large.'
        : err.code === 'LIMIT_UNEXPECTED_FILE'
          ? 'Unexpected file field.'
          : 'File upload failed.';
  } else if (err.type === 'entity.too.large') {
    status = 413;
    message = 'Request is too large.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON body.';
  }

  if (status >= 500) {
    // Log full detail server-side only; never leak internals to the client.
    console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
    if (!err.isOperational) message = 'Something went wrong on our side. Please try again.';
  }

  const body = { success: false, message };
  if (details) body.errors = details;
  if (!env.isProd && status >= 500 && !err.isOperational) body.debug = err.message;
  res.status(status).json(body);
}

module.exports = { notFound, errorHandler };
