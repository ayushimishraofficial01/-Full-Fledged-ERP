import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

const STYLES = {
  success: { icon: CheckCircle2, cls: 'text-emerald-600' },
  error: { icon: XCircle, cls: 'text-red-600' },
  warning: { icon: AlertTriangle, cls: 'text-amber-600' },
  info: { icon: Info, cls: 'text-brand-600' },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (type, message, { title, duration } = {}) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-3), { id, type, message, title }]);
      setTimeout(() => dismiss(id), duration || (type === 'error' ? 6500 : 4000));
    },
    [dismiss]
  );

  const api = useMemo(
    () => ({
      success: (m, o) => push('success', m, o),
      error: (m, o) => push('error', m, o),
      warning: (m, o) => push('warning', m, o),
      info: (m, o) => push('info', m, o),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end sm:p-6" aria-live="polite">
        {toasts.map((t) => {
          const S = STYLES[t.type];
          return (
            <div key={t.id} role="status" className="animate-toast pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white p-3.5 shadow-lg shadow-slate-900/10">
              <S.icon className={`mt-0.5 h-5 w-5 shrink-0 ${S.cls}`} />
              <div className="min-w-0 flex-1 text-sm">
                {t.title && <p className="font-semibold text-slate-900">{t.title}</p>}
                <p className="text-slate-600">{t.message}</p>
              </div>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-slate-400 hover:text-slate-600" aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
