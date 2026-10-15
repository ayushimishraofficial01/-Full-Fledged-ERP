const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const isProd = process.env.NODE_ENV === 'production';

function required(name, devFallback) {
  const value = process.env[name];
  if (value && value.trim() !== '') return value.trim();
  if (!isProd && devFallback !== undefined) return devFallback;
  throw new Error(`Missing required environment variable: ${name}`);
}

function bool(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase());
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  isTest: process.env.NODE_ENV === 'test',
  port: Number(process.env.PORT || 5000),
  mongoUri: required('MONGO_URI', 'mongodb://127.0.0.1:27017/inventory_management'),
  jwtSecret: required('JWT_SECRET', 'dev-only-insecure-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
  cookieName: process.env.COOKIE_NAME || 'ims_token',
  cookieSameSite: process.env.COOKIE_SAMESITE || 'lax',
  cookieSecure: bool('COOKIE_SECURE', isProd),
  allowRegistration: bool('ALLOW_REGISTRATION', !isProd),
  // Google Sign-In (OAuth client ID from Google Cloud Console). Empty = Google login disabled.
  googleClientId: (process.env.GOOGLE_CLIENT_ID || '').trim(),
  maxImageSizeMb: Number(process.env.MAX_IMAGE_SIZE_MB || 2),
  maxImportSizeMb: Number(process.env.MAX_IMPORT_SIZE_MB || 10),
  maxImportRows: Number(process.env.MAX_IMPORT_ROWS || 10000),
  maxExportRows: Number(process.env.MAX_EXPORT_ROWS || 50000),
  uploadDir: path.resolve(__dirname, '../../', process.env.UPLOAD_DIR || 'uploads'),
  serveClient: bool('SERVE_CLIENT', false),
  clientDist: path.resolve(__dirname, '../../../client/dist'),
  trustProxy: process.env.TRUST_PROXY || (isProd ? '1' : ''),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    secure: bool('SMTP_SECURE', false),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'Inventory Manager <no-reply@example.com>',
  },
  useTransactions: process.env.USE_TRANSACTIONS || 'auto', // auto | always | never
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata', // used to format dates in Excel exports
};

if (isProd && env.jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be at least 32 characters in production');
}

module.exports = env;
