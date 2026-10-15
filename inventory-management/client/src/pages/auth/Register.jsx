import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { parseError } from '../../services/api';
import { Button, Field, Input } from '../../components/ui';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidPhone(v) {
  let d = String(v || '').replace(/\D/g, '');
  if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
  else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d);
}

export function validatePassword(pw) {
  if (!pw || pw.length < 8) return 'Password must be at least 8 characters';
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain at least one letter';
  if (!/\d/.test(pw)) return 'Password must contain at least one number';
  return '';
}

export function PasswordStrength({ value }) {
  const checks = [value.length >= 8, /[A-Za-z]/.test(value) && /\d/.test(value), /[^A-Za-z0-9]/.test(value) || value.length >= 12];
  const score = checks.filter(Boolean).length;
  const colors = ['bg-slate-200', 'bg-red-400', 'bg-amber-400', 'bg-emerald-500'];
  const labels = ['', 'Weak', 'Good', 'Strong'];
  if (!value) return null;
  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < score ? colors[score] : 'bg-slate-200'}`} />)}
      </div>
      <span className="text-xs text-slate-500">{labels[score]}</span>
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (form.name.trim().length < 2) errs.name = 'Please enter your full name';
    if (!EMAIL_RE.test(form.email.trim())) errs.email = 'Please enter a valid email address';
    if (form.phone.trim() && !isValidPhone(form.phone)) errs.phone = 'Please enter a valid 10-digit mobile number';
    const pwErr = validatePassword(form.password);
    if (pwErr) errs.password = pwErr;
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await register({ ...form, name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() });
      toast.success('Welcome aboard! Your account is ready.');
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const p = parseError(err);
      setErrors(p.fieldErrors);
      setFormError(p.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Create your account</h1>
      <p className="mt-1.5 text-sm text-slate-500">Start managing stock across your warehouses.</p>
      {formError && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{formError}</div>}
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Full name" htmlFor="name" error={errors.name}>
          <Input id="name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} autoFocus />
        </Field>
        <Field label="Email" htmlFor="email" error={errors.email}>
          <Input id="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} placeholder="you@company.com" />
        </Field>
        <Field label="Mobile number (optional)" htmlFor="phone" error={errors.phone} hint="Lets you sign in with your phone number">
          <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={errors.phone} placeholder="98765 43210" />
        </Field>
        <Field label="Password" htmlFor="password" error={errors.password} hint="At least 8 characters with a letter and a number">
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={set('password')} error={errors.password} />
          <PasswordStrength value={form.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set('confirmPassword')} error={errors.confirmPassword} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={UserPlus}>
          Create account
        </Button>
      </form>
      <p className="mt-8 text-center text-sm text-slate-500">
        Already have an account? <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">Sign in</Link>
      </p>
    </div>
  );
}
