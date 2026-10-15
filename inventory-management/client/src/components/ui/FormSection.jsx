import clsx from 'clsx';

/** A titled group of fields inside a form card. Consecutive sections are divided by a hairline. */
export default function FormSection({ title, description, children, className }) {
  return (
    <div className={clsx('border-t p-5 first:border-t-0 sm:p-6', className)} style={{ borderColor: 'var(--line-soft)' }}>
      {title && (
        <div className="mb-4">
          <h3 className="font-display text-[15px] font-semibold text-slate-900">{title}</h3>
          {description && <p className="mt-0.5 text-[13px] text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}
