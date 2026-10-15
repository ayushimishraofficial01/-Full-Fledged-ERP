const nodemailer = require('nodemailer');
const env = require('../config/env');

let transporter = null;

function getTransporter() {
  if (!env.smtp.host) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
    });
  }
  return transporter;
}

function isEmailConfigured() {
  return Boolean(env.smtp.host);
}

async function sendMail({ to, subject, text, html }) {
  const t = getTransporter();
  if (!t) {
    if (!env.isTest) console.info(`[mail:dev] SMTP not configured. Email to ${to}\nSubject: ${subject}\n${text}`);
    return { delivered: false };
  }
  await t.sendMail({ from: env.smtp.from, to, subject, text, html });
  return { delivered: true };
}

async function sendPasswordResetEmail(user, resetUrl) {
  const subject = 'Reset your Inventory Manager password';
  const text = `Hi ${user.name},\n\nWe received a request to reset your password. Open this link within 30 minutes to choose a new one:\n\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`;
  const html = `<p>Hi ${escapeHtml(user.name)},</p><p>We received a request to reset your password. This link is valid for 30 minutes:</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`;
  return sendMail({ to: user.email, subject, text, html });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

module.exports = { sendMail, sendPasswordResetEmail, isEmailConfigured };
