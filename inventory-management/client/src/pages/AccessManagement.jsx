import { useMemo, useState } from 'react';
import { ShieldCheck, Users, Save, History, Clock3 } from 'lucide-react';
import { accessService, hrService } from '../services';
import useFetch from '../hooks/useFetch';
import { useToast } from '../context/ToastContext';
import { Badge, Button, Card, Field, Input, Modal, PageHeader, Select, Textarea } from '../components/ui';
import { useAuth } from '../context/AuthContext';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DEFAULT_OFFICE_SCHEDULE = { startTime: '09:00', endTime: '18:00', timezone: 'Asia/Kolkata', weekdays: [1, 2, 3, 4, 5] };
const roleValue = (name) => name.toLowerCase();
const groupLabel = (group) => group.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

function OfficeScheduleEditor({ user, onSaved }) {
  const toast = useToast();
  const [schedule, setSchedule] = useState(user.officeSchedule || DEFAULT_OFFICE_SCHEDULE);
  const [configured, setConfigured] = useState(Boolean(user.officeSchedule?.startTime));
  const [saving, setSaving] = useState(false);

  const update = (key, value) => setSchedule((current) => ({ ...current, [key]: value }));
  const toggleWeekday = (day) => update('weekdays', schedule.weekdays.includes(day)
    ? schedule.weekdays.filter((value) => value !== day)
    : [...schedule.weekdays, day].sort());

  async function save() {
    setSaving(true);
    try {
      await accessService.updateUser(user._id || user.id, { officeSchedule: schedule });
      setConfigured(true);
      toast.success(`Office hours saved for ${user.name}.`);
      onSaved();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to save office hours.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-w-[250px] space-y-2">
      <p className={`text-xs font-medium ${configured ? 'text-emerald-700' : 'text-amber-700'}`}>
        {configured ? 'Schedule active' : 'Not set — suggested hours apply only after saving'}
      </p>
      <div className="flex gap-2">
        <Input aria-label={`Office start time for ${user.name}`} type="time" value={schedule.startTime} onChange={(event) => update('startTime', event.target.value)} className="min-w-0" />
        <Input aria-label={`Office end time for ${user.name}`} type="time" value={schedule.endTime} onChange={(event) => update('endTime', event.target.value)} className="min-w-0" />
      </div>
      <Input aria-label={`Timezone for ${user.name}`} value={schedule.timezone} onChange={(event) => update('timezone', event.target.value)} placeholder="IANA timezone, e.g. Asia/Kolkata" />
      <div className="flex flex-wrap gap-1">
        {WEEKDAYS.map((day, index) => (
          <button key={day} type="button" onClick={() => toggleWeekday(index)} aria-pressed={schedule.weekdays.includes(index)} className={`rounded-md border px-2 py-1 text-xs font-medium ${schedule.weekdays.includes(index) ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}>
            {day}
          </button>
        ))}
      </div>
      <Button size="sm" variant="secondary" icon={Clock3} loading={saving} disabled={!schedule.weekdays.length} onClick={save}>Save hours</Button>
    </div>
  );
}

export default function AccessManagement() {
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState('users');
  const users = useFetch(() => accessService.users(), []);
  const roles = useFetch(() => accessService.roles(), []);
  const permissions = useFetch(() => accessService.permissions(), []);
  const audit = useFetch(() => accessService.auditLogs(), []);
  const [selectedRole, setSelectedRole] = useState(null);
  const [savingRole, setSavingRole] = useState(false);
  const [createRoleOpen, setCreateRoleOpen] = useState(false);
  const [creatingRole, setCreatingRole] = useState(false);
  const [newRole, setNewRole] = useState({ name: '', description: '', permissions: [] });
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', employeeId: '', role: 'user', officeSchedule: { ...DEFAULT_OFFICE_SCHEDULE } });
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [creating, setCreating] = useState(false);
  const permissionGroups = useMemo(() => {
    const grouped = new Map();
    for (const permission of permissions.data?.permissions || []) {
      const group = permission.split('.')[0];
      grouped.set(group, [...(grouped.get(group) || []), permission]);
    }
    return [...grouped.entries()];
  }, [permissions.data?.permissions]);

  const addEmployeeDocuments = (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    const invalid = files.filter((file) => file.size > 10 * 1024 * 1024);
    if (invalid.length) toast.error(`Each document must be smaller than 10 MB: ${invalid.map((file) => file.name).join(', ')}`);
    const validFiles = files.filter((file) => file.size <= 10 * 1024 * 1024);
    setEmployeeDocuments((current) => {
      const knownFiles = new Set(current.map((file) => `${file.name}:${file.size}:${file.lastModified}`));
      return [
        ...current,
        ...validFiles.filter((file) => {
          const key = `${file.name}:${file.size}:${file.lastModified}`;
          if (knownFiles.has(key)) return false;
          knownFiles.add(key);
          return true;
        }),
      ];
    });
    input.value = '';
  };

  const createUser = async (event) => {
    event.preventDefault();
    setCreating(true);
    try {
      const result = await accessService.createUser({ ...newUser, status: 'active' });
      const employeeUserId = result.user.id || result.user._id;
      const failedDocuments = [];
      for (const file of employeeDocuments) {
        try {
          await hrService.uploadEmployeeDocument(employeeUserId, file);
        } catch (error) {
          failedDocuments.push(`${file.name}: ${error.response?.data?.message || error.message || 'Upload failed.'}`);
        }
      }
      setNewUser({ name: '', email: '', password: '', employeeId: '', role: 'user', officeSchedule: { ...DEFAULT_OFFICE_SCHEDULE } });
      setEmployeeDocuments([]);
      if (failedDocuments.length) {
        toast.error(`User created, but ${failedDocuments.length} document(s) could not be uploaded. Upload them from the employee profile: ${failedDocuments.join(', ')}`);
      } else {
        toast.success(employeeDocuments.length ? 'User created and documents added to the employee profile.' : 'User created');
      }
      users.reload();
      audit.reload();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create user');
    } finally { setCreating(false); }
  };

  const togglePermission = (permission) => setSelectedRole((role) => ({ ...role, permissions: role.permissions.includes(permission) ? role.permissions.filter((item) => item !== permission) : [...role.permissions, permission] }));
  const saveRole = async () => {
    setSavingRole(true);
    try { await accessService.updateRole(selectedRole._id, { permissions: selectedRole.permissions }); toast.success('Permissions saved'); roles.reload(); setSelectedRole(null); } catch (error) { toast.error(error.response?.data?.message || 'Unable to save permissions'); } finally { setSavingRole(false); }
  };

  const toggleNewRolePermission = (permission) => setNewRole((current) => ({
    ...current,
    permissions: current.permissions.includes(permission)
      ? current.permissions.filter((item) => item !== permission)
      : [...current.permissions, permission],
  }));

  const createRole = async (event) => {
    event.preventDefault();
    setCreatingRole(true);
    try {
      await accessService.createRole(newRole);
      setCreateRoleOpen(false);
      setNewRole({ name: '', description: '', permissions: [] });
      await Promise.all([roles.reload(), audit.reload()]);
      toast.success('Role created successfully.');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create role.');
    } finally {
      setCreatingRole(false);
    }
  };

  const changeUserRole = async (user, role) => {
    try { await accessService.updateUser(user._id || user.id, { role }); toast.success('Role updated'); users.reload(); audit.reload(); } catch (error) { toast.error(error.response?.data?.message || 'Unable to update role'); }
  };

  const toggleUserStatus = async (user) => {
    try { await accessService.updateStatus(user._id || user.id, user.status === 'active' ? 'inactive' : 'active'); toast.success('User status updated'); users.reload(); audit.reload(); } catch (error) { toast.error(error.response?.data?.message || 'Unable to update status'); }
  };

  return (
    <>
      <PageHeader title="User & Access Management" description="Create sales staff, set office schedules, and control access." breadcrumbs={[{ label: 'Settings' }, { label: 'User & Access' }]} />
      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {[['users', 'Users', Users], ['roles', 'Roles & Permissions', ShieldCheck], ['audit', 'Audit Logs', History]].map(([key, label, Icon]) => <button key={key} type="button" onClick={() => setTab(key)} className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors ${tab === key ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'}`}><Icon className="h-4 w-4" />{label}</button>)}
      </div>
      {tab === 'users' ? (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card title="Create User" className="xl:col-span-1">
            <form onSubmit={createUser} className="space-y-4">
              <Field label="Full name" htmlFor="accessName"><Input id="accessName" value={newUser.name} onChange={(e) => setNewUser((v) => ({ ...v, name: e.target.value }))} required /></Field>
              <Field label="Email" htmlFor="accessEmail"><Input id="accessEmail" type="email" value={newUser.email} onChange={(e) => setNewUser((v) => ({ ...v, email: e.target.value }))} required /></Field>
              <Field label="Password" htmlFor="accessPassword"><Input id="accessPassword" type="password" minLength="8" value={newUser.password} onChange={(e) => setNewUser((v) => ({ ...v, password: e.target.value }))} required /></Field>
              <Field label="Employee ID" htmlFor="accessEmployeeId" hint="Optional; this will appear in the employee profile."><Input id="accessEmployeeId" maxLength="50" value={newUser.employeeId} onChange={(e) => setNewUser((v) => ({ ...v, employeeId: e.target.value }))} /></Field>
              <Field label="Role" htmlFor="accessRole"><Select id="accessRole" value={newUser.role} onChange={(e) => setNewUser((v) => ({ ...v, role: e.target.value }))}>{(roles.data?.roles || []).map((role) => <option key={role._id} value={roleValue(role.name)}>{role.name}</option>)}</Select></Field>
              {hasPermission('hr.employees.edit') && hasPermission('hr.employees.view') && <div className="space-y-2">
                <Field label="Employee documents" htmlFor="employeeDocuments" hint="Optional · PDF, JPG or PNG, up to 10 MB each. Documents will be saved in the employee profile.">
                  <Input id="employeeDocuments" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" multiple onChange={addEmployeeDocuments} />
                </Field>
                {employeeDocuments.length > 0 && <ul className="space-y-1">
                  {employeeDocuments.map((file) => (
                    <li key={`${file.name}:${file.size}:${file.lastModified}`} className="flex items-center justify-between gap-2 text-xs text-slate-600">
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button type="button" className="shrink-0 font-medium text-red-700 hover:underline" onClick={() => setEmployeeDocuments((current) => current.filter((item) => item !== file))} aria-label={`Remove ${file.name}`}>Remove</button>
                    </li>
                  ))}
                </ul>}
              </div>}
              <div className="space-y-2 rounded-lg border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-800">Office hours</p>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Start" htmlFor="newOfficeStart"><Input id="newOfficeStart" type="time" value={newUser.officeSchedule.startTime} onChange={(e) => setNewUser((v) => ({ ...v, officeSchedule: { ...v.officeSchedule, startTime: e.target.value } }))} required /></Field>
                  <Field label="End" htmlFor="newOfficeEnd"><Input id="newOfficeEnd" type="time" value={newUser.officeSchedule.endTime} onChange={(e) => setNewUser((v) => ({ ...v, officeSchedule: { ...v.officeSchedule, endTime: e.target.value } }))} required /></Field>
                </div>
                <Field label="Timezone" htmlFor="newOfficeTimezone" hint="Use an IANA timezone such as Asia/Kolkata.">
                  <Input id="newOfficeTimezone" value={newUser.officeSchedule.timezone} onChange={(e) => setNewUser((v) => ({ ...v, officeSchedule: { ...v.officeSchedule, timezone: e.target.value } }))} required />
                </Field>
                <div>
                  <p className="label">Working days</p>
                  <div className="flex flex-wrap gap-1">
                    {WEEKDAYS.map((day, index) => <button key={day} type="button" aria-pressed={newUser.officeSchedule.weekdays.includes(index)} onClick={() => setNewUser((v) => ({ ...v, officeSchedule: { ...v.officeSchedule, weekdays: v.officeSchedule.weekdays.includes(index) ? v.officeSchedule.weekdays.filter((value) => value !== index) : [...v.officeSchedule.weekdays, index].sort() } }))} className={`rounded-md border px-2 py-1 text-xs font-medium ${newUser.officeSchedule.weekdays.includes(index) ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-500'}`}>{day}</button>)}
                  </div>
                </div>
              </div>
              <Button type="submit" loading={creating} disabled={!newUser.officeSchedule.weekdays.length} icon={Users}>Create User</Button>
            </form>
          </Card>
          <Card title="Users" className="xl:col-span-2" padded={false}>
          <div className="overflow-x-auto"><table className="w-full min-w-[1300px]"><thead><tr className="border-b border-slate-100"><th className="th">Name</th><th className="th">Employee ID</th><th className="th">Email</th><th className="th">Role</th><th className="th">Office hours / timezone / days</th><th className="th">Status</th><th className="th">Last Login</th><th className="th">Actions</th></tr></thead><tbody>{(users.data?.users || []).map((user) => <tr key={user._id || user.id} className="border-b border-slate-50"><td className="td font-semibold">{user.name}</td><td className="td">{user.employeeId || '—'}</td><td className="td">{user.email}</td><td className="td"><Select aria-label={`Role for ${user.name}`} className="w-32" value={user.role === 'staff' ? 'user' : user.role} onChange={(e) => changeUserRole(user, e.target.value)}>{(roles.data?.roles || []).map((role) => <option key={role._id} value={roleValue(role.name)}>{role.name}</option>)}</Select></td><td className="td"><OfficeScheduleEditor user={user} onSaved={users.reload} /></td><td className="td"><Badge tone={user.status === 'active' ? 'green' : 'slate'}>{user.status.toUpperCase()}</Badge></td><td className="td">{user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}</td><td className="td"><Button size="sm" variant="secondary" onClick={() => toggleUserStatus(user)}>{user.status === 'active' ? 'Disable' : 'Enable'}</Button></td></tr>)}</tbody></table></div>
          </Card>
        </div>
      ) : tab === 'roles' ? (
        <Card title="Roles & Permissions" description="Permission checks are enforced by the backend as well as the UI.">
          <div className="mb-5 flex justify-end">
          {hasPermission('roles.create') && <Button icon={ShieldCheck} onClick={() => { setNewRole({ name: '', description: '', permissions: [] }); setCreateRoleOpen(true); }}>Add Role</Button>}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(roles.data?.roles || []).map((role) => (
              <div key={role._id} className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-900">{role.name}</span>
                  <Badge tone={role.isSystemRole ? 'blue' : 'slate'}>{role.users} users</Badge>
                </div>
                  {role.description && <p className="mt-2 text-xs text-slate-500">{role.description}</p>}
                  <p className="mt-2 text-[13px] text-slate-500">{role.permissions.length} permissions</p>
                  {hasPermission('roles.edit') && <Button type="button" size="sm" variant="secondary" className="mt-4" onClick={() => setSelectedRole({ ...role, permissions: [...role.permissions] })}>Edit Permissions</Button>}
              </div>
            ))}
          </div>
          {selectedRole && (
            <div className="mt-6 border-t border-slate-200 pt-5">
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{selectedRole.name} permissions</h3>
                  <p className="mt-1 text-[13px] text-slate-500">Toggle granular access for this role.</p>
                </div>
                <Button icon={Save} loading={savingRole} onClick={saveRole}>Save Permissions</Button>
              </div>
              <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-2 xl:grid-cols-3">
                {permissionGroups.map(([group, groupPermissions]) => (
                  <div key={group} className="border-t border-slate-200 pt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">{groupLabel(group)}</p>
                    {groupPermissions.map((permission) => (
                      <label key={permission} className="flex items-center gap-2 py-1 text-[13px] text-slate-700">
                        <input type="checkbox" checked={selectedRole.permissions.includes(permission)} onChange={() => togglePermission(permission)} />
                        {permission}
                      </label>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <Modal
            open={createRoleOpen && hasPermission('roles.create')}
            onClose={() => setCreateRoleOpen(false)}
            title="Add Role"
            description="Create a custom role and choose the permissions it should have."
            size="xl"
            footer={<>
              <Button variant="secondary" onClick={() => setCreateRoleOpen(false)}>Cancel</Button>
              <Button type="submit" form="create-role-form" loading={creatingRole}>Create Role</Button>
            </>}
          >
            <form id="create-role-form" onSubmit={createRole} className="space-y-5">
              <Field label="Role name" htmlFor="newRoleName" hint="Use a clear name, such as Sales Supervisor.">
                <Input id="newRoleName" required minLength={2} maxLength={50} pattern="[A-Za-z][A-Za-z0-9 _-]*" value={newRole.name} onChange={(event) => setNewRole((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Description" htmlFor="newRoleDescription">
                <Textarea id="newRoleDescription" maxLength={300} value={newRole.description} onChange={(event) => setNewRole((current) => ({ ...current, description: event.target.value }))} />
              </Field>
              <div>
                <p className="mb-1 text-sm font-semibold text-slate-800">Permissions</p>
                <p className="mb-4 text-xs text-slate-500">No permissions are selected by default. Grant only the access this role needs.</p>
                <div className="grid max-h-[45vh] grid-cols-1 gap-x-6 gap-y-5 overflow-y-auto md:grid-cols-2">
                  {permissionGroups.map(([group, groupPermissions]) => (
                    <fieldset key={group} className="border-t border-slate-200 pt-3">
                      <legend className="mb-2 text-xs font-semibold text-slate-500">{groupLabel(group)}</legend>
                      {groupPermissions.map((permission) => (
                        <label key={permission} className="flex items-center gap-2 py-1 text-[13px] text-slate-700">
                          <input type="checkbox" checked={newRole.permissions.includes(permission)} onChange={() => toggleNewRolePermission(permission)} />
                          {permission}
                        </label>
                      ))}
                    </fieldset>
                  ))}
                </div>
              </div>
            </form>
          </Modal>
        </Card>
      ) : (
        <Card title="Audit Logs" description="Sensitive role, permission, status, and password actions."><div className="overflow-x-auto"><table className="w-full min-w-[800px]"><thead><tr className="border-b border-slate-100"><th className="th">Date</th><th className="th">Actor</th><th className="th">Action</th><th className="th">Target</th><th className="th">Role Change</th></tr></thead><tbody>{(audit.data?.logs || []).map((log) => <tr key={log._id} className="border-b border-slate-50"><td className="td">{new Date(log.createdAt).toLocaleString()}</td><td className="td">{log.actor?.name || '—'}</td><td className="td font-semibold">{log.action}</td><td className="td">{log.targetUser?.email || log.targetRole?.name || '—'}</td><td className="td">{log.oldRole || log.newRole ? `${log.oldRole || '—'} → ${log.newRole || '—'}` : '—'}</td></tr>)}</tbody></table></div></Card>
      )}
    </>
  );
}
