const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { attachAccess } = require('../services/access.service');

function signToken(user) {
  return jwt.sign({ sub: String(user._id), v: user.tokenVersion || 0 }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: 'HS256',
  });
}

function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/',
  };
}

function setAuthCookie(res, token) {
  const decoded = jwt.decode(token);
  res.cookie(env.cookieName, token, { ...cookieOptions(), expires: new Date(decoded.exp * 1000) });
}

function clearAuthCookie(res) {
  res.clearCookie(env.cookieName, cookieOptions());
}

function extractToken(req) {
  if (req.cookies && req.cookies[env.cookieName]) return req.cookies[env.cookieName];
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** Requires a valid JWT (httpOnly cookie or Bearer header) belonging to an active user. */
const protect = asyncHandler(async (req, res, next) => {
  const token = extractToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch (err) {
    throw ApiError.unauthorized(err.name === 'TokenExpiredError' ? 'Your session has expired. Please log in again.' : 'Invalid session. Please log in again.');
  }

  const user = await User.findById(payload.sub).select('+tokenVersion');
  if (!user || user.status !== 'active' || (user.tokenVersion || 0) !== payload.v) {
    throw ApiError.unauthorized('Your session is no longer valid. Please log in again.');
  }

  await attachAccess(user);
  req.user = user;
  next();
});

/** Role gate for future permission rules, e.g. router.delete('/', authorize('admin'), ...). */
const authorize = (...roles) => (req, res, next) => {
  if (!req.user || (roles.length && !roles.includes(req.user.role))) return next(ApiError.forbidden());
  next();
};

module.exports = { protect, authorize, signToken, setAuthCookie, clearAuthCookie };
