import { forwardRef } from 'react';
import clsx from 'clsx';

export function Field({ label, htmlFor, required, error, hint, className, children }) {
  return (
    <div className={className}>
      {label && (
        <label htmlFor={htmlFor} className="label">
          {label}
          {required ? <span className="ml-0.5 text-red-500">*</span> : <span className="ml-1 font-normal text-slate-400">{required === false ? '(optional)' : ''}</span>}
        </label>
      )}
      {children}
      {error ? <p className="mt-1.5 text-xs font-medium text-red-600" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ error, className, ...props }, ref) {
  return <input ref={ref} className={clsx('input', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props} />;
});

export const Textarea = forwardRef(function Textarea({ error, className, rows = 3, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx('input resize-y', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props} />;
});

export const Select = forwardRef(function Select({ error, className, children, placeholder, ...props }, ref) {
  return (
    <select ref={ref} className={clsx('input pr-9', error && 'input-error', className)} aria-invalid={Boolean(error)} {...props}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {children}
    </select>
  );
});
