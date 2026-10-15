const { z } = require('./common');

const email = z.string({ required_error: 'Email is required' }).trim().toLowerCase().min(1, 'Email is required').max(254).email('Please enter a valid email address');
const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/\d/, 'Password must contain at least one number');

// Indian mobile number. Accepts "98765 43210", "+91-98765-43210", "09876543210"; stored as the 10 national digits.
function normalizePhone(value) {
  let d = String(value ?? '').replace(/[^\d]/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return d;
}
const optionalPhone = z
  .string()
  .trim()
  .max(20)
  .optional()
  .transform((v) => (v ? normalizePhone(v) : ''))
  .refine((v) => v === '' || /^[6-9]\d{9}$/.test(v), 'Please enter a valid 10-digit mobile number');

const register = z
  .object({
    name: z.string({ required_error: 'Full name is required' }).trim().min(2, 'Full name must be at least 2 characters').max(100),
    email,
    phone: optionalPhone,
    password,
    confirmPassword: z.string({ required_error: 'Please confirm your password' }),
  })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

// Sign in with an email address or a mobile number. `email` is still accepted for older clients.
const login = z
  .object({
    identifier: z.string().trim().max(254).optional(),
    email: z.string().trim().max(254).optional(),
    password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required').max(128),
  })
  .refine((d) => (d.identifier || d.email || '').length > 0, { message: 'Email or phone number is required', path: ['identifier'] });

const googleLogin = z.object({ credential: z.string({ required_error: 'Google credential is required' }).min(20).max(4096) });

const forgotPassword = z.object({ email });

const resetPassword = z
  .object({ password, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

const updateProfile = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters').max(100),
  email,
  phone: optionalPhone,
});

const changePassword = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

module.exports = { normalizePhone, googleLogin, register, login, forgotPassword, resetPassword, updateProfile, changePassword };
