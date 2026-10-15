import { useEffect, useId, useState } from 'react';
import { crmService } from '../services';

export default function CustomerLookup({ id, value, onChange, onSelect, label = 'Search customer', placeholder = 'Name, phone, email or GSTIN', inputClassName = '' }) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedValue, setSelectedValue] = useState('');

  useEffect(() => {
    const search = String(value || '').trim();
    if (search.length < 2 || search === selectedValue) {
      setResults([]);
      setError('');
      setLoading(false);
      return undefined;
    }

    let active = true;
    setLoading(true);
    setError('');
    const timer = window.setTimeout(() => {
      crmService.lookupCustomers({ search })
        .then((result) => {
          if (active) {
            setResults(result.items || []);
            setOpen(true);
          }
        })
        .catch((requestError) => {
          if (active) {
            setResults([]);
            setError(requestError.response?.data?.message || 'Could not search saved customers.');
          }
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [value, selectedValue]);

  return (
    <div className="relative">
      {label && <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-slate-700">{label}</label>}
      <input
        id={inputId}
        type="search"
        autoComplete="off"
        className={inputClassName || 'h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100'}
        value={value || ''}
        onChange={(event) => {
          setSelectedValue('');
          onChange(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        aria-expanded={open && results.length > 0}
        aria-autocomplete="list"
      />
      {open && (loading || error || results.length > 0 || String(value || '').trim().length >= 2) && (
        <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {loading && <p className="px-3 py-2 text-sm text-slate-500">Searching customers…</p>}
          {!loading && error && <p role="alert" className="px-3 py-2 text-sm text-red-600">{error}</p>}
          {!loading && !error && results.length === 0 && <p className="px-3 py-2 text-sm text-slate-500">No saved customers found.</p>}
          {!loading && results.map((customer) => (
            <button
              type="button"
              key={customer._id}
              className="block w-full px-3 py-2 text-left hover:bg-brand-50 focus:bg-brand-50 focus:outline-none"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelect(customer);
                setSelectedValue(customer.fullName || '');
                setResults([]);
                setOpen(false);
              }}
            >
              <span className="block truncate text-sm font-semibold text-slate-800">{customer.fullName}</span>
              <span className="block truncate text-xs text-slate-500">
                {[customer.phone, customer.email, customer.gstNumber].filter(Boolean).join(' · ')}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
