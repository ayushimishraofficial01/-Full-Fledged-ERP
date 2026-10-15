import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Camera, CheckCircle2, Clock3, MapPin, Navigation, Plus, Radio, ShieldCheck, Trash2 } from 'lucide-react';
import { Button, Card, PageHeader } from '../../components/ui';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../context/ToastContext';
import { getCurrentLocation, useSalesTracking } from '../../context/SalesTrackingContext';
import { salesVisitService } from '../../services';
import { formatCurrency } from '../../utils/format';

const dateTime = (value) => value ? new Date(value).toLocaleString() : '—';
const durationText = (seconds) => {
  if (seconds == null) return 'In progress';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return hours ? `${hours}h ${minutes}m` : `${minutes} min`;
};
const mapsLink = (latitude, longitude) => `https://www.google.com/maps?q=${latitude},${longitude}`;

function ProductRequirementRow({ requirement, index, requirements, onChange, onRemove, toast }) {
  const [search, setSearch] = useState('');
  const [matches, setMatches] = useState([]);
  const [units, setUnits] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const query = search.trim();
    if (query.length < 2) {
      setMatches([]);
      if (!requirements[index]?.productId) setUnits([]);
      return undefined;
    }
    let cancelled = false;
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await salesVisitService.products({ search: query, limit: 30 });
        if (!cancelled) {
          setUnits(result.units || []);
          setMatches(result.products.filter((product) => !requirements.some(
            (item, itemIndex) => itemIndex !== index && item.productId === product.id
          )));
        }
      } catch (error) {
        if (!cancelled) toast.error(error.response?.data?.message || 'Unable to search active products.');
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [index, requirements, search, toast]);

  return (
    <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_130px_145px_auto]">
      <div className="min-w-0">
        {requirement.productId ? (
          <div className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3">
            <span className="truncate text-sm font-medium text-emerald-900">{requirement.productName} · {requirement.sku}</span>
            <button type="button" className="shrink-0 text-sm font-medium text-brand-700 hover:underline" onClick={() => { onChange(index, { productId: '', productName: '', sku: '', unit: '', unitPrice: '', quantity: requirement.quantity, note: requirement.note }); setSearch(''); }}>Change</button>
          </div>
        ) : (
          <>
            <label className="block text-xs font-medium text-slate-600" htmlFor={`requirementProduct${index}`}>Search product</label>
            <input
              id={`requirementProduct${index}`}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Type product name or SKU"
              autoComplete="off"
              className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            {search.trim().length >= 2 && (
              <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                {searching ? <p className="px-3 py-2 text-sm text-slate-500">Searching products…</p> : matches.length ? matches.map((product) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => { onChange(index, { ...requirement, productId: product.id, productName: product.name, sku: product.sku, unit: product.unit, unitPrice: product.price == null ? '' : String(product.price) }); setSearch(''); setMatches([]); }}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="truncate font-medium text-slate-800">{product.name}</span>
                    <span className="shrink-0 text-right text-xs text-slate-500">{product.sku}{product.price != null && <span className="block">{formatCurrency(product.price)}</span>}</span>
                  </button>
                )) : <p className="px-3 py-2 text-sm text-slate-500">No active products found.</p>}
              </div>
            )}
          </>
        )}
      </div>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`requirementQuantity${index}`}>
        Required quantity
        <span className="mt-1 flex h-10 overflow-hidden rounded-lg border border-slate-300 focus-within:border-brand-500">
          <input
            id={`requirementQuantity${index}`}
            type="number"
            min="0.001"
            max="1000000000000"
            step="0.001"
            required
            disabled={!requirement.productId}
            value={requirement.quantity}
            onChange={(event) => onChange(index, { ...requirement, quantity: event.target.value })}
            className="min-w-0 flex-1 px-3 text-sm outline-none disabled:bg-slate-50"
          />
          <select
            aria-label={`Unit for requirement ${index + 1}`}
            required
            disabled={!requirement.productId}
            value={requirement.unit}
            onChange={(event) => onChange(index, { ...requirement, unit: event.target.value })}
            className="max-w-28 border-l border-slate-200 bg-slate-50 px-2 text-sm text-slate-700 outline-none disabled:text-slate-400"
          >
            {requirement.unit && !units.some((unit) => unit.name === requirement.unit) && <option value={requirement.unit}>{requirement.unit}</option>}
            {units.map((unit) => <option key={unit.name} value={unit.name}>{unit.name}</option>)}
          </select>
        </span>
      </label>
      <label className="block text-xs font-medium text-slate-600" htmlFor={`requirementPrice${index}`}>
        Unit price (INR)
        <input
          id={`requirementPrice${index}`}
          type="number"
          min="0"
          max="1000000000000"
          step="0.01"
          disabled={!requirement.productId}
          value={requirement.unitPrice ?? ''}
          onChange={(event) => onChange(index, { ...requirement, unitPrice: event.target.value })}
          placeholder="Optional"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50"
        />
      </label>
      <button type="button" onClick={() => onRemove(index)} className="flex h-10 items-center justify-center gap-1 rounded-lg px-3 text-sm font-medium text-red-700 hover:bg-red-50" aria-label={`Remove product requirement ${index + 1}`}>
        <Trash2 className="h-4 w-4" /> Remove
      </button>
      <label className="block text-xs font-medium text-slate-600 sm:col-span-4" htmlFor={`requirementNote${index}`}>
        Requirement note (optional)
        <input
          id={`requirementNote${index}`}
          maxLength={500}
          value={requirement.note}
          onChange={(event) => onChange(index, { ...requirement, note: event.target.value })}
          placeholder="Customer's requested variant, delivery preference, or other details"
          className="mt-1 h-10 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      </label>
    </div>
  );
}

export default function SalesVisits() {
  const { shift, setShift, refresh, locationStatus, shiftLoading } = useSalesTracking();
  const toast = useToast();
  const [history, setHistory] = useState({ shifts: [], visits: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [notes, setNotes] = useState('');
  const [requirements, setRequirements] = useState([]);
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);
  const cameraVideo = useRef(null);

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
    video.play().catch(() => toast.error('Unable to start the camera preview.'));
    return () => {
      cameraStream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };
  }, [cameraOpen, cameraStream, toast]);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      setHistory(await salesVisitService.history());
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load your sales visit history.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const activeVisit = useMemo(
    () => history.visits.find((visit) => visit.shift === shift?._id && !visit.checkOut?.at),
    [history.visits, shift?._id]
  );

  async function startShift() {
    setBusy(true);
    try {
      const location = await getCurrentLocation();
      const result = await salesVisitService.startShift({ consent: true, location });
      setShift(result.shift);
      setConsent(false);
      await loadHistory();
      toast.success('Working hours started. Location updates are active while this app is open.');
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || 'Unable to start your working hours.');
    } finally {
      setBusy(false);
    }
  }

  async function endShift() {
    setBusy(true);
    try {
      const location = await getCurrentLocation();
      const result = await salesVisitService.endShift({ location });
      setShift(result.shift);
      await refresh();
      await loadHistory();
      toast.success('Working hours ended.');
    } catch (error) {
      toast.error(error.message || error.response?.data?.message || 'Unable to end your shift.');
    } finally {
      setBusy(false);
    }
  }

  async function captureVisitPin() {
    setBusy(true);
    try {
      const location = await getCurrentLocation();
      setLatitude(String(location.latitude.toFixed(6)));
      setLongitude(String(location.longitude.toFixed(6)));
      toast.success('Current GPS coordinates added as the visit geofence centre.');
    } catch (error) {
      toast.error(error.message || 'Unable to get your location.');
    } finally {
      setBusy(false);
    }
  }

  async function openCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Direct camera access is unavailable. Open this page over HTTPS on a device browser that supports camera access.');
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
        ? 'Allow camera access in your browser settings, then tap Take photo again.'
        : 'Could not open the camera. Check that a camera is available and not being used by another app.');
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
      toast.error('Camera is not ready yet. Please wait a moment and try again.');
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
        toast.error('Could not prepare this photo for upload. Please retake it.');
        return;
      }
      setPhoto(new File([blob], `visit-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      closeCamera();
    } catch {
      toast.error('Could not capture the camera image. Please try again.');
    }
  }

  async function checkIn(event) {
    event.preventDefault();
    const hasInvalidRequirement = requirements.some((item) => (
      !item.productId
      || !Number.isFinite(Number(item.quantity))
      || Number(item.quantity) <= 0
      || Number(item.quantity) > 1e12
      || Math.abs(Number(item.quantity) * 1000 - Math.round(Number(item.quantity) * 1000)) >= 1e-6
      || (item.unitPrice !== '' && item.unitPrice != null && (!Number.isFinite(Number(item.unitPrice)) || Number(item.unitPrice) < 0 || Math.abs(Number(item.unitPrice) * 100 - Math.round(Number(item.unitPrice) * 100)) >= 1e-6))
    ));
    if (hasInvalidRequirement) {
      toast.error('Select a catalog product and enter a valid quantity for each requirement.');
      return;
    }
    setBusy(true);
    try {
      const location = await getCurrentLocation();
      await salesVisitService.checkIn({
        placeName,
        notes,
        requirements: requirements.map(({ productId, quantity, unit, unitPrice, note }) => ({
          productId,
          quantity: Number(quantity),
          unit,
          ...(unitPrice !== '' && unitPrice != null ? { unitPrice: Number(unitPrice) } : {}),
          note,
        })),
        geofence: { latitude: Number(latitude), longitude: Number(longitude) },
        location,
      });
      setPlaceName('');
      setNotes('');
      setRequirements([]);
      await refresh();
      await loadHistory();
      toast.success('Visit checked in. Your visit timer has started.');
    } catch (error) {
      toast.error(error.message || error.response?.data?.message || 'Unable to check in to this visit.');
    } finally {
      setBusy(false);
    }
  }

  async function checkOut(event) {
    event.preventDefault();
    if (!activeVisit || !photo) return;
    setBusy(true);
    try {
      const location = await getCurrentLocation();
      await salesVisitService.checkOut(activeVisit._id, location, photo);
      setPhoto(null);
      await refresh();
      await loadHistory();
      toast.success('Visit completed and photo evidence saved.');
    } catch (error) {
      toast.error(error.message || error.response?.data?.message || 'Unable to check out of this visit.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="My Field Visits"
        description="Start working hours, check in at customer locations, and submit photo proof before checking out."
        breadcrumbs={[{ label: 'Sales Visits' }, { label: 'My Field Visits' }]}
      />

      <Card className="mb-5 border-brand-100 bg-gradient-to-r from-brand-50/80 to-white">
        <div className="flex items-start gap-3">
          <span className="rounded-xl bg-white p-2.5 text-brand-700 shadow-sm"><ShieldCheck className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-slate-900">Location tracking and privacy</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Tracking starts only after you start working hours and allow location access. While your signed-in app is open and online, it records a location about every 30 seconds. It pauses when this page is hidden or the app is closed; background tracking is not guaranteed, and GPS may be inaccurate or spoofed.
            </p>
            <p className="mt-2 text-xs font-medium text-slate-500">Location updates are visible to authorised managers. Visit photos are private and only available to you and authorised managers.</p>
          </div>
        </div>
      </Card>

      <Card className="mb-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className={`rounded-xl p-2.5 ${shift?.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {shift?.isActive ? <Radio className="h-5 w-5" /> : <Clock3 className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{shift?.isActive ? 'Working hours in progress' : 'No active working hours'}</h2>
              <p className="mt-1 text-sm text-slate-500">
                {shift?.isActive ? `Started ${dateTime(shift.startedAt)} · ${locationStatus === 'paused' ? 'Location paused while app is hidden' : locationStatus === 'tracking' || locationStatus === 'updating' ? 'Location tracking is active' : 'Waiting for location'}` : 'Start your shift when you are ready to begin field work.'}
              </p>
            </div>
          </div>
          {shift?.isActive ? (
            <Button variant="secondary" onClick={endShift} loading={busy} disabled={Boolean(activeVisit)} title={activeVisit ? 'Check out of your visit before ending working hours' : undefined}>End working hours</Button>
          ) : (
            <Button onClick={startShift} loading={busy || shiftLoading} disabled={!consent || shiftLoading}>Start working hours</Button>
          )}
        </div>
        {!shift?.isActive && (
          <label className="mt-4 flex cursor-pointer items-start gap-2.5 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
            <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} className="mt-1 accent-brand-600" />
            <span>I understand location will be collected during working hours while the app is open, and may be viewed by authorised managers.</span>
          </label>
        )}
        {shift?.isActive && (
          <div className={`mt-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${locationStatus === 'paused' ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'}`}>
            {locationStatus === 'paused' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Navigation className="h-4 w-4 shrink-0" />}
            <span>{locationStatus === 'paused' ? 'The app is hidden. Location updates are paused until it becomes visible again.' : locationStatus && !['tracking', 'updating', 'idle'].includes(locationStatus) ? locationStatus : 'GPS is sampled while the app is open. Keep the browser page visible for the most reliable updates.'}</span>
          </div>
        )}
      </Card>

      {shift?.isActive && !activeVisit && (
        <Card className="mb-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><MapPin className="h-5 w-5" /></span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Check in to a location</h2>
              <p className="mt-1 text-sm text-slate-500">Add the visit location and its map coordinates. Check-in and check-out are accepted only within 150 metres of the geofence.</p>
            </div>
          </div>
          <form onSubmit={checkIn} className="grid gap-4 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Visit location
              <input required maxLength={160} value={placeName} onChange={(event) => setPlaceName(event.target.value)} placeholder="Customer or visit location" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </label>
            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Visit notes
              <textarea maxLength={2000} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Add notes about the customer, issue, follow-up, or discussion during this field visit" rows={3} className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Latitude
              <input required type="number" step="any" min="-90" max="90" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder="e.g. 28.6139" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Longitude
              <input required type="number" step="any" min="-180" max="180" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder="e.g. 77.2090" className="mt-1.5 h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100" />
            </label>
            <div className="space-y-3 md:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Customer product requirements</h3>
                  <p className="text-xs text-slate-500">Record requested catalog products and quantities for this visit.</p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                  disabled={requirements.length >= 50}
                  onClick={() => setRequirements((items) => [...items, { id: `${Date.now()}-${Math.random()}`, productId: '', productName: '', sku: '', unit: '', quantity: '', unitPrice: '', note: '' }])}
                >
                  Add product
                </Button>
              </div>
              {requirements.map((requirement, index) => (
                <ProductRequirementRow
                  key={requirement.id}
                  requirement={requirement}
                  index={index}
                  requirements={requirements}
                  toast={toast}
                  onChange={(itemIndex, value) => setRequirements((items) => items.map((item, currentIndex) => currentIndex === itemIndex ? value : item))}
                  onRemove={(itemIndex) => setRequirements((items) => items.filter((_, currentIndex) => currentIndex !== itemIndex))}
                />
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 md:col-span-2">
              <Button type="button" variant="secondary" icon={Navigation} onClick={captureVisitPin} loading={busy}>Use current GPS as visit pin</Button>
              <Button type="submit" icon={MapPin} loading={busy} disabled={requirements.some((item) => !item.productId || !item.quantity)}>Check in</Button>
              <span className="text-xs text-slate-500">The GPS pin button is best used while physically at the visit location.</span>
            </div>
          </form>
        </Card>
      )}

      <Card className={`mb-5 ${activeVisit ? 'border-emerald-200' : ''}`}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${activeVisit ? 'text-emerald-700' : 'text-brand-700'}`}>
                {activeVisit ? 'Active visit' : 'Visit photo proof'}
              </p>
              {activeVisit ? (
                <>
                  <h2 className="mt-1 text-xl font-semibold text-slate-900">{activeVisit.placeName}</h2>
                  <p className="mt-1 text-sm text-slate-500">Checked in {dateTime(activeVisit.checkIn.at)} · Geofence radius 150 m</p>
                  <a className="mt-2 inline-block text-sm font-medium text-brand-700 hover:underline" href={mapsLink(activeVisit.geofence.latitude, activeVisit.geofence.longitude)} target="_blank" rel="noreferrer">Open location in Maps</a>
                </>
              ) : (
                <>
                  <h2 className="mt-1 text-lg font-semibold text-slate-900">Take a photo of the place you visited</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {shift?.isActive
                      ? 'You can take the photo now. Check in to the visit before adding the photo and checking out.'
                      : 'Start working hours first. Then take a photo and check in to the place to attach it to your visit.'}
                  </p>
                </>
              )}
            </div>
            {activeVisit && <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-4 w-4" /> Visit timer running</span>}
          </div>
          <form onSubmit={checkOut} className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-end">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-700">Visit photo <span className="font-normal text-slate-500">(required to complete the visit)</span></p>
              <p className="mt-1 text-xs text-slate-500">Take photo opens the camera directly. Gallery/file selection is not used.</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <Button type="button" variant="secondary" icon={Camera} onClick={openCamera} disabled={busy}>
                  {photo ? 'Retake photo' : 'Take photo'}
                </Button>
                {photo && <p className="min-w-0 truncate text-sm text-slate-600" title={photo.name}>{photo.name}</p>}
              </div>
              {photoPreview && <img src={photoPreview} alt="Preview of the visit photo to be submitted" className="mt-3 max-h-56 max-w-full rounded-lg border border-slate-200 object-contain" />}
            </div>
            <Button type="submit" icon={Camera} loading={busy} disabled={!photo || !activeVisit}>Add photo & check out</Button>
          </form>
        </Card>

      <Modal
        open={cameraOpen}
        onClose={closeCamera}
        title="Take visit photo"
        description="Camera is open. Take a clear photo of the place you visited."
        size="lg"
        footer={<>
          <Button variant="secondary" onClick={closeCamera}>Cancel</Button>
          <Button icon={Camera} onClick={capturePhoto}>Capture photo</Button>
        </>}
      >
        <video
          ref={cameraVideo}
          autoPlay
          playsInline
          muted
          aria-label="Live camera preview"
          className="max-h-[65vh] w-full rounded-xl bg-slate-950 object-contain"
        />
      </Modal>

      <Card>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Recent visits</h2>
            <p className="mt-1 text-sm text-slate-500">Your check-in and check-out times, duration, and photo proof.</p>
          </div>
          <Button variant="secondary" size="sm" onClick={loadHistory} loading={loading}>Refresh</Button>
        </div>
        {loading ? <p className="py-8 text-center text-sm text-slate-500">Loading visits…</p> : history.visits.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">No visits recorded yet. Start working hours to check in at a location.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {history.visits.map((visit) => (
              <article key={visit._id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h3 className="font-semibold text-slate-900">{visit.placeName}</h3>
                  <p className="mt-1 text-sm text-slate-500">In {dateTime(visit.checkIn.at)} · Out {dateTime(visit.checkOut?.at)}</p>
                  <p className="mt-1 text-sm text-slate-600">Visit duration: {durationText(visit.durationSeconds)}</p>
                  {visit.notes && (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">{visit.notes}</p>
                  )}
                  {visit.requirements?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer requirements</p>
                      {visit.requirements.map((item) => (
                        <p key={`${item.product}-${item.sku}`} className="text-sm text-slate-700">
                          {item.productName} ({item.sku}) · {item.quantity} {item.unit}{item.unitPrice != null && ` · ${formatCurrency(item.unitPrice)} / ${item.unit}`}{item.note ? ` · ${item.note}` : ''}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
                {visit.evidenceFilename && <a href={salesVisitService.photoUrl(visit._id)} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 hover:underline">View photo evidence</a>}
              </article>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
