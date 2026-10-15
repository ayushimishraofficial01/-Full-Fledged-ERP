import { useState } from 'react';
import clsx from 'clsx';
import { assetUrl } from '../../services/api';

/** Product image with a clean initials placeholder when no image exists or it fails to load. */
export default function ProductThumb({ product, size = 'md', className }) {
  const [failed, setFailed] = useState(false);
  const dims = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-xs', lg: 'h-24 w-24 text-xl', xl: 'h-40 w-40 text-3xl' }[size];
  const src = product?.image && !failed ? assetUrl(product.image) : null;
  if (src) {
    return <img src={src} alt={product.name} loading="lazy" onError={() => setFailed(true)} className={clsx(dims, 'shrink-0 rounded-lg border border-slate-200 bg-white object-cover', className)} />;
  }
  const name = product?.name || '?';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <div className={clsx(dims, 'flex shrink-0 items-center justify-center rounded-lg bg-slate-100 font-semibold text-slate-600 ring-1 ring-inset ring-slate-200', className)} aria-label={`${name} (no image)`}>
      {initials}
    </div>
  );
}
