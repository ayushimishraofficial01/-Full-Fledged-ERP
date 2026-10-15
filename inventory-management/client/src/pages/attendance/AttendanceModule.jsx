import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  BriefcaseBusiness,
  CalendarClock,
  Camera,
  CheckCheck,
  Clock3,
  Download,
  FileText,
  LocateFixed,
  MapPin,
  Pencil,
  Plus,
  Search,
  Settings2,
  UserCheck,
  Users,
} from 'lucide-react';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { attendanceService } from '../../services';
import { Button, Card, Field, Input, Modal, PageHeader, Select } from '../../components/ui';
import { parseError } from '../../services/api';

const tabRoutes = {
  dashboard: '/attendance',
  my: '/attendance/my',
  employees: '/attendance/employees',
  calendar: '/attendance/calendar',
  reports: '/attendance/reports',
  settings: '/attendance/settings',
};

const statusColors = {
  Present: 'bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200',
  Late: 'bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200',
  Absent: 'bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200',
  'Checked In': 'bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200',
  'Checked Out': 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200',
  'Half Day': 'bg-violet-50 text-violet-800 ring-1 ring-inset ring-violet-200',
  Leave: 'bg-indigo-50 text-indigo-800 ring-1 ring-inset ring-indigo-200',
};

function formatMinutesToHours(minutes = 0) {
  const safe = Number(minutes) || 0;
  const hrs = Math.floor(safe / 60);
  const mins = safe % 60;
  return `${hrs}h ${mins}m`;
}

function formatClock(value) {
  if (!value) return '--:--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatOfficeTime(value) {
  if (!value || !/^\d{2}:\d{2}$/.test(value)) return value || '—';
  const [hours, minutes] = value.split(':').map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function dateInputValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function timeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function attendanceFormFor(record = {}) {
  return {
    employee: record.employee?._id || record.employee || '',
    date: record.date ? dateInputValue(new Date(record.date)) : dateInputValue(new Date()),
    checkInTime: timeInputValue(record.checkInTime),
    checkOutTime: timeInputValue(record.checkOutTime),
    status: record.status || 'Present',
    correctionReason: '',
  };
}

function normalizeStatus(value) {
  return value || 'Absent';
}

function MetricCard({ label, value, accent, icon: Icon }) {
  const accentClasses = {
    navy: 'from-sky-500/20 to-blue-600/10 text-sky-300',
    teal: 'from-emerald-500/20 to-emerald-600/10 text-emerald-300',
    amber: 'from-amber-500/20 to-orange-600/10 text-amber-300',
    violet: 'from-violet-500/20 to-fuchsia-600/10 text-violet-300',
    rose: 'from-rose-500/20 to-pink-600/10 text-rose-300',
    slate: 'from-slate-500/20 to-slate-600/10 text-slate-200',
  };

  return (
    <div className="rounded-2xl border border-navy-700/70 bg-gradient-to-br from-navy-900 to-slate-900 p-4 shadow-md">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className={`rounded-xl bg-gradient-to-br p-2 ${accentClasses[accent] || accentClasses.navy}`}>
          <Icon className="h-5 w-5" strokeWidth={1.8} />
        </div>
      </div>
      <p className="text-sm text-slate-300">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <span className="text-2xl font-semibold text-white">{value}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const palette = statusColors[status] || 'bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200';
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${palette}`}>{status}</span>;
}

export default function AttendanceModule() {
  const { user, hasPermission } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const role = user?.role || 'employee';
  const [notice, setNotice] = useState('');
  const [settingsForm, setSettingsForm] = useState({
    officeStartTime: '09:30',
    officeEndTime: '18:30',
    gracePeriod: 15,
    halfDayThresholdMinutes: 240,
    overtimeThresholdMinutes: 540,
    missingCheckoutReminderEnabled: true,
    missingCheckoutReminderMinutes: 60,
    workDays: [1, 2, 3, 4, 5],
    holidays: [],
  });
  const [holidayDraft, setHolidayDraft] = useState({ date: '', name: '' });
  const todayInput = dateInputValue(new Date());
  const [reportDates, setReportDates] = useState({ fromDate: todayInput, toDate: todayInput });
  const [myRange, setMyRange] = useState('today');
  const [myDates, setMyDates] = useState({ fromDate: todayInput, toDate: todayInput });
  const [attendanceFilters, setAttendanceFilters] = useState({
    search: '',
    department: '',
    status: '',
    fromDate: '',
    toDate: '',
  });
  const [attendanceModal, setAttendanceModal] = useState(null);
  const [attendanceForm, setAttendanceForm] = useState(attendanceFormFor());
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [exportingReport, setExportingReport] = useState(false);
  const [liveLocationLabel, setLiveLocationLabel] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const cameraVideo = useRef(null);
  const photoInputRef = useRef(null);

  const activeTab = useMemo(() => {
    const match = Object.entries(tabRoutes)
      .filter(([, route]) => location.pathname === route || location.pathname.startsWith(`${route}/`))
      .sort(([, a], [, b]) => b.length - a.length)[0];
    return match ? match[0] : 'dashboard';
  }, [location.pathname]);

  const dashboardQuery = useFetch(attendanceService.dashboard, []);
  const myQuery = useFetch(() => attendanceService.my({
    startDate: myDates.fromDate,
    endDate: myDates.toDate,
  }), [myDates.fromDate, myDates.toDate]);
  const employeesQuery = useFetch(() => attendanceService.employees({}), []);
  const attendanceRecordsQuery = useFetch(() => attendanceService.employees({
    department: attendanceFilters.department,
    status: attendanceFilters.status,
    fromDate: attendanceFilters.fromDate,
    toDate: attendanceFilters.toDate,
  }), [attendanceFilters.department, attendanceFilters.status, attendanceFilters.fromDate, attendanceFilters.toDate]);
  const calendarQuery = useFetch(() => attendanceService.calendar({ month: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01` }), []);
  const reportsQuery = useFetch(() => attendanceService.reports(reportDates), [reportDates.fromDate, reportDates.toDate]);
  const settingsQuery = useFetch(attendanceService.settings, []);

  const todaysRows = dashboardQuery.data?.rows || [];
  const dashboardTotals = dashboardQuery.data?.totals || {};
  const myRows = myQuery.data?.rows || [];
  const employeeUsers = employeesQuery.data?.users || [];
  const attendanceRows = attendanceRecordsQuery.data?.rows || [];
  const filteredAttendanceRows = attendanceRows.filter((row) => {
    const search = attendanceFilters.search.trim().toLowerCase();
    if (!search) return true;
    return `${row.employee?.name || row.employeeName || ''} ${row.employeeId || ''} ${row.department || ''}`.toLowerCase().includes(search);
  });
  const reportSummary = reportsQuery.data?.summary || {};
  const canEditAttendance = hasPermission('hr.attendance.edit');

  useEffect(() => {
    const nextRules = settingsQuery.data?.rules;
    if (!nextRules?.officeStartTime) return;
    const isDefault = (
      settingsForm.officeStartTime === '09:30'
      && settingsForm.officeEndTime === '18:30'
      && Number(settingsForm.gracePeriod) === 15
      && Number(settingsForm.halfDayThresholdMinutes) === 240
      && Number(settingsForm.overtimeThresholdMinutes) === 540
      && settingsForm.missingCheckoutReminderEnabled === true
      && Number(settingsForm.missingCheckoutReminderMinutes) === 60
      && JSON.stringify(settingsForm.workDays) === JSON.stringify([1, 2, 3, 4, 5])
      && settingsForm.holidays.length === 0
    );

    if (isDefault) {
      setSettingsForm({
        officeStartTime: nextRules.officeStartTime,
        officeEndTime: nextRules.officeEndTime,
        gracePeriod: Number(nextRules.gracePeriod || 15),
        halfDayThresholdMinutes: Number(nextRules.halfDayThresholdMinutes || 240),
        overtimeThresholdMinutes: Number(nextRules.overtimeThresholdMinutes || 540),
        missingCheckoutReminderEnabled: nextRules.missingCheckoutReminderEnabled !== false,
        missingCheckoutReminderMinutes: Number(nextRules.missingCheckoutReminderMinutes ?? 60),
        workDays: Array.isArray(nextRules.workDays) && nextRules.workDays.length ? nextRules.workDays : [1, 2, 3, 4, 5],
        holidays: Array.isArray(nextRules.holidays) ? nextRules.holidays : [],
      });
    }
  }, [settingsQuery.data]);

  const monthDays = useMemo(() => {
    const month = new Date();
    const start = new Date(month.getFullYear(), month.getMonth(), 1);
    const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    const days = [];
    const startIndex = (start.getDay() + 6) % 7;

    for (let i = 0; i < startIndex; i += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), i - startIndex + 1);
      days.push({ date, isCurrentMonth: false });
    }
    for (let d = 1; d <= end.getDate(); d += 1) {
      days.push({ date: new Date(month.getFullYear(), month.getMonth(), d), isCurrentMonth: true });
    }
    while (days.length < 35) {
      const nextDay = days.length - (end.getDate() + startIndex) + 1;
      days.push({ date: new Date(month.getFullYear(), month.getMonth() + 1, nextDay), isCurrentMonth: false });
    }
    return days;
  }, []);

  useEffect(() => {
    if (!photo) {
      setPhotoPreview('');
      return undefined;
    }
    const previewUrl = URL.createObjectURL(photo);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photo]);

  useEffect(() => {
    if (!cameraOpen || !cameraStream || !cameraVideo.current) return undefined;
    const video = cameraVideo.current;
    video.srcObject = cameraStream;
    video.play().catch(() => toast.error('Unable to start the live camera preview.'));
    return () => {
      cameraStream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [cameraOpen, cameraStream, toast]);

  async function captureLiveLocation() {
    if (!navigator.geolocation) {
      toast.error('This browser does not support live location capture.');
      return;
    }
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, (error) => reject(new Error(error.message || 'Unable to get the current location.')), {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });
      const { latitude, longitude } = position.coords;
      setLiveLocationLabel(`${Number(latitude).toFixed(6)}, ${Number(longitude).toFixed(6)}`);
      toast.success('Live location captured successfully.');
    } catch (error) {
      toast.error(error.message || 'Unable to get the current location.');
    }
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Direct camera access is unavailable in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: 'environment' } },
      });
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (error) {
      toast.error(error.name === 'NotAllowedError'
        ? 'Allow camera access and tap “Open camera” again.'
        : 'Could not open the camera. Check that a camera is available and not being used elsewhere.');
    }
  }

  function closeCamera() {
    cameraStream?.getTracks().forEach((track) => track.stop());
    setCameraStream(null);
    setCameraOpen(false);
  }

  async function capturePhoto() {
    const video = cameraVideo.current;
    if (!video?.videoWidth || !video.videoHeight) {
      toast.error('The camera is still warming up. Please wait a moment and try again.');
      return;
    }
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1600 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      let quality = 0.84;
      let blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      while (blob && blob.size > 1_800_000 && quality > 0.48) {
        quality -= 0.1;
        blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
      }
      if (!blob || blob.size > 2 * 1024 * 1024) {
        toast.error('The captured photo is too large to use. Please retake it.');
        return;
      }
      setPhoto(new File([blob], `attendance-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      closeCamera();
    } catch {
      toast.error('Could not capture the camera image. Please try again.');
    }
  }

  function handlePhotoSelection(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose a valid image file for the attendance proof.');
      event.target.value = '';
      return;
    }
    setPhoto(file);
    event.target.value = '';
  }

  const handleCheckAction = async (type) => {
    if (!liveLocationLabel) {
      toast.error('Capture the current live location before checking in or out.');
      return;
    }
    if (!photo) {
      toast.error(type === 'in'
        ? 'Capture a fresh selfie or proof photo before check-in.'
        : 'Capture a fresh proof photo before check-out.');
      return;
    }

    setLoadingAction(true);
    setNotice('');
    try {
      const response = type === 'in'
        ? await attendanceService.checkIn({
          location: liveLocationLabel,
          deviceInfo: navigator.userAgent || '',
          ipAddress: '',
        }, photo)
        : await attendanceService.checkOut({
          location: liveLocationLabel,
          deviceInfo: navigator.userAgent || '',
          ipAddress: '',
        }, photo);
      setNotice(response.message || 'Attendance updated successfully.');
      setLiveLocationLabel('');
      setPhoto(null);
      dashboardQuery.reload();
      myQuery.reload();
      employeesQuery.reload();
      reportsQuery.reload();
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Unable to update attendance right now.');
    } finally {
      setLoadingAction(false);
    }
  };

  const openAttendanceModal = (mode, record = null) => {
    setAttendanceForm(attendanceFormFor(record || {}));
    setAttendanceModal({ mode, record });
  };

  const setMyPeriod = (period) => {
    setMyRange(period);
    const today = new Date();
    let from = today;
    if (period === 'week') {
      from = new Date(today);
      from.setDate(today.getDate() - ((today.getDay() + 6) % 7));
    } else if (period === 'month') {
      from = new Date(today.getFullYear(), today.getMonth(), 1);
    }
    if (period !== 'custom') {
      setMyDates({ fromDate: dateInputValue(from), toDate: dateInputValue(today) });
    }
  };

  const saveAttendance = async (event) => {
    event.preventDefault();
    setSavingAttendance(true);
    try {
      const payload = {
        ...attendanceForm,
        date: attendanceForm.date,
        checkInTime: attendanceForm.checkInTime ? new Date(`${attendanceForm.date}T${attendanceForm.checkInTime}`).toISOString() : null,
        checkOutTime: attendanceForm.checkOutTime ? new Date(`${attendanceForm.date}T${attendanceForm.checkOutTime}`).toISOString() : null,
      };
      const response = attendanceModal.mode === 'edit'
        ? await attendanceService.update(attendanceModal.record._id, payload)
        : await attendanceService.manual(payload);
      toast.success(response.message || 'Attendance saved.');
      setAttendanceModal(null);
      dashboardQuery.reload();
      myQuery.reload();
      employeesQuery.reload();
      reportsQuery.reload();
      calendarQuery.reload();
    } catch (error) {
      toast.error(parseError(error).message);
    } finally {
      setSavingAttendance(false);
    }
  };

  const saveSettings = async () => {
    setSavingSettings(true);
    setNotice('');
    try {
      const response = await attendanceService.updateSettings(settingsForm);
      setNotice(response.message || 'Attendance rules saved.');
      settingsQuery.reload();
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Unable to save attendance rules.');
    } finally {
      setSavingSettings(false);
    }
  };

  const exportAttendanceReport = async (format) => {
    setExportingReport(true);
    try {
      const response = await attendanceService.exportReports({ ...reportDates, format });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `gen-vyro-attendance-report.${format === 'pdf' ? 'pdf' : 'xlsx'}`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      setNotice(error?.response?.data?.message || 'Unable to export attendance report.');
    } finally {
      setExportingReport(false);
    }
  };

  return (
    <div className="attendance-module">
      <PageHeader
        title="Attendance"
        description="Track daily attendance, enforce check-in rules, and monitor team productivity across the business."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="success" onClick={() => handleCheckAction('in')} loading={loadingAction} icon={CheckCheck}>Check In</Button>
            <Button variant="secondary" onClick={() => handleCheckAction('out')} loading={loadingAction} icon={Clock3}>Check Out</Button>
          </div>
        }
      />

      <Card className="mb-4 border-sky-200 bg-sky-50/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Live attendance proof</p>
            <h2 className="mt-1 text-base font-semibold text-slate-900">Capture the current location and a quick proof photo.</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" icon={MapPin} onClick={captureLiveLocation}>Use live location</Button>
            <Button variant="secondary" icon={Camera} onClick={openCamera}>Open camera</Button>
            <Button variant="secondary" icon={FileText} onClick={() => photoInputRef.current?.click()}>Upload proof</Button>
            <input ref={photoInputRef} type="file" accept="image/*" capture="environment" onChange={handlePhotoSelection} className="hidden" />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-xl border border-sky-200 bg-white/80 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <LocateFixed className="h-4 w-4 text-sky-700" />
              Current location
            </div>
            <p className="mt-2 text-sm text-slate-600">{liveLocationLabel || 'No location captured yet. Tap “Use live location” to record the current GPS coordinates.'}</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white/80 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Camera className="h-4 w-4 text-sky-700" />
              Proof photo
            </div>
            <p className="mt-2 text-sm text-slate-600">{photo ? 'Fresh proof photo is ready.' : 'No proof photo captured yet.'}</p>
          </div>
        </div>

        {photoPreview ? (
          <div className="mt-4 overflow-hidden rounded-xl border border-sky-200 bg-white p-2">
            <img src={photoPreview} alt="Attendance proof" className="h-52 w-full rounded-lg object-cover" />
            <div className="mt-2 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setPhoto(null)}>Remove photo</Button>
            </div>
          </div>
        ) : null}

        {cameraOpen ? (
          <div className="mt-4 rounded-xl border border-sky-200 bg-white p-3">
            <video ref={cameraVideo} autoPlay muted playsInline className="h-64 w-full rounded-lg bg-slate-950 object-cover" />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button onClick={capturePhoto}>Capture proof photo</Button>
              <Button variant="secondary" onClick={closeCamera}>Cancel</Button>
            </div>
          </div>
        ) : null}
      </Card>

      <nav aria-label="Attendance sections" className="mb-4 flex flex-wrap gap-2">
        {Object.entries(tabRoutes).map(([key, route]) => (
          <NavLink
            key={key}
            to={route}
            end
            aria-current={activeTab === key ? 'page' : undefined}
            className={({ isActive }) => [
              'inline-flex h-9 shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg border px-3.5 text-base font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500',
              isActive
                ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
                : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
            ].join(' ')}
          >
            {key === 'dashboard' ? 'Dashboard' : key === 'my' ? 'My Attendance' : key === 'employees' ? 'Employees' : key === 'calendar' ? 'Calendar' : key === 'reports' ? 'Reports' : 'Settings'}
          </NavLink>
        ))}
      </nav>

      {notice ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          <AlertCircle className="h-4 w-4" />
          {notice}
        </div>
      ) : null}

      {activeTab === 'dashboard' && (
        <>
          {canEditAttendance && (
            <div className="mb-4 flex justify-end">
              <Button variant="secondary" icon={Plus} onClick={() => openAttendanceModal('manual')}>Add Attendance</Button>
            </div>
          )}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard label="Total Employees" value={dashboardTotals.totalEmployees ?? 0} accent="navy" icon={Users} />
            <MetricCard label="Present Today" value={dashboardTotals.presentToday ?? 0} accent="teal" icon={UserCheck} />
            <MetricCard label="Checked In" value={dashboardTotals.checkedIn ?? 0} accent="slate" icon={CheckCheck} />
            <MetricCard label="Checked Out" value={dashboardTotals.checkedOut ?? 0} accent="violet" icon={Clock3} />
            <MetricCard label="Late Employees" value={dashboardTotals.lateEmployees ?? 0} accent="amber" icon={CalendarClock} />
            <MetricCard label="Absent Employees" value={dashboardTotals.absentEmployees ?? 0} accent="rose" icon={BriefcaseBusiness} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <Card title="Today's attendance" description="Live attendance summary for today">
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-base">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-3 pr-4 font-medium">Employee</th>
                      <th className="pb-3 pr-4 font-medium">Date</th>
                      <th className="pb-3 pr-4 font-medium">Check-in</th>
                      <th className="pb-3 pr-4 font-medium">Check-out</th>
                      <th className="pb-3 pr-4 font-medium">Working Hours</th>
                      <th className="pb-3 pr-4 font-medium">Status</th>
                      <th className="pb-3 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todaysRows.length ? todaysRows.map((row) => (
                      <tr key={row._id} className="border-b border-slate-100 align-middle">
                        <td className="py-3 pr-4">
                          <div>
                            <p className="font-medium text-slate-900">{row.employee?.name || row.employeeName || 'Employee'}</p>
                            <p className="text-xs text-slate-500">{row.employeeId || row.employee?.employeeId || '—'}</p>
                          </div>
                        </td>
                        <td className="py-3 pr-4 text-slate-700">{formatDate(row.date)}</td>
                        <td className="py-3 pr-4 text-slate-700">{formatClock(row.checkInTime)}</td>
                        <td className="py-3 pr-4 text-slate-700">{formatClock(row.checkOutTime)}</td>
                        <td className="py-3 pr-4 text-slate-700">{formatMinutesToHours(row.workingHoursMinutes || 0)}</td>
                        <td className="py-3 pr-4"><StatusBadge status={normalizeStatus(row.status)} /></td>
                        <td className="py-3">{canEditAttendance && <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openAttendanceModal('edit', row)}>Edit</Button>}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="7" className="py-8 text-center text-slate-500">No attendance records for today yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card title="Attendance snapshot" description="Operational overview">
              <div className="space-y-4">
                <div className="rounded-xl border border-navy-700 bg-navy-900 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Average Working Hours</p>
                  <p className="mt-3 text-3xl font-semibold text-white">{formatMinutesToHours(Math.round((dashboardTotals.averageWorkingHours || 0) * 60))}</p>
                </div>
                <div className="rounded-xl border border-navy-700 bg-navy-900 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-300">Office Rules</p>
                  <ul className="mt-3 space-y-2 text-sm text-slate-200">
                    <li>Start: {formatOfficeTime(settingsQuery.data?.rules?.officeStartTime || dashboardQuery.data?.settings?.officeStartTime || '09:30')}</li>
                    <li>End: {formatOfficeTime(settingsQuery.data?.rules?.officeEndTime || dashboardQuery.data?.settings?.officeEndTime || '18:30')}</li>
                    <li>Grace: {settingsQuery.data?.rules?.gracePeriod ?? dashboardQuery.data?.settings?.gracePeriod ?? 15} minutes</li>
                    <li>Half day: {formatMinutesToHours(settingsQuery.data?.rules?.halfDayThresholdMinutes ?? dashboardQuery.data?.settings?.halfDayThresholdMinutes ?? 240)}</li>
                  </ul>
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {activeTab === 'my' && (
        <Card title="My attendance" description="Your daily attendance and working-time history">
          {myQuery.error && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{myQuery.error.message}</p>}
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <Field label="Period">
              <Select value={myRange} onChange={(event) => setMyPeriod(event.target.value)}>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
                <option value="custom">Custom Date Range</option>
              </Select>
            </Field>
            {myRange === 'custom' && <>
              <Field label="From"><Input type="date" value={myDates.fromDate} onChange={(event) => setMyDates((current) => ({ ...current, fromDate: event.target.value }))} /></Field>
              <Field label="To"><Input type="date" value={myDates.toDate} onChange={(event) => setMyDates((current) => ({ ...current, toDate: event.target.value }))} /></Field>
            </>}
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <MetricCard label="Present Days" value={myRows.filter((row) => ['Present', 'Late'].includes(normalizeStatus(row.status))).length} accent="teal" icon={UserCheck} />
            <MetricCard label="Late Days" value={myRows.filter((row) => normalizeStatus(row.status) === 'Late').length} accent="amber" icon={CalendarClock} />
            <MetricCard label="Total Working Hours" value={formatMinutesToHours(myRows.reduce((sum, row) => sum + (Number(row.workingHoursMinutes) || 0), 0))} accent="violet" icon={Clock3} />
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-base">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="pb-3 pr-4 font-medium">Date</th>
                  <th className="pb-3 pr-4 font-medium">Check-in</th>
                  <th className="pb-3 pr-4 font-medium">Check-out</th>
                  <th className="pb-3 pr-4 font-medium">Work hours</th>
                  <th className="pb-3 pr-4 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {myRows.length ? myRows.map((row) => (
                  <tr key={row._id} className="border-b border-slate-100">
                    <td className="py-3 pr-4 text-slate-700">{formatDate(row.date)}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatClock(row.checkInTime)}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatClock(row.checkOutTime)}</td>
                    <td className="py-3 pr-4 text-slate-700">{formatMinutesToHours(row.workingHoursMinutes || 0)}</td>
                    <td className="py-3 pr-4"><StatusBadge status={normalizeStatus(row.status)} /></td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan="5" className="py-8 text-center text-slate-500">No attendance history available yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {activeTab === 'employees' && (
        <>
          <Card title="Employee attendance" description="Search and filter attendance history by employee, department, status, and date range.">
            {attendanceRecordsQuery.error && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{attendanceRecordsQuery.error.message}</p>}
            <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Field label="Search employee">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="pl-9" value={attendanceFilters.search} onChange={(event) => setAttendanceFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Name, employee ID, department" />
                </div>
              </Field>
              <Field label="Department">
                <Select value={attendanceFilters.department} onChange={(event) => setAttendanceFilters((current) => ({ ...current, department: event.target.value }))}>
                  <option value="">All departments</option>
                  {[...new Set(employeeUsers.map((employee) => employee.department || 'General'))].sort().map((department) => <option key={department} value={department}>{department}</option>)}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={attendanceFilters.status} onChange={(event) => setAttendanceFilters((current) => ({ ...current, status: event.target.value }))}>
                  <option value="">All statuses</option>
                  {['Present', 'Late', 'Absent', 'Checked In', 'Checked Out', 'Half Day', 'Leave'].map((status) => <option key={status} value={status}>{status}</option>)}
                </Select>
              </Field>
              <Field label="From date"><Input type="date" value={attendanceFilters.fromDate} onChange={(event) => setAttendanceFilters((current) => ({ ...current, fromDate: event.target.value }))} /></Field>
              <Field label="To date"><Input type="date" value={attendanceFilters.toDate} onChange={(event) => setAttendanceFilters((current) => ({ ...current, toDate: event.target.value }))} /></Field>
            </div>
            {canEditAttendance && <div className="mb-4 flex justify-end"><Button variant="secondary" icon={Plus} onClick={() => openAttendanceModal('manual')}>Add Attendance</Button></div>}
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-base">
                <thead><tr className="border-b border-slate-200 text-slate-500">
                  {['Employee', 'Department', 'Date', 'Check-in', 'Check-out', 'Working hours', 'Status', 'Action'].map((heading) => <th key={heading} className="whitespace-nowrap py-3 pr-4 font-medium">{heading}</th>)}
                </tr></thead>
                <tbody>
                  {filteredAttendanceRows.length ? filteredAttendanceRows.map((row) => (
                    <tr key={row._id} className="border-b border-slate-100">
                      <td className="py-3 pr-4"><p className="font-medium text-slate-900">{row.employee?.name || row.employeeName}</p><p className="text-xs text-slate-500">{row.employeeId || '—'}</p></td>
                      <td className="py-3 pr-4 text-slate-700">{row.department || 'General'}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-slate-700">{formatDate(row.date)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-slate-700">{formatClock(row.checkInTime)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-slate-700">{formatClock(row.checkOutTime)}</td>
                      <td className="whitespace-nowrap py-3 pr-4 text-slate-700">{formatMinutesToHours(row.workingHoursMinutes || 0)}</td>
                      <td className="py-3 pr-4"><StatusBadge status={normalizeStatus(row.status)} /></td>
                      <td className="py-3">{canEditAttendance && <Button variant="secondary" size="xs" icon={Pencil} onClick={() => openAttendanceModal('edit', row)}>Edit</Button>}</td>
                    </tr>
                  )) : <tr><td colSpan="8" className="py-8 text-center text-slate-500">No attendance records match these filters.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
          <Card title="Employees" description="Directory view of each employee's latest attendance state" className="mt-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {employeeUsers.length ? employeeUsers.map((employee) => (
                <div key={employee._id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{employee.name}</p>
                      <p className="text-xs text-slate-500">{employee.department || 'General'} • {employee.employeeId || '—'}</p>
                    </div>
                    <StatusBadge status={normalizeStatus(employee.status)} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-slate-700">
                    <div className="rounded-xl border border-slate-200 bg-white p-2"><span className="text-slate-500">Check-in</span><p className="mt-1 font-medium text-slate-900">{formatClock(employee.checkInTime)}</p></div>
                    <div className="rounded-xl border border-slate-200 bg-white p-2"><span className="text-slate-500">Hours</span><p className="mt-1 font-medium text-slate-900">{formatMinutesToHours(employee.workingHoursMinutes || 0)}</p></div>
                  </div>
                </div>
              )) : <div className="col-span-full py-10 text-center text-slate-500">No employees available.</div>}
            </div>
          </Card>
        </>
      )}

      {activeTab === 'calendar' && (
        <Card title="Attendance calendar" description="Monthly attendance pattern by date">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="py-2">{day}</div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {monthDays.map(({ date, isCurrentMonth }, index) => {
              const label = date.getDate();
              const dateKey = date.toISOString().slice(0, 10);
              const isToday = dateKey === new Date().toISOString().slice(0, 10);
              const record = (calendarQuery.data?.days || []).find((day) => day.date && new Date(day.date).toISOString().slice(0, 10) === dateKey);
              const status = normalizeStatus(record?.status || 'Absent');
              return (
                <button
                  key={`${dateKey}-${index}`}
                  type="button"
                  className={`min-h-[76px] rounded-xl border p-2 text-left text-slate-700 transition-colors hover:border-brand-300 hover:bg-brand-50 ${isCurrentMonth ? 'border-slate-200 bg-white' : 'border-slate-100 bg-slate-50 text-slate-400'} ${isToday ? 'ring-1 ring-brand-500/70' : ''}`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span>{label}</span>
                    {record ? <span className={`h-2.5 w-2.5 rounded-full ${status === 'Present' ? 'bg-emerald-400' : status === 'Late' ? 'bg-amber-400' : status === 'Half Day' ? 'bg-violet-400' : 'bg-rose-400'}`} /> : null}
                  </div>
                  {record ? (
                    <div className="mt-4 flex items-center justify-between gap-2">
                      <StatusBadge status={status} />
                    </div>
                  ) : (
                    <div className="mt-4 text-[11px] text-slate-500">No log</div>
                  )}
                </button>
              );
            })}
          </div>
        </Card>
      )}

      {activeTab === 'reports' && (
        <Card title="Attendance reports" description="Daily and team-level attendance summary">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="text-sm text-slate-700">From<input type="date" value={reportDates.fromDate} onChange={(event) => setReportDates((current) => ({ ...current, fromDate: event.target.value }))} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" /></label>
            <label className="text-sm text-slate-700">To<input type="date" value={reportDates.toDate} onChange={(event) => setReportDates((current) => ({ ...current, toDate: event.target.value }))} className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" /></label>
          </div>
          <div className="mb-4 grid gap-3 md:grid-cols-4">
            <MetricCard label="Total Records" value={reportSummary.total ?? 0} accent="navy" icon={FileText} />
            <MetricCard label="Present" value={reportSummary.present ?? 0} accent="teal" icon={UserCheck} />
            <MetricCard label="Late" value={reportSummary.late ?? 0} accent="amber" icon={CalendarClock} />
            <MetricCard label="Absent" value={reportSummary.absent ?? 0} accent="rose" icon={BriefcaseBusiness} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" icon={Download} loading={exportingReport} onClick={() => exportAttendanceReport('xlsx')}>Export Excel</Button>
            <Button variant="secondary" size="sm" icon={Download} loading={exportingReport} onClick={() => exportAttendanceReport('pdf')}>Export PDF</Button>
          </div>
        </Card>
      )}

      {activeTab === 'settings' && (
        <Card title="Attendance settings" description="Office timing rules and attendance thresholds">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block text-sm text-slate-700">
              Office Start Time
              <input value={settingsForm.officeStartTime} onChange={(e) => setSettingsForm((prev) => ({ ...prev, officeStartTime: e.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <label className="block text-sm text-slate-700">
              Office End Time
              <input value={settingsForm.officeEndTime} onChange={(e) => setSettingsForm((prev) => ({ ...prev, officeEndTime: e.target.value }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <label className="block text-sm text-slate-700">
              Grace Period (Minutes)
              <input type="number" value={settingsForm.gracePeriod} onChange={(e) => setSettingsForm((prev) => ({ ...prev, gracePeriod: Number(e.target.value) }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <label className="block text-sm text-slate-700">
              Half Day Threshold (Minutes)
              <input type="number" value={settingsForm.halfDayThresholdMinutes} onChange={(e) => setSettingsForm((prev) => ({ ...prev, halfDayThresholdMinutes: Number(e.target.value) }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <label className="block text-sm text-slate-700 md:col-span-2">
              Overtime Threshold (Minutes)
              <input type="number" value={settingsForm.overtimeThresholdMinutes} onChange={(e) => setSettingsForm((prev) => ({ ...prev, overtimeThresholdMinutes: Number(e.target.value) }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <label className="flex items-center gap-3 text-sm text-slate-700 md:col-span-2">
              <input type="checkbox" checked={settingsForm.missingCheckoutReminderEnabled} onChange={(e) => setSettingsForm((prev) => ({ ...prev, missingCheckoutReminderEnabled: e.target.checked }))} />
              Enable missing-checkout reminders (in-app; email when SMTP is configured)
            </label>
            <label className="block text-sm text-slate-700 md:col-span-2">
              Reminder delay after office end (Minutes)
              <input type="number" min="0" max="1440" value={settingsForm.missingCheckoutReminderMinutes} onChange={(e) => setSettingsForm((prev) => ({ ...prev, missingCheckoutReminderMinutes: Number(e.target.value) }))} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
            </label>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm text-slate-700">Work days used for payroll proration</p>
              <div className="flex flex-wrap gap-3">
                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                  <label key={day} className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={settingsForm.workDays.includes(index)}
                      onChange={(event) => setSettingsForm((prev) => ({
                        ...prev,
                        workDays: event.target.checked
                          ? [...prev.workDays, index].sort()
                          : prev.workDays.filter((value) => value !== index),
                      }))}
                    />
                    {day}
                  </label>
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <p className="mb-2 text-sm text-slate-700">Company holidays excluded from payroll work days</p>
              <form
                className="grid gap-2 sm:grid-cols-[1fr_2fr_auto]"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!holidayDraft.date || !holidayDraft.name.trim()) return;
                  setSettingsForm((prev) => prev.holidays.some((holiday) => holiday.date === holidayDraft.date)
                    ? prev
                    : { ...prev, holidays: [...prev.holidays, { ...holidayDraft, name: holidayDraft.name.trim() }].sort((a, b) => a.date.localeCompare(b.date)) });
                  setHolidayDraft({ date: '', name: '' });
                }}
              >
                <input aria-label="Holiday date" required type="date" value={holidayDraft.date} onChange={(event) => setHolidayDraft((prev) => ({ ...prev, date: event.target.value }))} className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                <input aria-label="Holiday name" required maxLength={100} value={holidayDraft.name} onChange={(event) => setHolidayDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Holiday name" className="rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20" />
                <Button type="submit" variant="secondary">Add holiday</Button>
              </form>
              <div className="mt-3 space-y-2">
                {settingsForm.holidays.map((holiday) => (
                  <div key={holiday.date} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                    <span>{holiday.date} · {holiday.name}</span>
                    <button type="button" className="text-rose-700 hover:text-rose-900" onClick={() => setSettingsForm((prev) => ({ ...prev, holidays: prev.holidays.filter((item) => item.date !== holiday.date) }))}>Remove</button>
                  </div>
                ))}
                {!settingsForm.holidays.length && <p className="text-xs text-slate-500">No company holidays added.</p>}
              </div>
            </div>
          </div>

          <div className="mt-5 flex justify-end">
            <Button variant="primary" onClick={saveSettings} loading={savingSettings} icon={Settings2}>Save Rules</Button>
          </div>
        </Card>
      )}
      <Modal
        open={Boolean(attendanceModal)}
        onClose={() => !savingAttendance && setAttendanceModal(null)}
        title={attendanceModal?.mode === 'edit' ? 'Edit Attendance' : 'Add Attendance'}
        description="Attendance changes are permission-checked and recorded with a correction reason."
        size="lg"
        footer={<>
          <Button variant="secondary" disabled={savingAttendance} onClick={() => setAttendanceModal(null)}>Cancel</Button>
          <Button type="submit" form="attendance-correction-form" loading={savingAttendance}>Save Changes</Button>
        </>}
      >
        {attendanceModal && (
          <form id="attendance-correction-form" className="grid gap-4 sm:grid-cols-2" onSubmit={saveAttendance}>
            <Field label="Employee" required>
              <Select
                required
                disabled={attendanceModal.mode === 'edit'}
                value={attendanceForm.employee}
                onChange={(event) => setAttendanceForm((current) => ({ ...current, employee: event.target.value }))}
              >
                <option value="">Select employee</option>
                {employeeUsers.map((employee) => <option key={employee._id} value={employee._id}>{employee.name} · {employee.department || 'General'}</option>)}
              </Select>
            </Field>
            <Field label="Date" required>
              <Input required type="date" value={attendanceForm.date} onChange={(event) => setAttendanceForm((current) => ({ ...current, date: event.target.value }))} />
            </Field>
            <Field label="Check-in time">
              <Input type="time" value={attendanceForm.checkInTime} onChange={(event) => setAttendanceForm((current) => ({ ...current, checkInTime: event.target.value }))} />
            </Field>
            <Field label="Check-out time">
              <Input type="time" value={attendanceForm.checkOutTime} onChange={(event) => setAttendanceForm((current) => ({ ...current, checkOutTime: event.target.value }))} />
            </Field>
            <Field label="Status" required>
              <Select required value={attendanceForm.status} onChange={(event) => setAttendanceForm((current) => ({ ...current, status: event.target.value }))}>
                {['Present', 'Late', 'Absent', 'Checked In', 'Checked Out', 'Half Day', 'Leave'].map((status) => <option key={status} value={status}>{status}</option>)}
              </Select>
            </Field>
            <Field label="Reason for correction" required>
              <Input required maxLength={500} value={attendanceForm.correctionReason} onChange={(event) => setAttendanceForm((current) => ({ ...current, correctionReason: event.target.value }))} placeholder="Explain why this attendance is being changed" />
            </Field>
          </form>
        )}
      </Modal>
    </div>
  );
}
