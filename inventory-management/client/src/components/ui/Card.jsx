import clsx from 'clsx';

export default function Card({ title, description, actions, className, bodyClassName, children, padded = true }) {
  return (
    <section className={clsx('card', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5 sm:px-6" style={{ borderColor: 'var(--line-soft)' }}>
          <div className="min-w-0">
            {title && <h2 className="font-display text-[15px] font-semibold text-slate-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] leading-5 text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={clsx(padded && 'p-5 sm:p-6', bodyClassName)}>{children}</div>
    </section>
  );
}
