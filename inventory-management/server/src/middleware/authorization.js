const ApiError = require('../utils/ApiError');
const { attachAccess, can } = require('../services/access.service');

const requirePermission = (...permissions) => async (req, res, next) => {
  try {
    if (!req.user) throw ApiError.unauthorized();
    await attachAccess(req.user);
    if (permissions.length && !permissions.some((permission) => can(req.user, permission))) {
      throw ApiError.forbidden('You do not have permission to perform this action.');
    }
    next();
  } catch (error) {
    next(error);
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user?.role !== 'admin') return next(ApiError.forbidden('Admin access is required.'));
  next();
};

module.exports = { requirePermission, requireAdmin };
