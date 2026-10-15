import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Activity, ArrowRight, Bell, BriefcaseBusiness, Building2, CalendarCheck, CalendarDays, Check, Clock3,
  ChevronLeft, ChevronRight, Download, FileText, Plus, Search, Users, Wallet,
} from 'lucide-react';
import { Button, Card, Field, Input, PageHeader, Select } from '../../components/ui';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { hrService } from '../../services';
import { parseError } from '../../services/api';

const sections = [
  ['dashboard', '/hr/dashboard', 'Overview', Activity, 'hr.dashboard.view'],
  ['employees', '/hr/employees', 'Employees', Users, 'hr.employees.view'],
  ['departments', '/hr/departments', 'Departments', Building2, 'hr.employees.view'],
  ['attendance', '/hr/attendance', 'Attendance', CalendarCheck, 'hr.attendance.view'],
  ['leaves', '/hr/leaves', 'Leave', CalendarDays, 'hr.leaves.view'],
  ['payroll', '/hr/payroll', 'Payroll', Wallet, 'hr.payroll.view'],
  ['reports', '/hr/reports', 'Reports', FileText, 'hr.reports.view'],
];

const dateOnly = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const currency = (amount = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(amount) || 0);
const prettyDate = (value) => value ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const humanStatus = (value = '') => String(value?.name || value?.code || value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function Metric({ title, value, icon: Icon, tone = 'sky' }) {
  const tones = {
    sky: 'bg-sky-500/10 text-sky-600',
    green: 'bg-emerald-500/10 text-emerald-600',
    amber: 'bg-amber-500/10 text-amber-600',
    rose: 'bg-rose-500/10 text-rose-600',
    violet: 'bg-violet-500/10 text-violet-600',
    navy: 'bg-slate-500/10 text-slate-600',
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">{title}</p>
        <span className={`rounded-lg p-2 ${tones[tone]}`}><Icon className="h-4 w-4" /></span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-slate-900">{value ?? 0}</p>
    </Card>
  );
}

function Empty({ children }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
}

function EmployeeProfile({ employee, onClose }) {
  const toast = useToast();
  const [tab, setTab] = useState('Overview');
  const [data, setData] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState('');
  const id = employee._id || employee.id;
  useEffect(() => () => {
    if (photoUrl) URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);
  const load = async () => {
    setLoading(true);
    try {
      const [profile, documentResult] = await Promise.all([
        hrService.employee(id),
        hrService.employeeDocuments(id),
      ]);
      const user = profile.users?.[0] || employee;
      setData({ ...profile, user });
      setDocuments(documentResult.documents || []);
      if (user.profilePhoto === `/api/hr/employees/${id}/photo`) {
        const photo = await hrService.employeePhoto(id);
        setPhotoUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return URL.createObjectURL(photo.data);
        });
      } else {
        setPhotoUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return '';
        });
      }
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [id]);
  const download = async (file) => {
    try {
      const response = await hrService.downloadEmployeeDocument(id, file._id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = file.originalName;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };
  const upload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await hrService.uploadEmployeeDocument(id, file);
      toast.success('Employee document uploaded securely.');
      await load();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };
  const uploadPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await hrService.uploadEmployeePhoto(id, file);
      toast.success('Profile photo updated securely.');
      await load();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      event.target.value = '';
      setUploading(false);
    }
  };
  const tabs = ['Overview', 'Personal', 'Professional', 'Attendance', 'Leave', 'Payroll', 'Documents', 'Activity'];
  const user = data?.user || employee;
  const attendance = data?.rows || [];
  const leaves = data?.leaves || [];
  const payroll = data?.payroll || [];
  const details = (items) => <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map(([label, value]) => <div key={label} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-800">{value || '—'}</dd></div>)}</dl>;
  return (
    <Card title={`Employee profile · ${user.name}`} description="Profile information and related records are loaded from the linked Gen Vyro user account." actions={<Button size="xs" variant="secondary" onClick={onClose}>Close profile</Button>}>
      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-100 pb-3">
        {tabs.map((name) => <button type="button" key={name} onClick={() => setTab(name)} className={`rounded-lg px-3 py-2 text-sm ${tab === name ? 'bg-brand-50 font-semibold text-brand-700' : 'text-slate-600 hover:bg-slate-50'}`}>{name}</button>)}
      </div>
      {loading ? <Empty>Loading employee profile…</Empty> : <>
        {tab === 'Overview' && <>{photoUrl && <img src={photoUrl} alt={`${user.name} profile`} className="mb-4 h-20 w-20 rounded-full object-cover" />}{details([['Name', user.name], ['Employee ID', user.employeeId], ['Department', user.department], ['Designation', user.designation], ['Status', humanStatus(user.status)], ['Joining date', prettyDate(user.joiningDate)]])}</>}
        {tab === 'Personal' && <div className="space-y-4">
          <div className="flex items-center gap-4">
            {photoUrl ? <img src={photoUrl} alt={`${user.name} profile`} className="h-20 w-20 rounded-full object-cover" /> : <span className="grid h-20 w-20 place-items-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-500">{user.name?.slice(0, 1)}</span>}
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">{uploading ? 'Uploading…' : 'Upload profile photo'}<input className="sr-only" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" disabled={uploading} onChange={uploadPhoto} /></label>
          </div>
          {details([['Email', user.email], ['Phone', user.phone], ['Date of birth', prettyDate(user.dateOfBirth)], ['Emergency contact', user.emergencyContact], ['Address', user.address]])}
        </div>}
        {tab === 'Professional' && details([['Department', user.department], ['Designation', user.designation], ['Employment type', humanStatus(user.employmentType)], ['Reporting manager', user.reportingManager?.name || user.manager?.name], ['Branch / location', user.branch || user.workLocation], ['Employee status', humanStatus(user.status)]])}
        {tab === 'Attendance' && <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr>{['Date', 'Check-in', 'Check-out', 'Hours', 'Status'].map((label) => <th className="px-3 py-2 text-slate-500" key={label}>{label}</th>)}</tr></thead><tbody>{attendance.map((row) => <tr key={row._id} className="border-t border-slate-100"><td className="px-3 py-2">{prettyDate(row.date)}</td><td className="px-3 py-2">{row.checkInTime || '—'}</td><td className="px-3 py-2">{row.checkOutTime || '—'}</td><td className="px-3 py-2">{row.workingHoursMinutes ? `${Math.floor(row.workingHoursMinutes / 60)}h ${row.workingHoursMinutes % 60}m` : '—'}</td><td className="px-3 py-2">{humanStatus(row.status)}</td></tr>)}</tbody></table>{!attendance.length && <Empty>No attendance records available.</Empty>}</div>}
        {tab === 'Leave' && <div className="space-y-2">{leaves.map((leave) => <div key={leave._id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span>{leave.leaveType?.name || 'Leave'} · {prettyDate(leave.startDate)} – {prettyDate(leave.endDate)}</span><span>{humanStatus(leave.status)}</span></div>)}{!leaves.length && <Empty>No leave records available.</Empty>}</div>}
        {tab === 'Payroll' && <div className="space-y-2">{payroll.map((run) => <div key={run._id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-slate-50 p-3 text-sm"><span>{run.period} · {humanStatus(run.status)}</span><span>{currency(run.netPay)}</span></div>)}{!payroll.length && <Empty>No payroll records available or you do not have payroll access.</Empty>}</div>}
        {tab === 'Documents' && <div className="space-y-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white">{uploading ? 'Uploading…' : 'Upload document'}<input className="sr-only" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" disabled={uploading} onChange={upload} /></label>
          <p className="text-xs text-slate-500">Private, authenticated downloads only. PDF, JPG or PNG up to 10 MB.</p>
          {documents.map((document) => <div key={document._id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3"><span className="truncate text-sm">{document.originalName}</span><Button size="xs" variant="secondary" onClick={() => download(document)}>Download</Button></div>)}
          {!documents.length && <Empty>No documents uploaded.</Empty>}
        </div>}
        {tab === 'Activity' && <div className="space-y-2">{(data?.activity || []).map((entry) => <div key={entry._id} className="rounded-lg bg-slate-50 p-3 text-sm"><span className="font-medium">{entry.actor?.name || 'User'}</span> · {humanStatus(entry.action)}<p className="mt-1 text-xs text-slate-500">{prettyDate(entry.createdAt)}</p></div>)}{!data?.activity?.length && <Empty>No HR activity recorded.</Empty>}</div>}
      </>}
    </Card>
  );
}

function BarList({ title, rows = [], labelKey = 'label', valueKey = 'value', color = 'bg-brand-600' }) {
  const max = Math.max(1, ...rows.map((row) => Number(row[valueKey]) || 0));
  return (
    <Card title={title}>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={`${row[labelKey]}-${index}`}>
              <div className="mb-1 flex justify-between gap-3 text-sm">
                <span className="truncate text-slate-600">{row[labelKey]}</span>
                <span className="num font-medium text-slate-800">{row[valueKey]}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(3, ((Number(row[valueKey]) || 0) / max) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      ) : <Empty>No report data available yet.</Empty>}
    </Card>
  );
}

function Employees({ employees = [], departments = [], reload, canEdit }) {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const filtered = employees.filter((employee) => `${employee.name} ${employee.email} ${employee.employeeId} ${employee.department}`.toLowerCase().includes(search.toLowerCase()));
  const beginEdit = (employee) => {
    setEditing(employee);
    setForm({
      employeeId: employee.employeeId || '',
      department: employee.department || '',
      designation: employee.designation || '',
      employmentType: employee.employmentType || 'full_time',
      status: employee.status || 'active',
      phone: employee.phone || '',
      joiningDate: employee.joiningDate ? dateOnly(new Date(employee.joiningDate)) : '',
      reportingManager: employee.reportingManager?._id || employee.reportingManager || '',
      branch: employee.branch || '',
      emergencyContact: employee.emergencyContact || '',
      dateOfBirth: employee.dateOfBirth ? dateOnly(new Date(employee.dateOfBirth)) : '',
      address: employee.address || '',
      salaryStructure: {
        basicSalary: employee.salaryStructure?.basicSalary ?? 0,
        hra: employee.salaryStructure?.hra ?? 0,
        allowances: employee.salaryStructure?.allowances ?? 0,
        bonus: employee.salaryStructure?.bonus ?? 0,
        overtimeRate: employee.salaryStructure?.overtimeRate ?? 0,
        deductions: employee.salaryStructure?.deductions ?? 0,
      },
    });
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        joiningDate: form.joiningDate || null,
        dateOfBirth: form.dateOfBirth || null,
        reportingManager: form.reportingManager || null,
        salaryStructure: Object.fromEntries(
          Object.entries(form.salaryStructure).map(([key, value]) => [key, Number(value) || 0])
        ),
      };
      await hrService.updateEmployeeProfile(editing._id || editing.id, payload);
      toast.success('Employee profile saved.');
      setEditing(null);
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSaving(false);
    }
  };
  const setValue = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  return (
    <div className="space-y-4">
      {profile && <EmployeeProfile employee={profile} onClose={() => setProfile(null)} />}
      {editing && (
        <Card title={`Employee profile · ${editing.name}`} description="Profile fields are attached to the existing Gen Vyro user account.">
          <form onSubmit={save} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Employee ID"><Input value={form.employeeId} onChange={setValue('employeeId')} /></Field>
            <Field label="Department">
              <Select value={form.department} onChange={setValue('department')}>
                <option value="">Select department</option>
                {departments.map((department) => <option key={department._id} value={department.name}>{department.name}</option>)}
              </Select>
            </Field>
            <Field label="Designation"><Input value={form.designation} onChange={setValue('designation')} /></Field>
            <Field label="Employment status">
              <Select value={form.status} onChange={setValue('status')}>
                <option value="active">Active</option><option value="inactive">Inactive</option><option value="suspended">Suspended</option>
              </Select>
            </Field>
            <Field label="Contact number"><Input value={form.phone} onChange={setValue('phone')} inputMode="numeric" maxLength={10} /></Field>
            <Field label="Joining date"><Input type="date" value={form.joiningDate} onChange={setValue('joiningDate')} /></Field>
            <Field label="Employment type">
              <Select value={form.employmentType} onChange={setValue('employmentType')}>
                <option value="full_time">Full time</option><option value="part_time">Part time</option>
                <option value="contract">Contract</option><option value="intern">Intern</option>
              </Select>
            </Field>
            <Field label="Branch / location"><Input value={form.branch} onChange={setValue('branch')} /></Field>
            <Field label="Emergency contact"><Input value={form.emergencyContact} onChange={setValue('emergencyContact')} /></Field>
            <Field label="Date of birth"><Input type="date" value={form.dateOfBirth} onChange={setValue('dateOfBirth')} /></Field>
            <Field label="Address"><Input value={form.address} onChange={setValue('address')} /></Field>
            <div className="sm:col-span-2 xl:col-span-3">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Configurable salary structure (monthly)</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {[
                  ['basicSalary', 'Basic salary'],
                  ['hra', 'HRA'],
                  ['allowances', 'Allowances'],
                  ['bonus', 'Bonus'],
                  ['overtimeRate', 'Overtime rate per hour'],
                  ['deductions', 'Deductions'],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    <Input type="number" min="0" step="0.01" value={form.salaryStructure[key]} onChange={(event) => setForm((current) => ({ ...current, salaryStructure: { ...current.salaryStructure, [key]: event.target.value } }))} />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-xs text-slate-500">No country-specific tax or statutory deduction rules are applied.</p>
            </div>
            <div className="flex gap-2 sm:col-span-2 xl:col-span-3">
              <Button type="submit" loading={saving}>Save profile</Button>
              <Button variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </form>
        </Card>
      )}
      <Card title="Employee directory" description="Employee profiles are linked to existing user accounts.">
        <div className="mb-4 flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input aria-label="Search employees" placeholder="Search name, employee ID, email or department" value={search} onChange={(event) => setSearch(event.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead><tr className="border-b border-slate-200 text-slate-500">
              {['Employee', 'Employee ID', 'Department', 'Designation', 'Employment type', 'Status', ''].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}
            </tr></thead>
            <tbody>{filtered.map((employee) => (
              <tr key={employee._id || employee.id} className="border-b border-slate-100">
                <td className="px-3 py-3"><span className="block font-medium text-slate-900">{employee.name}</span><span className="text-xs text-slate-500">{employee.email}</span></td>
                <td className="px-3 py-3">{employee.employeeId || '—'}</td>
                <td className="px-3 py-3">{employee.department || 'General'}</td>
                <td className="px-3 py-3">{employee.designation || '—'}</td>
                <td className="px-3 py-3">{humanStatus(employee.employmentType || 'full_time')}</td>
                <td className="px-3 py-3">{humanStatus(employee.status || 'active')}</td>
                <td className="px-3 py-3"><div className="flex gap-1"><Button size="xs" variant="secondary" onClick={() => setProfile(employee)}>View profile</Button>{canEdit && <Button size="xs" variant="secondary" onClick={() => beginEdit(employee)}>Edit profile</Button>}</div></td>
              </tr>
            ))}</tbody>
          </table>
          {!filtered.length && <Empty>No employee profiles found.</Empty>}
        </div>
      </Card>
    </div>
  );
}

function Departments({ departments = [], employees = [], reload, canEdit }) {
  const toast = useToast();
  const [form, setForm] = useState({ name: '', description: '', manager: '' });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      if (editingId) await hrService.updateDepartment(editingId, form);
      else await hrService.createDepartment(form);
      toast.success(editingId ? 'Department updated.' : 'Department added.');
      setForm({ name: '', description: '', manager: '' });
      setEditingId('');
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSaving(false);
    }
  };
  const edit = (department) => {
    setEditingId(department._id);
    setForm({ name: department.name, description: department.description || '', manager: department.manager?._id || department.manager || '' });
  };
  const toggleDepartment = async (department) => {
    try {
      await hrService.updateDepartment(department._id, { isActive: department.isActive === false });
      toast.success(department.isActive === false ? 'Department activated.' : 'Department deactivated.');
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };
  return (
    <div className="space-y-4">
      {canEdit && <Card title={editingId ? 'Edit department' : 'Add department'}>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Field label="Department name"><Input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
          <Field label="Description"><Input value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
          <Field label="Department manager">
            <Select value={form.manager} onChange={(event) => setForm({ ...form, manager: event.target.value })}>
              <option value="">No manager assigned</option>
              {employees.map((employee) => <option key={employee._id || employee.id} value={employee._id || employee.id}>{employee.name}</option>)}
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" loading={saving} icon={editingId ? Check : Plus}>{editingId ? 'Save' : 'Add department'}</Button>
            {editingId && <Button type="button" variant="secondary" onClick={() => { setEditingId(''); setForm({ name: '', description: '', manager: '' }); }}>Cancel</Button>}
          </div>
        </form>
      </Card>}
      <Card title="Departments" description="Employee membership is based on the department profile field.">
        {departments.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {departments.map((department) => (
            <div key={department._id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <div><h3 className="font-semibold text-slate-900">{department.name}</h3><p className="mt-1 text-sm text-slate-500">{department.description || 'No description'}</p></div>
                <span className={`rounded-full px-2 py-1 text-xs ${department.isActive === false ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>{department.isActive === false ? 'Inactive' : 'Active'}</span>
              </div>
              <p className="mt-3 text-sm text-slate-600">Manager: {department.manager?.name || 'Unassigned'}</p>
              <p className="mt-1 text-sm text-slate-600">Employees: {department.employeeCount ?? department.employees?.length ?? 0}</p>
              {canEdit && <div className="mt-3 flex gap-2">
                <Button size="xs" variant="secondary" onClick={() => edit(department)}>Edit</Button>
                <Button size="xs" variant="secondary" onClick={() => toggleDepartment(department)}>{department.isActive === false ? 'Activate' : 'Deactivate'}</Button>
              </div>}
            </div>
          ))}
        </div> : <Empty>No departments yet. Add one to start organizing employee profiles.</Empty>}
      </Card>
    </div>
  );
}

function Leaves({ requests = [], balances = [], types = [], employees = [], reload, canApprove, canApply }) {
  const toast = useToast();
  const [form, setForm] = useState({ leaveTypeId: '', startDate: dateOnly(), endDate: dateOnly(), reason: '' });
  const [typeForm, setTypeForm] = useState({ name: '', code: '', annualAllowance: 12, isPaid: true });
  const [balanceForm, setBalanceForm] = useState({ employeeId: '', leaveTypeId: '', year: new Date().getFullYear(), allocatedDays: 12 });
  const [saving, setSaving] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState('');
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const first = new Date(year, month, 1);
    const count = new Date(year, month + 1, 0).getDate();
    const offset = (first.getDay() + 6) % 7;
    return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, index) => {
      const day = index - offset + 1;
      return day < 1 || day > count ? null : new Date(year, month, day);
    });
  }, [calendarMonth]);
  const requestsOnDate = (date) => {
    if (!date) return [];
    const key = dateOnly(date);
    return requests.filter((request) => {
      const start = dateOnly(new Date(request.startDate));
      const end = dateOnly(new Date(request.endDate));
      return key >= start && key <= end;
    });
  };
  const apply = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const leaveTypeId = form.leaveTypeId || types[0]?._id;
      if (!leaveTypeId) throw new Error('No active leave type is available.');
      await hrService.applyLeave({ ...form, leaveTypeId });
      toast.success('Leave request submitted.');
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSaving(false);
    }
  };
  const saveType = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await hrService.createLeaveType({ ...typeForm, annualAllowance: Number(typeForm.annualAllowance) });
      toast.success('Leave type added.');
      setTypeForm({ name: '', code: '', annualAllowance: 12, isPaid: true });
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSaving(false);
    }
  };
  const deactivateType = async (type) => {
    try {
      await hrService.deactivateLeaveType(type._id);
      toast.success(`${type.name} deactivated.`);
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };
  const setBalance = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await hrService.setLeaveBalance({ ...balanceForm, year: Number(balanceForm.year), allocatedDays: Number(balanceForm.allocatedDays) });
      toast.success('Leave balance updated.');
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSaving(false);
    }
  };
  const review = async (request, status) => {
    try {
      await hrService.reviewLeave(request._id, { status });
      toast.success(`Leave request ${status}.`);
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };
  return (
    <div className="space-y-4">
      {canApply && <Card title="Apply for leave">
        <form onSubmit={apply} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label="Leave type"><Select value={form.leaveTypeId || types[0]?._id || ''} onChange={(event) => setForm({ ...form, leaveTypeId: event.target.value })}>
            {types.filter((type) => type.isActive !== false).map((type) => <option key={type._id} value={type._id}>{type.name} · {type.annualAllowance} days</option>)}
          </Select></Field>
          <Field label="From"><Input type="date" required value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} /></Field>
          <Field label="To"><Input type="date" required value={form.endDate} onChange={(event) => setForm({ ...form, endDate: event.target.value })} /></Field>
          <Field label="Reason"><Input required value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></Field>
          <div className="flex items-end"><Button type="submit" loading={saving}>Submit request</Button></div>
        </form>
      </Card>}
      {canApprove && <Card title="Leave type & balance settings" description="Configure company leave categories and per-employee annual allocations.">
        <div className="grid gap-5 xl:grid-cols-2">
          <form onSubmit={saveType} className="grid gap-3 sm:grid-cols-2">
            <Field label="New type name"><Input required value={typeForm.name} onChange={(event) => setTypeForm({ ...typeForm, name: event.target.value })} /></Field>
            <Field label="Code"><Input required value={typeForm.code} maxLength={20} onChange={(event) => setTypeForm({ ...typeForm, code: event.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '') })} /></Field>
            <Field label="Annual days"><Input required type="number" min="0" max="366" step="0.5" value={typeForm.annualAllowance} onChange={(event) => setTypeForm({ ...typeForm, annualAllowance: event.target.value })} /></Field>
            <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={typeForm.isPaid} onChange={(event) => setTypeForm({ ...typeForm, isPaid: event.target.checked })} /> Paid leave</label>
            <Button type="submit" loading={saving}>Add leave type</Button>
          </form>
          <form onSubmit={setBalance} className="grid gap-3 sm:grid-cols-2">
            <Field label="Employee"><Select required value={balanceForm.employeeId} onChange={(event) => setBalanceForm({ ...balanceForm, employeeId: event.target.value })}><option value="">Select employee</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name}</option>)}</Select></Field>
            <Field label="Leave type"><Select required value={balanceForm.leaveTypeId} onChange={(event) => setBalanceForm({ ...balanceForm, leaveTypeId: event.target.value })}><option value="">Select type</option>{types.filter((type) => type.isActive !== false).map((type) => <option key={type._id} value={type._id}>{type.name}</option>)}</Select></Field>
            <Field label="Year"><Input type="number" min="2000" max="2200" value={balanceForm.year} onChange={(event) => setBalanceForm({ ...balanceForm, year: event.target.value })} /></Field>
            <Field label="Allocated days"><Input type="number" min="0" max="366" step="0.5" value={balanceForm.allocatedDays} onChange={(event) => setBalanceForm({ ...balanceForm, allocatedDays: event.target.value })} /></Field>
            <Button type="submit" loading={saving}>Save balance</Button>
          </form>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">{types.map((type) => <span key={type._id} className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs text-slate-700">{type.name} · {type.annualAllowance} days · {type.isPaid ? 'Paid' : 'Unpaid'}{type.isActive !== false && <button type="button" className="font-semibold text-rose-600" onClick={() => deactivateType(type)}>Deactivate</button>}</span>)}</div>
      </Card>}
      {balances.length > 0 && <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {balances.map((balance) => <Metric key={balance._id || balance.leaveType || balance.type} title={`${humanStatus(balance.leaveType || balance.type)} balance`} value={`${balance.remaining ?? balance.balance ?? 0} day(s)`} icon={CalendarDays} tone="violet" />)}
      </div>}
      <Card title="Leave requests" description="Pending requests require manager or HR review.">
        {requests.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-slate-500">{['Employee', 'Leave type', 'Dates', 'Days', 'Reason', 'Status', 'Action'].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{requests.map((request) => <tr key={request._id} className="border-b border-slate-100">
            <td className="px-3 py-3">{request.employee?.name || request.employeeName || '—'}</td>
            <td className="px-3 py-3">{humanStatus(request.leaveType || request.type || '')}</td>
            <td className="px-3 py-3">{prettyDate(request.startDate)} – {prettyDate(request.endDate)}</td>
            <td className="px-3 py-3">{request.days ?? '—'}</td>
            <td className="max-w-56 truncate px-3 py-3" title={request.reason}>{request.reason || '—'}</td>
            <td className="px-3 py-3">{humanStatus(request.status || 'pending')}</td>
            <td className="px-3 py-3">{canApprove && request.status === 'pending' && <div className="flex gap-1"><Button size="xs" onClick={() => review(request, 'approved')}>Approve</Button><Button size="xs" variant="secondary" onClick={() => review(request, 'rejected')}>Reject</Button></div>}</td>
          </tr>)}</tbody>
        </table></div> : <Empty>No leave requests recorded.</Empty>}
      </Card>
      <Card title="Leave calendar" description="Approved, pending and rejected leave dates from the connected leave records.">
        <div className="mb-3 flex items-center justify-between">
          <Button size="xs" variant="secondary" icon={ChevronLeft} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1))}>Previous</Button>
          <h3 className="font-semibold text-slate-800">{calendarMonth.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</h3>
          <Button size="xs" variant="secondary" icon={ChevronRight} onClick={() => setCalendarMonth((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1))}>Next</Button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day} className="py-2 text-xs font-medium text-slate-500">{day}</span>)}
          {calendarDays.map((date, index) => {
            const onDate = requestsOnDate(date);
            const approved = onDate.some((request) => request.status === 'approved');
            const pending = onDate.some((request) => request.status === 'pending');
            return date ? <button key={index} type="button" onClick={() => setSelectedDate(dateOnly(date))} className={`min-h-12 rounded-lg border text-sm ${selectedDate === dateOnly(date) ? 'border-brand-600 bg-brand-50 font-semibold' : approved ? 'border-emerald-200 bg-emerald-50' : pending ? 'border-amber-200 bg-amber-50' : 'border-slate-100 hover:bg-slate-50'}`}>
              <span>{date.getDate()}</span>
              {onDate.length > 0 && <span className="mx-auto mt-1 block h-1.5 w-1.5 rounded-full bg-current text-brand-600" />}
            </button> : <span key={index} className="min-h-12" />;
          })}
        </div>
        {selectedDate && <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
          <p className="font-medium text-slate-800">{prettyDate(selectedDate)}</p>
          {requestsOnDate(new Date(`${selectedDate}T12:00:00`)).length
            ? requestsOnDate(new Date(`${selectedDate}T12:00:00`)).map((request) => <p key={request._id} className="mt-1 text-slate-600">{request.employee?.name || request.employeeName || 'Employee'} · {humanStatus(request.status)} · {humanStatus(request.leaveType || request.type || '')}</p>)
            : <p className="mt-1 text-slate-500">No leave requests for this date.</p>}
        </div>}
      </Card>
    </div>
  );
}

function Payroll({ runs = [], employees = [], reload, canManage }) {
  const toast = useToast();
  const today = new Date();
  const [period, setPeriod] = useState(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`);
  const [saving, setSaving] = useState(false);
  const process = async () => {
    setSaving(true);
    try {
      await hrService.createPayrollRun({ period });
      toast.success('Payroll run created for review.');
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSaving(false);
    }
  };
  const approve = async (run) => {
    try {
      await hrService.approvePayrollRun(run._id, { status: 'approved' });
      toast.success('Payroll run approved.');
      reload();
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };
  const slips = async (run) => {
    try {
      const response = await hrService.salarySlip(run._id);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `salary-slips-${run.period || period}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };
  return (
    <div className="space-y-4">
      {canManage && <Card title="Monthly payroll" description="Salary structures are configurable per employee; statutory deductions are not hard-coded.">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Payroll period"><Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} /></Field>
          <Button loading={saving} onClick={process}>Create payroll run</Button>
          <span className="text-sm text-slate-500">{employees.length} employee profile(s) linked</span>
        </div>
      </Card>}
      <Card title="Payroll runs" description="Review payroll totals before approval.">
        {runs.length ? <div className="overflow-x-auto"><table className="min-w-full text-left text-sm">
          <thead><tr className="border-b border-slate-200 text-slate-500">{['Period', 'Employees', 'Gross salary', 'Deductions', 'Net salary', 'Status', ''].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium">{label}</th>)}</tr></thead>
          <tbody>{runs.map((run) => <tr key={run._id} className="border-b border-slate-100">
            <td className="px-3 py-3">{run.period}</td><td className="px-3 py-3">{run.employeeCount ?? run.rows?.length ?? 0}</td>
            <td className="px-3 py-3">{currency(run.grossTotal)}</td><td className="px-3 py-3">{currency(run.deductionTotal)}</td>
            <td className="px-3 py-3 font-semibold">{currency(run.netTotal)}</td><td className="px-3 py-3">{humanStatus(run.status || 'draft')}</td>
            <td className="px-3 py-3"><div className="flex gap-1">{canManage && run.status !== 'approved' && <Button size="xs" onClick={() => approve(run)}>Approve</Button>}{run.status === 'approved' && <Button size="xs" variant="secondary" onClick={() => slips(run)}>Salary slips</Button>}</div></td>
          </tr>)}</tbody>
        </table></div> : <Empty>No payroll runs created yet.</Empty>}
      </Card>
      <Card title="Salary structures" description="Manage basic pay, HRA, allowances, bonuses, overtime and deductions from each employee profile." />
    </div>
  );
}

function Reports({ reports, dates, setDates, employees }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const [kind, setKind] = useState('summary');
  useEffect(() => {
    const today = new Date();
    if (kind === 'daily') {
      setDates((current) => ({ ...current, fromDate: dateOnly(today), toDate: dateOnly(today), status: '' }));
    } else if (kind === 'weekly') {
      const start = new Date(today);
      start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      setDates((current) => ({ ...current, fromDate: dateOnly(start), toDate: dateOnly(end), status: '' }));
    } else if (kind === 'monthly') {
      setDates((current) => ({
        ...current,
        fromDate: dateOnly(new Date(today.getFullYear(), today.getMonth(), 1)),
        toDate: dateOnly(new Date(today.getFullYear(), today.getMonth() + 1, 0)),
        status: '',
      }));
    } else {
      setDates((current) => current.status ? { ...current, status: '' } : current);
    }
  }, [kind, setDates]);
  const reportStatuses = kind === 'summary'
    ? []
    : kind === 'employee'
    ? ['active', 'inactive']
    : kind === 'leaves'
      ? ['pending', 'approved', 'rejected']
      : kind === 'payroll'
        ? ['pending_approval', 'approved', 'rejected']
        : ['Present', 'Late', 'Absent', 'Half Day', 'Checked In', 'Checked Out', 'Leave'];
  const downloadPdf = async () => {
    setExporting(true);
    try {
      const response = await hrService.exportReportsPdf({ ...dates, ...(kind === 'summary' ? {} : { kind }) });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gen-vyro-hr-${kind}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setExporting(false);
    }
  };
  const download = async () => {
    setExporting(true);
    try {
      const response = await hrService.exportReports({ ...dates, ...(kind === 'summary' ? {} : { kind }) });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gen-vyro-hr-${kind}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setExporting(false);
    }
  };
  return (
    <div id="hr-reports-print" className="space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        <Field label="Report"><Select value={kind} onChange={(event) => setKind(event.target.value)}>
          <option value="summary">Summary</option><option value="daily">Daily attendance</option><option value="weekly">Weekly attendance</option>
          <option value="monthly">Monthly attendance</option><option value="employee">Employee report</option><option value="late">Late arrivals</option>
          <option value="overtime">Overtime</option><option value="absence">Absences</option><option value="leaves">Leave report</option><option value="payroll">Payroll report</option>
        </Select></Field>
        <Field label="Employee"><Select value={dates.employeeId || ''} onChange={(event) => setDates((current) => ({ ...current, employeeId: event.target.value }))}><option value="">All visible employees</option>{employees.map((employee) => <option key={employee._id} value={employee._id}>{employee.name}</option>)}</Select></Field>
        <Field label="Department"><Select value={dates.department || ''} onChange={(event) => setDates((current) => ({ ...current, department: event.target.value }))}><option value="">All departments</option>{[...new Set(employees.map((employee) => employee.department).filter(Boolean))].map((department) => <option key={department}>{department}</option>)}</Select></Field>
        <Field label="Status"><Select value={dates.status || ''} onChange={(event) => setDates((current) => ({ ...current, status: event.target.value }))}><option value="">Any status</option>{reportStatuses.map((status) => <option key={status} value={status}>{humanStatus(status)}</option>)}</Select></Field>
        <Field label="From"><Input type="date" value={dates.fromDate} onChange={(event) => setDates((current) => ({ ...current, fromDate: event.target.value }))} /></Field>
        <Field label="To"><Input type="date" value={dates.toDate} onChange={(event) => setDates((current) => ({ ...current, toDate: event.target.value }))} /></Field>
        <Button variant="secondary" icon={Download} loading={exporting} onClick={download}>Export Excel</Button>
        <Button variant="secondary" icon={FileText} loading={exporting} onClick={downloadPdf}>Export PDF</Button>
      </div>
      {kind !== 'summary' && <Card title={`${humanStatus(kind)} report`}>
        <div className="overflow-x-auto">
          {kind === 'employee' && <ReportTable columns={['Employee', 'Employee ID', 'Department', 'Designation', 'Status']} rows={reports?.employees || []} values={(row) => [row.name, row.employeeId, row.department, row.designation, humanStatus(row.status)]} />}
          {['daily', 'weekly', 'monthly', 'attendance'].includes(kind) && <ReportTable columns={['Employee', 'Date', 'Check-in', 'Check-out', 'Minutes', 'Status']} rows={reports?.attendance || []} values={(row) => [row.employee?.name, prettyDate(row.date), row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString() : '—', row.checkOutTime ? new Date(row.checkOutTime).toLocaleTimeString() : '—', row.workingHoursMinutes, humanStatus(row.status)]} />}
          {kind === 'late' && <ReportTable columns={['Employee', 'Date', 'Check-in', 'Late minutes']} rows={reports?.lateAttendance || []} values={(row) => [row.employee?.name, prettyDate(row.date), row.checkInTime ? new Date(row.checkInTime).toLocaleTimeString() : '—', row.lateArrivalMinutes]} />}
          {kind === 'absence' && <ReportTable columns={['Employee', 'Date', 'Status']} rows={reports?.absenceReport || []} values={(row) => [row.employee?.name, prettyDate(row.date), humanStatus(row.status)]} />}
          {kind === 'overtime' && <ReportTable columns={['Employee', 'Date', 'Overtime minutes', 'Working minutes']} rows={reports?.overtimeReport || []} values={(row) => [row.employee?.name, prettyDate(row.date), row.overtimeMinutes, row.workingHoursMinutes]} />}
          {kind === 'leaves' && <ReportTable columns={['Employee', 'Type', 'From', 'To', 'Days', 'Status']} rows={reports?.leaves || []} values={(row) => [row.employee?.name, row.leaveType?.name, prettyDate(row.startDate), prettyDate(row.endDate), row.days, humanStatus(row.status)]} />}
          {kind === 'payroll' && <ReportTable columns={['Employee', 'Period', 'Currency', 'Gross', 'Deductions', 'Net', 'Status']} rows={reports?.payroll || []} values={(row) => [row.employee?.name, row.period, row.currency, row.grossPay, row.totalDeductions, row.netPay, humanStatus(row.status)]} />}
        </div>
      </Card>}
      <div className="grid gap-4 xl:grid-cols-2">
        <BarList title="Employees by department" rows={reports?.departmentDistribution || []} />
        <BarList title="Attendance trends" rows={reports?.attendanceTrends || []} color="bg-emerald-600" />
        <BarList title="Leave trends" rows={reports?.leaveTrends || []} color="bg-violet-600" />
        <BarList title="Payroll summary" rows={reports?.payrollSummary || []} color="bg-amber-600" />
      </div>
      <Card title="Report summary">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(reports?.summary || {}).map(([key, value]) => <div key={key} className="rounded-lg bg-slate-50 p-3"><p className="text-xs uppercase text-slate-500">{humanStatus(key)}</p><p className="mt-1 text-lg font-semibold">{typeof value === 'number' && key.toLowerCase().includes('salary') ? currency(value) : value}</p></div>)}
          {!Object.keys(reports?.summary || {}).length && <Empty>No report summary available.</Empty>}
        </div>
      </Card>
    </div>
  );
}

function ReportTable({ columns, rows, values }) {
  return rows.length ? <table className="min-w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500">{columns.map((column) => <th key={column} className="whitespace-nowrap px-3 py-3 font-medium">{column}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row._id} className="border-b border-slate-100">{values(row).map((value, index) => <td key={`${row._id}-${index}`} className="whitespace-nowrap px-3 py-3">{value ?? '—'}</td>)}</tr>)}</tbody></table> : <Empty>No rows in this date range.</Empty>;
}

export default function HRModule() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const now = new Date();
  const [reportDates, setReportDates] = useState({
    fromDate: dateOnly(new Date(now.getFullYear(), now.getMonth(), 1)),
    toDate: dateOnly(now),
  });
  const section = useMemo(
    () => sections.find(([, route, , , permission]) => location.pathname === route && hasPermission(permission)) || sections[0],
    [location.pathname, hasPermission]
  );
  useEffect(() => {
    if (location.pathname.startsWith('/hr/') && !sections.some(([, route]) => route === location.pathname)) {
      navigate('/hr/dashboard', { replace: true });
    }
  }, [location.pathname, navigate]);
  const dashboard = useFetch(hrService.dashboard, [], { enabled: hasPermission('hr.dashboard.view') });
  const notificationQuery = useFetch(hrService.notifications, [], { enabled: hasPermission('hr.dashboard.view') });
  const employeeQuery = useFetch(() => hrService.employees({}), [], { enabled: hasPermission('hr.employees.view') });
  const departmentQuery = useFetch(() => hrService.departments({}), [], { enabled: hasPermission('hr.employees.view') });
  const leaveQuery = useFetch(() => hrService.leaves({}), [], { enabled: hasPermission('hr.leaves.view') });
  const payrollQuery = useFetch(() => hrService.payroll({}), [], { enabled: hasPermission('hr.payroll.view') });
  const reportsQuery = useFetch(() => hrService.reports(reportDates), [reportDates], { enabled: hasPermission('hr.reports.view') });
  const employees = employeeQuery.data?.users || employeeQuery.data?.employees || [];
  const departments = departmentQuery.data?.departments || [];
  const requests = leaveQuery.data?.requests || leaveQuery.data?.leaves || [];
  const runs = payrollQuery.data?.runs || payrollQuery.data?.payrollRuns || [];
  const metrics = dashboard.data?.metrics || {};
  const reportData = reportsQuery.data || {};
  const reloadAll = () => {
    dashboard.reload(); notificationQuery.reload(); employeeQuery.reload(); departmentQuery.reload();
    leaveQuery.reload(); payrollQuery.reload(); reportsQuery.reload();
  };
  const errors = [dashboard, notificationQuery, employeeQuery, departmentQuery, leaveQuery, payrollQuery, reportsQuery].filter((query) => query.error);
  const canEditEmployee = hasPermission('hr.employees.edit');
  const canManageDepartments = hasPermission('hr.departments.manage');
  const canApplyLeave = hasPermission('hr.leaves.apply');
  const canApproveLeave = hasPermission('hr.leaves.approve');
  const canManagePayroll = hasPermission('hr.payroll.manage');
  const title = section[2];

  const exportEmployees = async () => {
    try {
      const response = await hrService.exportReports({ kind: 'employees' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'gen-vyro-employees.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(parseError(error).message);
    }
  };

  return (
    <>
      <PageHeader
        title="HR & Workforce"
        description="Employee profiles, attendance, leave and configurable payroll—connected to your existing Gen Vyro users."
        actions={section[0] === 'employees' ? (
          <div className="flex flex-wrap gap-2">
            {hasPermission('users.create') && <Button variant="primary" icon={Plus} onClick={() => navigate('/settings/access')}>Add through User Management</Button>}
            {hasPermission('hr.reports.view') && <Button variant="secondary" icon={Download} onClick={exportEmployees}>Export Employees</Button>}
          </div>
        ) : null}
      />
      <div className="mb-5 flex flex-wrap gap-2">
        {sections.filter((item) => hasPermission(item[4])).map(([key, route, label, Icon]) => (
          <Button key={key} size="sm" variant={section[0] === key ? 'primary' : 'secondary'} onClick={() => navigate(route)} icon={Icon}>{label}</Button>
        ))}
      </div>
      {errors.map((query, index) => <div key={index} role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{query.error.message || 'Unable to load HR data.'}</div>)}
      {section[0] === 'dashboard' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric title="Total Employees" value={metrics.totalEmployees} icon={Users} />
            <Metric title="Active Employees" value={metrics.activeEmployees} icon={BriefcaseBusiness} tone="green" />
            <Metric title="Inactive Employees" value={metrics.inactiveEmployees} icon={Users} tone="navy" />
            <Metric title="Present Today" value={metrics.presentToday} icon={CalendarCheck} tone="green" />
            <Metric title="Absent Today" value={metrics.absentToday} icon={Clock3} tone="rose" />
            <Metric title="On Leave" value={metrics.onLeave} icon={CalendarDays} tone="violet" />
            <Metric title="Late Employees" value={metrics.lateToday} icon={Clock3} tone="amber" />
            <Metric title="New Employees" value={metrics.newEmployees} icon={Users} tone="sky" />
            <Metric title="Pending Leave" value={metrics.pendingLeaves} icon={CalendarDays} tone="amber" />
            <Metric title="Monthly Payroll" value={currency(metrics.monthlyPayroll)} icon={Wallet} tone="violet" />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <BarList title="Employee growth" rows={dashboard.data?.charts?.employeeGrowth || []} />
            <BarList title="Department distribution" rows={dashboard.data?.charts?.departmentDistribution || []} color="bg-violet-600" />
            <BarList title="Attendance trends" rows={dashboard.data?.charts?.attendanceTrends || []} color="bg-emerald-600" />
            <BarList title="Leave trends" rows={dashboard.data?.charts?.leaveTrends || []} color="bg-amber-600" />
            {hasPermission('hr.payroll.view') && (
              <BarList title="Payroll summary" rows={dashboard.data?.charts?.payrollSummary || []} color="bg-rose-600" />
            )}
          </div>
          <Card title="Quick links">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" onClick={() => navigate('/hr/employees')}>Employee profiles <ArrowRight className="ml-1 h-4 w-4" /></Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/attendance')}>Existing attendance <ArrowRight className="ml-1 h-4 w-4" /></Button>
              <Button size="sm" variant="secondary" onClick={() => navigate('/hr/leaves')}>Leave requests <ArrowRight className="ml-1 h-4 w-4" /></Button>
            </div>
          </Card>
          <Card title="HR notifications" description="Private notifications for leave decisions and payroll approvals.">
            {(notificationQuery.data?.notifications || []).length ? <div className="space-y-2">
              {notificationQuery.data.notifications.map((notification) => <div key={notification._id} className={`flex items-start justify-between gap-3 rounded-lg border p-3 ${notification.readAt ? 'border-slate-100 bg-white' : 'border-sky-100 bg-sky-50'}`}>
                <div className="flex gap-2"><Bell className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" /><div><p className="text-sm text-slate-800">{notification.message}</p><p className="mt-1 text-xs text-slate-500">{prettyDate(notification.createdAt)}</p></div></div>
                {!notification.readAt && <Button size="xs" variant="secondary" onClick={async () => { try { await hrService.markNotificationRead(notification._id); notificationQuery.reload(); } catch (error) { toast.error(parseError(error).message); } }}>Mark read</Button>}
              </div>)}
            </div> : <Empty>No HR notifications yet.</Empty>}
          </Card>
        </div>
      )}
      {section[0] === 'employees' && <Employees employees={employees} departments={departments} reload={reloadAll} canEdit={canEditEmployee} />}
      {section[0] === 'departments' && <Departments departments={departments} employees={employees} reload={reloadAll} canEdit={canManageDepartments} />}
      {section[0] === 'attendance' && (
        <Card title="Existing Attendance module" description="HR uses the existing attendance records and check-in / check-out system. No duplicate attendance data store is created.">
          <p className="text-sm text-slate-600">Attendance history, corrections, office-time rules, calendar and check-in/out stay in the existing module.</p>
          <Button className="mt-4" onClick={() => navigate('/attendance')}>Open Attendance</Button>
        </Card>
      )}
      {section[0] === 'leaves' && <Leaves requests={requests} balances={leaveQuery.data?.balances || []} types={leaveQuery.data?.types || []} employees={employees} reload={reloadAll} canApprove={canApproveLeave} canApply={canApplyLeave} />}
      {section[0] === 'payroll' && <Payroll runs={runs} employees={employees} reload={reloadAll} canManage={canManagePayroll} />}
      {section[0] === 'reports' && <Reports reports={reportData} dates={reportDates} setDates={setReportDates} employees={employees} />}
      <span className="sr-only">{title}</span>
    </>
  );
}
