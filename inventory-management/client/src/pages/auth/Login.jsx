import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, Mail, Smartphone, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../../context/AuthContext';
import { parseError } from '../../services/api';
import { Button, Field, Input } from '../../components/ui';
import GoogleSignIn from '../../components/GoogleSignIn';
import { isValidPhone } from './Register';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const { login, loginWithGoogle, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [method, setMethod] = useState('email'); // email | phone
  const [form, setForm] = useState({ email: '', phone: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const goNext = () => navigate(location.state?.from?.pathname || '/dashboard', { replace: true });

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (method === 'email' && !EMAIL_RE.test(form.email.trim())) errs.identifier = 'Please enter a valid email address';
    if (method === 'phone' && !isValidPhone(form.phone)) errs.identifier = 'Please enter a valid 10-digit mobile number';
    if (!form.password) errs.password = 'Password is required';
    setErrors(errs);
    setFormError('');
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      await login({ identifier: method === 'email' ? form.email.trim() : form.phone.trim(), password: form.password });
      goNext();
    } catch (err) {
      const p = parseError(err);
      setErrors({ ...p.fieldErrors, ...(p.fieldErrors?.email ? { identifier: p.fieldErrors.email } : {}) });
      setFormError(p.message);
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential) => {
    setFormError('');
    setGoogleBusy(true);
    try {
      await loginWithGoogle(credential);
      goNext();
    } catch (err) {
      setFormError(parseError(err).message);
    } finally {
      setGoogleBusy(false);
    }
  };

  const tab = (key, Icon, label) => (
    <button
      type="button"
      role="tab"
      aria-selected={method === key}
      onClick={() => { setMethod(key); setErrors({}); setFormError(''); }}
      className={clsx('flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all', method === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800')}
    >
      <Icon className="h-4 w-4" strokeWidth={1.9} /> {label}
    </button>
  );

  return (
    <div>
      <Link to="/" className="-mt-1 mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:text-slate-800">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to home
      </Link>
      <h1 className="font-display text-2xl font-bold text-slate-900">Sign in</h1>
      <p className="mt-1.5 text-sm text-slate-500">Welcome back. Choose how you want to sign in.</p>

      {sessionExpired && !formError && (
        <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">Your session expired. Please sign in again.</div>
      )}
      {formError && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{formError}</div>}

      <div role="tablist" className="mt-6 flex gap-1 rounded-lg bg-slate-100 p-1">
        {tab('email', Mail, 'Email')}
        {tab('phone', Smartphone, 'Phone number')}
      </div>

      <form onSubmit={submit} className="mt-5 space-y-4" noValidate>
        {method === 'email' ? (
          <Field label="Email" htmlFor="identifier" error={errors.identifier}>
            <Input id="identifier" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.identifier} placeholder="you@company.com" autoFocus />
          </Field>
        ) : (
          <Field label="Mobile number" htmlFor="identifier" error={errors.identifier}>
            <div className="flex">
              <span className="flex h-10 items-center rounded-l-lg border border-r-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-600">+91</span>
              <Input id="identifier" type="tel" inputMode="tel" autoComplete="tel-national" value={form.phone} onChange={set('phone')} error={errors.identifier} placeholder="98765 43210" className="rounded-l-none" autoFocus />
            </div>
          </Field>
        )}
        <Field label="Password" htmlFor="password" error={errors.password}>
          <div className="relative">
            <Input id="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={form.password} onChange={set('password')} error={errors.password} className="pr-10" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </Field>
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-brand-600 hover:text-brand-700">Forgot password?</Link>
        </div>
        <Button type="submit" size="lg" className="w-full" loading={busy} icon={LogIn}>
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or <span className="h-px flex-1 bg-slate-200" />
      </div>
      <GoogleSignIn onCredential={onGoogle} onError={setFormError} disabled={googleBusy} />

      <p className="mt-8 text-center text-sm text-slate-500">
        New here? <Link to="/register" className="font-medium text-brand-600 hover:text-brand-700">Create an account</Link>
      </p>
    </div>
  );
}
