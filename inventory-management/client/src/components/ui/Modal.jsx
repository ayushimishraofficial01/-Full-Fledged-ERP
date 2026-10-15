import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';

export default function Modal({ open, onClose, title, description, children, footer, size = 'md', dismissible = true }) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape' && dismissible) onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => panelRef.current?.querySelector('[data-autofocus], button, input, select, textarea')?.focus(), 30);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;
  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="animate-fade absolute inset-0 bg-slate-950/45" onClick={() => dismissible && onClose?.()} />
      <div ref={panelRef} className={clsx('animate-pop relative flex max-h-[92vh] w-full flex-col rounded-t-2xl border border-slate-200 bg-white shadow-2xl sm:rounded-2xl', widths[size])}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div>
            <h2 id="modal-title" className="font-display text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
          </div>
          {dismissible && (
            <button type="button" onClick={onClose} className="-mr-2 -mt-1 rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
        <div className="scroll-thin overflow-y-auto px-5 py-4 sm:px-6">{children}</div>
        {footer && <div className="flex flex-col-reverse gap-2 rounded-b-2xl border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:flex-row sm:justify-end sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
