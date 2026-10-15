import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin, RefreshCw } from 'lucide-react';
import { Button, Card, PageHeader } from '../../components/ui';
import { useToast } from '../../context/ToastContext';
import { salesVisitService } from '../../services';

const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const durationText = (seconds) => {
  if (seconds == null) return 'In progress';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
};

export default function SalesTeamVisits() {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [page, setPage] = useState(1);
  const [userId, setUserId] = useState('');
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await salesVisitService.team({ page, limit: 25, userId });
      setShifts(result.shifts || []);
      setUsers(result.users || []);
      setPagination(result.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load team visits.');
    } finally {
      setLoading(false);
    }
  }, [page, toast, userId]);

  useEffect(() => { load(); }, [load]);

  return (
    <>
      <PageHeader
        title="Sales Team Overview"
        description="Review working-hour periods, consented location samples, visit times, and submitted proof photos."
        breadcrumbs={[{ label: 'Sales Visits' }, { label: 'Team Overview' }]}
        actions={<Button variant="secondary" icon={RefreshCw} onClick={load} loading={loading}>Refresh</Button>}
      />
      <Card className="mb-5 border-amber-200 bg-amber-50/70">
        <p className="text-sm leading-6 text-amber-900">GPS coordinates are device-reported and may be inaccurate or spoofed. Background updates while a phone is locked or the app is closed require the separate native Android app; this web app alone cannot guarantee them.</p>
      </Card>
      <Card className="mb-5">
        <label className="block max-w-xl text-sm font-medium text-slate-700">
          Filter by user
          <select value={userId} onChange={(event) => { setUserId(event.target.value); setPage(1); }} className="input mt-1.5">
            <option value="">All sales users</option>
            {users.map((user) => <option key={user._id} value={user._id}>{user.name} · {user.email}</option>)}
          </select>
        </label>
      </Card>
      <div className="space-y-4">
        {loading ? <Card><p className="py-6 text-center text-sm text-slate-500">Loading team shifts…</p></Card> : shifts.length === 0 ? (
          <Card><p className="py-8 text-center text-sm text-slate-500">{userId ? 'This user has no recorded working hours yet.' : 'No sales working hours have been recorded.'}</p></Card>
        ) : shifts.map((shift) => (
          <Card key={shift._id}>
            <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">{shift.user?.name || 'Sales user'}</h2>
                <p className="text-sm text-slate-500">{shift.user?.email || '—'}</p>
                {shift.user?.officeSchedule && <p className="mt-1 text-xs text-slate-500">Office hours: {shift.user.officeSchedule.startTime}–{shift.user.officeSchedule.endTime} ({shift.user.officeSchedule.timezone}) · {shift.user.officeSchedule.weekdays.map((day) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(', ')}</p>}
              </div>
              <span className={`w-fit rounded-full px-3 py-1 text-sm font-medium ${shift.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>{shift.isActive ? 'Working hours active' : 'Working hours ended'}</span>
              <div className="text-sm text-slate-600">Started {dateTime(shift.startedAt)}<br />Ended {dateTime(shift.endedAt)}</div>
              <div className="text-sm text-slate-600">{shift.track?.length || 0} recent location samples</div>
            </div>
            {shift.isActive && shift.latestLocation && (
              <a href={`https://www.google.com/maps?q=${shift.latestLocation.latitude},${shift.latestLocation.longitude}`} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <MapPin className="h-4 w-4" /> Open latest location
              </a>
            )}
            {shift.track?.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium text-slate-700">View recent location trail</summary>
                <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[...shift.track].reverse().map((point, index) => (
                    <a key={`${point.recordedAt}-${index}`} href={`https://www.google.com/maps?q=${point.latitude},${point.longitude}`} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                      {dateTime(point.recordedAt)} · ±{Math.round(point.accuracy)} m
                    </a>
                  ))}
                </div>
                {!loading && pagination.totalPages > 1 && (
                  <div className="mt-5 flex items-center justify-between gap-3">
                    <p className="text-sm text-slate-500">Showing page {pagination.page} of {pagination.totalPages} · {pagination.total} shifts</p>
                    <div className="flex gap-2">
                      <Button variant="secondary" size="sm" icon={ChevronLeft} disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Previous</Button>
                      <Button variant="secondary" size="sm" icon={ChevronRight} disabled={page >= pagination.totalPages} onClick={() => setPage((current) => Math.min(pagination.totalPages, current + 1))}>Next</Button>
                    </div>
                  </div>
                )}
              </details>
            )}
            <div className="mt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Visits ({shift.visits?.length || 0})</h3>
              {!shift.visits?.length ? <p className="text-sm text-slate-500">No visits recorded during this shift.</p> : (
                <div className="divide-y divide-slate-100">
                  {shift.visits.map((visit) => (
                    <div key={visit._id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-900">{visit.placeName}</p>
                        <p className="text-sm text-slate-500">In {dateTime(visit.checkIn.at)} · Out {dateTime(visit.checkOut?.at)}</p>
                        {visit.notes && (
                          <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{visit.notes}</p>
                        )}
                        {visit.requirements?.length > 0 && (
                          <div className="mt-2 space-y-1">
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer requirements</p>
                            {visit.requirements.map((item) => (
                              <p key={`${item.product}-${item.sku}`} className="text-sm text-slate-700">
                                {item.productName} ({item.sku}) · {item.quantity} {item.unit}{item.note ? ` · ${item.note}` : ''}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-sm text-slate-600">{durationText(visit.durationSeconds)}</span>
                      {visit.evidenceFilename && <a href={salesVisitService.photoUrl(visit._id)} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">View photo</a>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
