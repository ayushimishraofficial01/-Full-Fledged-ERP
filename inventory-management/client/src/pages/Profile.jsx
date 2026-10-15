import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save, KeyRound, LogOut, MonitorSmartphone } from 'lucide-react';
import { authService } from '../services';
import { parseError } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, ConfirmDialog, Field, Input, PageHeader } from '../components/ui';
import { PasswordStrength, validatePassword, isValidPhone } from './auth/Register';
import { formatDate } from '../utils/format';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [profile, setProfile] = useState({ name: user.name, email: user.email, phone: user.phone || '' });
  const [pErrors, setPErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [pwErrors, setPwErrors] = useState({});
  const [savingPw, setSavingPw] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    const errs = {};
    if (profile.name.trim().length < 2) errs.name = 'Please enter your full name';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email.trim())) errs.email = 'Please enter a valid email address';
    if (profile.phone.trim() && !isValidPhone(profile.phone)) errs.phone = 'Please enter a valid 10-digit mobile number';
    setPErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingProfile(true);
    try {
      const res = await authService.updateProfile({ name: profile.name.trim(), email: profile.email.trim(), phone: profile.phone.trim() });
      setUser(res.user);
      toast.success(res.message);
    } catch (err) {
      const p = parseError(err);
      setPErrors(p.fieldErrors);
      toast.error(p.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!pw.currentPassword) errs.currentPassword = 'Current password is required';
    const v = validatePassword(pw.newPassword);
    if (v) errs.newPassword = v;
    if (pw.newPassword !== pw.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setSavingPw(true);
    try {
      const res = await authService.changePassword(pw);
      toast.success(res.message);
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      const p = parseError(err);
      setPwErrors(p.fieldErrors);
      toast.error(p.message);
    } finally {
      setSavingPw(false);
    }
  };

  const logoutEverywhere = async () => {
    await logout({ everywhere: true });
    navigate('/login', { replace: true });
  };

  return (
    <>
      <PageHeader title="Profile" breadcrumbs={[{ label: 'Profile' }]} />
      <div className="grid max-w-5xl grid-cols-1 gap-6 lg:grid-cols-2">
        <Card title="Your details" description={<span className="flex items-center gap-2">Role <Badge tone="navy" className="capitalize">{user.role}</Badge> · member since {formatDate(user.createdAt)}</span>}>
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <Field label="Full name" htmlFor="pname" error={pErrors.name}>
              <Input id="pname" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} error={pErrors.name} />
            </Field>
            <Field label="Email" htmlFor="pemail" error={pErrors.email}>
              <Input id="pemail" type="email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))} error={pErrors.email} />
            </Field>
            <Field label="Mobile number" htmlFor="pphone" error={pErrors.phone} hint="Optional. Lets you sign in with your phone number.">
              <Input id="pphone" type="tel" inputMode="tel" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))} error={pErrors.phone} placeholder="98765 43210" />
            </Field>
            <Button type="submit" icon={Save} loading={savingProfile}>Save profile</Button>
          </form>
        </Card>
        <Card title="Change password" description="Other devices will be signed out.">
          <form onSubmit={changePassword} className="space-y-4" noValidate>
            <Field label="Current password" htmlFor="cur" error={pwErrors.currentPassword}>
              <Input id="cur" type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw((p) => ({ ...p, currentPassword: e.target.value }))} error={pwErrors.currentPassword} />
            </Field>
            <Field label="New password" htmlFor="new" error={pwErrors.newPassword}>
              <Input id="new" type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw((p) => ({ ...p, newPassword: e.target.value }))} error={pwErrors.newPassword} />
              <PasswordStrength value={pw.newPassword} />
            </Field>
            <Field label="Confirm new password" htmlFor="conf" error={pwErrors.confirmPassword}>
              <Input id="conf" type="password" autoComplete="new-password" value={pw.confirmPassword} onChange={(e) => setPw((p) => ({ ...p, confirmPassword: e.target.value }))} error={pwErrors.confirmPassword} />
            </Field>
            <Button type="submit" icon={KeyRound} loading={savingPw}>Update password</Button>
          </form>
        </Card>
        <Card title="Sessions" className="lg:col-span-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-sm text-slate-600">
              <MonitorSmartphone className="h-5 w-5 text-slate-400" />
              Signed in on this device. Last login {formatDate(user.lastLoginAt, { time: true })}.
            </div>
            <Button variant="danger-ghost" icon={LogOut} onClick={() => setConfirmAll(true)}>Log out of all devices</Button>
          </div>
        </Card>
      </div>
      <ConfirmDialog open={confirmAll} onClose={() => setConfirmAll(false)} onConfirm={logoutEverywhere} title="Log out everywhere?" message="Every active session, including this one, will be signed out." confirmLabel="Log out everywhere" />
    </>
  );
}
