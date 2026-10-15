import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { salesVisitService } from '../services';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

const SalesTrackingContext = createContext(null);

export function getCurrentLocation() {
  if (!navigator.geolocation) return Promise.reject(new Error('This browser does not support location access.'));
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      (error) => {
        const messages = {
          1: 'Location permission was denied. Allow location access in your browser settings to continue.',
          2: 'Your location is unavailable. Check that location services are enabled and try again.',
          3: 'Getting your location took too long. Please try again.',
        };
        reject(new Error(messages[error.code] || 'Unable to get your current location.'));
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
  });
}

export function SalesTrackingProvider({ children }) {
  const { user, status } = useAuth();
  const toast = useToast();
  const canTrack = status === 'authenticated' && (user?.role === 'admin' || user?.permissions?.includes('sales_visits.track'));
  const [shift, setShift] = useState(null);
  const [shiftLoading, setShiftLoading] = useState(canTrack);
  const [locationStatus, setLocationStatus] = useState('idle');
  const lastTrackingError = useRef('');

  const refresh = useCallback(async () => {
    if (!canTrack) {
      setShift(null);
      setShiftLoading(false);
      return null;
    }
    setShiftLoading(true);
    try {
      const result = await salesVisitService.current();
      setShift(result.shift || null);
      return result;
    } finally {
      setShiftLoading(false);
    }
  }, [canTrack]);

  useEffect(() => {
    let active = true;
    if (canTrack) {
      setShiftLoading(true);
      salesVisitService.current()
        .then((result) => active && setShift(result.shift || null))
        .catch((error) => {
          if (active) toast.error(error.response?.data?.message || 'Unable to load the current sales shift.');
        })
        .finally(() => active && setShiftLoading(false));
    } else {
      setShift(null);
      setShiftLoading(false);
    }
    return () => { active = false; };
  }, [canTrack, toast]);

  useEffect(() => {
    if (!shift?.isActive || !canTrack) {
      setLocationStatus('idle');
      return undefined;
    }
    let active = true;
    let inFlight = false;

    const sampleLocation = async () => {
      if (!active || inFlight || document.visibilityState !== 'visible') return;
      inFlight = true;
      setLocationStatus('updating');
      try {
        const location = await getCurrentLocation();
        if (!active) return;
        await salesVisitService.recordLocation({ location });
        if (!active) return;
        setLocationStatus('tracking');
        lastTrackingError.current = '';
      } catch (error) {
        if (!active) return;
        const message = error.message || error.response?.data?.message || 'Location update failed.';
        setLocationStatus(message);
        if (lastTrackingError.current !== message) {
          toast.error(message);
          lastTrackingError.current = message;
        }
      } finally {
        inFlight = false;
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') sampleLocation();
      else setLocationStatus('paused');
    };
    const timer = window.setInterval(sampleLocation, 30000);
    document.addEventListener('visibilitychange', onVisibilityChange);
    sampleLocation();
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [shift?._id, canTrack, toast]);

  const value = useMemo(() => ({ shift, setShift, refresh, locationStatus, shiftLoading }), [shift, refresh, locationStatus, shiftLoading]);
  return <SalesTrackingContext.Provider value={value}>{children}</SalesTrackingContext.Provider>;
}

export const useSalesTracking = () => useContext(SalesTrackingContext);
