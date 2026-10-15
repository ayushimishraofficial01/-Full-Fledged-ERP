import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { authService } from '../../services';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Button, Field, Input } from '../../components/ui';
import { PasswordStrength, validatePassword } from './Register';

export default function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { logout, isAuthenticated } = useAuth();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    const pw = validatePassword(form.password);
    if (pw) errs.password = pw;
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setBusy(true);
    try {
      const res = await authService.resetPassword(token, form);
      if (isAuthenticated) await logout();
      toast.success(res.message);
      navigate('/login', { replace: true });
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
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-slate-500">All your other sessions will be signed out.</p>
      {formError && <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700" role="alert">{formError}</div>}
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="New password" htmlFor="password" error={errors.password}>
          <Input id="password" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} error={errors.password} autoFocus />
          <PasswordStrength value={form.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
          <Input id="confirmPassword" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))} error={errors.confirmPassword} />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Update password</Button>
      </form>
      <Link to="/login" className="mt-8 inline-block text-sm font-medium text-brand-600 hover:text-brand-700">Back to sign in</Link>
    </div>
  );
}
