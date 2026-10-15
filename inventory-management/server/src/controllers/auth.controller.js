const crypto = require('crypto');
const env = require('../config/env');
const { User } = require('../models');
const ApiError = require('../utils/ApiError');
const asyncHandler = require('../utils/asyncHandler');
const { signToken, setAuthCookie, clearAuthCookie } = require('../middleware/auth');
const { sendPasswordResetEmail } = require('../services/email.service');
const { attachAccess } = require('../services/access.service');
const { normalizePhone } = require('../validators/auth.validators');

const RESET_TTL_MS = 30 * 60 * 1000;
const hashToken = (t) => crypto.createHash('sha256').update(t).digest('hex');

function issueSession(res, user) {
  const token = signToken(user);
  setAuthCookie(res, token);
}

async function safeUser(user) {
  await attachAccess(user);
  return user.toSafeJSON();
}

exports.register = asyncHandler(async (req, res) => {
  if (!env.allowRegistration && (await User.estimatedDocumentCount()) > 0) {
    throw ApiError.forbidden('New registrations are disabled. Ask an administrator for an account.');
  }
  const { name, email, password, phone } = req.body;
  if (phone && (await User.exists({ phone }))) throw ApiError.conflict('An account with this mobile number already exists.', [{ field: 'phone', message: 'Mobile number is already registered' }]);
  if (await User.exists({ email })) throw ApiError.conflict('An account with this email already exists.', [{ field: 'email', message: 'Email is already registered' }]);

  const user = await User.create({ name, email, password, ...(phone ? { phone } : {}) });
  user.lastLoginAt = new Date();
  await user.save();
  issueSession(res, user);
  res.status(201).json({ success: true, message: 'Account created successfully', user: await safeUser(user) });
});

exports.login = asyncHandler(async (req, res) => {
  const { password } = req.body;
  const identifier = String(req.body.identifier || req.body.email || '').trim();
  // An "@" means email; anything else is treated as a mobile number.
  const query = identifier.includes('@') ? { email: identifier.toLowerCase() } : { phone: normalizePhone(identifier) };
  const user = await User.findOne(query).select('+password +tokenVersion');
  // Same message for unknown account and wrong password (prevents account enumeration).
  if (!user || !(await user.comparePassword(password))) throw ApiError.unauthorized('Invalid email/phone or password');
  if (user.status !== 'active') throw ApiError.forbidden('Your account is inactive. Contact an administrator.');

  user.lastLoginAt = new Date();
  await user.save();
  issueSession(res, user);
  res.json({ success: true, message: 'Logged in successfully', user: await safeUser(user) });
});

/**
 * Google Sign-In. The browser sends the ID token ("credential") issued by Google; we verify it with Google,
 * check it was issued for OUR client ID, and then sign in the account that owns that verified email.
 * New accounts follow the same ALLOW_REGISTRATION rule as normal registration.
 */
exports.googleLogin = asyncHandler(async (req, res) => {
  if (!env.googleClientId) throw ApiError.badRequest('Google sign-in is not configured on this server.');
  let info;
  try {
    const r = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(req.body.credential)}`);
    info = await r.json();
    if (!r.ok) info = null;
  } catch {
    throw ApiError.badRequest('Could not reach Google to verify your sign-in. Please try again.');
  }
  const valid = info && info.aud === env.googleClientId && String(info.email_verified) === 'true' && info.email && Number(info.exp) * 1000 > Date.now();
  if (!valid) throw ApiError.unauthorized('Google sign-in could not be verified.');

  const email = String(info.email).toLowerCase();
  let user = await User.findOne({ email }).select('+tokenVersion');
  if (!user) {
    if (!env.allowRegistration && (await User.estimatedDocumentCount()) > 0) {
      throw ApiError.forbidden('No account exists for this Google email. Ask an administrator for an account.');
    }
    // Random password: this account signs in with Google (or can use "Forgot password" to set one).
    user = await User.create({ name: String(info.name || email.split('@')[0]).slice(0, 100), email, password: `${crypto.randomBytes(24).toString('hex')}aA1` });
  }
  if (user.status !== 'active') throw ApiError.forbidden('Your account is inactive. Contact an administrator.');
  user.lastLoginAt = new Date();
  await user.save();
  issueSession(res, user);
  res.json({ success: true, message: 'Logged in successfully', user: await safeUser(user) });
});

exports.logout = asyncHandler(async (req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
});

/** Invalidates every session of this user on every device. */
exports.logoutAll = asyncHandler(async (req, res) => {
  await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out from all devices' });
});

exports.me = asyncHandler(async (req, res) => {
  res.json({ success: true, user: await safeUser(req.user), registrationOpen: env.allowRegistration });
});

exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email, status: 'active' });
  const response = { success: true, message: 'If an account exists for this email, a password reset link has been sent.' };

  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = hashToken(token);
    user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS);
    await user.save({ validateBeforeSave: false });
    const resetUrl = `${env.clientUrl[0]}/reset-password/${token}`;
    const { delivered } = await sendPasswordResetEmail(user, resetUrl);
    // Development convenience only: expose the link when no mail server is configured.
    if (!delivered && !env.isProd) response.devResetUrl = resetUrl;
  }
  res.json(response);
});

exports.resetPassword = asyncHandler(async (req, res) => {
  const token = String(req.params.token || '');
  if (!/^[a-f0-9]{64}$/.test(token)) throw ApiError.badRequest('This reset link is invalid or has expired.');
  const user = await User.findOne({ passwordResetToken: hashToken(token), passwordResetExpires: { $gt: new Date() } }).select('+tokenVersion');
  if (!user) throw ApiError.badRequest('This reset link is invalid or has expired.');

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  user.tokenVersion = (user.tokenVersion || 0) + 1; // sign out old sessions
  await user.save();
  clearAuthCookie(res);
  res.json({ success: true, message: 'Password updated. Please log in with your new password.' });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { name, email, phone } = req.body;
  if (phone && phone !== req.user.phone && (await User.exists({ phone, _id: { $ne: req.user._id } }))) {
    throw ApiError.conflict('An account with this mobile number already exists.', [{ field: 'phone', message: 'Mobile number is already registered' }]);
  }
  if (email !== req.user.email && (await User.exists({ email, _id: { $ne: req.user._id } }))) {
    throw ApiError.conflict('An account with this email already exists.', [{ field: 'email', message: 'Email is already registered' }]);
  }
  req.user.name = name;
  req.user.email = email;
  req.user.phone = phone || undefined;
  await req.user.save();
  res.json({ success: true, message: 'Profile updated', user: req.user.toSafeJSON() });
});

exports.changePassword = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password +tokenVersion');
  if (!(await user.comparePassword(req.body.currentPassword))) {
    throw ApiError.badRequest('Current password is incorrect', [{ field: 'currentPassword', message: 'Current password is incorrect' }]);
  }
  user.password = req.body.newPassword;
  user.tokenVersion = (user.tokenVersion || 0) + 1;
  await user.save();
  issueSession(res, user); // keep this device signed in, others are signed out
  res.json({ success: true, message: 'Password changed. Other devices have been signed out.' });
});
