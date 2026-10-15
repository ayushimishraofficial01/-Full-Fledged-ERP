import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { authService } from '../../services';
import { parseError } from '../../services/api';
import { Button, Field, Input } from '../../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setError('Please enter a valid email address');
    setError('');
    setBusy(true);
    try {
      setSent(await authService.forgotPassword({ email: email.trim() }));
    } catch (err) {
      setError(parseError(err).message);
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <div>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
          <MailCheck className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Check your email</h1>
        <p className="mt-2 text-sm text-slate-500">{sent.message} The link is valid for 30 minutes.</p>
        {sent.devResetUrl && (
          <div className="mt-5 rounded-lg border border-dashed border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-semibold">Development mode: email is not configured.</p>
            <a className="mt-1 block break-all font-medium text-brand-700 underline" href={sent.devResetUrl.replace(/^https?:\/\/[^/]+/, '')}>Open reset link</a>
          </div>
        )}
        <Link to="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Forgot password?</h1>
      <p className="mt-1.5 text-sm text-slate-500">Enter your account email and we will send you a reset link.</p>
      <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
        <Field label="Email" htmlFor="email" error={error}>
          <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} autoFocus />
        </Field>
        <Button type="submit" size="lg" className="w-full" loading={busy}>Send reset link</Button>
      </form>
      <Link to="/login" className="mt-8 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </div>
  );
}
