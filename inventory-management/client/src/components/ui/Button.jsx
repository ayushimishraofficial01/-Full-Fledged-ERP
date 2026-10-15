import { forwardRef } from 'react';
import clsx from 'clsx';
import Spinner from './Spinner';

const VARIANTS = {
  primary: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:text-white/90',
  brand: 'bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:text-white/90',
  secondary: 'border border-slate-300 bg-white text-slate-800 shadow-xs hover:bg-slate-50 hover:border-slate-400 active:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400 disabled:bg-white',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800 disabled:bg-red-300',
  'danger-ghost': 'text-red-600 hover:bg-red-50 active:bg-red-100',
  success: 'bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 active:bg-emerald-800 disabled:bg-emerald-300',
};
const SIZES = {
  xs: 'h-8 px-2.5 text-sm gap-1',
  sm: 'h-9 px-3.5 text-[15px] gap-1.5',
  md: 'h-10 px-4 text-[15px] gap-2',
  lg: 'h-11 px-5 text-[17px] gap-2',
  icon: 'h-8 w-8 justify-center',
};

const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, icon: Icon, className, children, disabled, type = 'button', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={clsx(
        'inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap rounded-lg font-medium transition-[background-color,border-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:shadow-none disabled:active:translate-y-0',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Spinner className="h-4 w-4" /> : Icon ? <Icon className={size === 'xs' ? 'h-3.5 w-3.5' : 'h-4 w-4'} strokeWidth={1.9} /> : null}
      {children}
    </button>
  );
});

export default Button;
