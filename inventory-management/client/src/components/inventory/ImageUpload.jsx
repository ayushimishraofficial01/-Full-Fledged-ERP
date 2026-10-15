import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';
import { assetUrl } from '../../services/api';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_MB = 2;

/** Optional product image: drag & drop or browse, with preview and remove. */
export default function ImageUpload({ existing, file, onFile, removed, onRemove, error, onError }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [drag, setDrag] = useState(false);

  useEffect(() => {
    if (!file) return setPreview(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const pick = (f) => {
    if (!f) return;
    if (!TYPES.includes(f.type)) return onError('Only JPG, JPEG, PNG or WEBP images are allowed.');
    if (f.size > MAX_MB * 1024 * 1024) return onError(`Image must be smaller than ${MAX_MB} MB.`);
    onError('');
    onFile(f);
  };

  const shown = preview || (!removed && existing ? assetUrl(existing) : null);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
        className={`flex items-center gap-4 rounded-xl border-2 border-dashed p-4 transition ${drag ? 'border-brand-400 bg-brand-50/50' : error ? 'border-red-300' : 'border-slate-200'}`}
      >
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {shown ? <img src={shown} alt="Product" className="h-full w-full object-cover" /> : <ImagePlus className="h-8 w-8 text-slate-300" />}
        </div>
        <div className="min-w-0 text-sm">
          <p className="font-medium text-slate-700">{shown ? 'Product image' : 'No image (optional)'}</p>
          <p className="mt-0.5 text-xs text-slate-500">JPG, PNG or WEBP, up to {MAX_MB} MB. Drag & drop or browse.</p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <Upload className="h-3.5 w-3.5" /> {shown ? 'Replace' : 'Upload image'}
            </button>
            {shown && (
              <button type="button" onClick={() => { onFile(null); onRemove(); }} className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
                <Trash2 className="h-3.5 w-3.5" /> Remove
              </button>
            )}
          </div>
        </div>
        <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-red-600">{error}</p>}
    </div>
  );
}
