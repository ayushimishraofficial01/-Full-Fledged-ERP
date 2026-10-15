import { useEffect, useRef, useState } from 'react';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
const GSI_SRC = 'https://accounts.google.com/gsi/client';

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="h-[18px] w-[18px]" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.5 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  );
}

/**
 * "Login with Google". When VITE_GOOGLE_CLIENT_ID is set it renders Google's own button (Google Identity Services)
 * and hands the returned ID token to `onCredential`. When it is not set, the button is shown but explains that
 * Google login has not been configured yet; it never pretends to sign anyone in.
 */
export default function GoogleSignIn({ onCredential, onError, disabled }) {
  const holder = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID) return undefined;
    let cancelled = false;
    const init = () => {
      if (cancelled || !window.google?.accounts?.id || !holder.current) return;
      window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => r?.credential && onCredential(r.credential) });
      window.google.accounts.id.renderButton(holder.current, {
        type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', shape: 'rectangular', logo_alignment: 'center',
        width: Math.min(holder.current.parentElement?.clientWidth || 360, 400),
      });
      setReady(true);
    };
    if (window.google?.accounts?.id) init();
    else {
      let tag = document.querySelector(`script[src="${GSI_SRC}"]`);
      if (!tag) {
        tag = document.createElement('script');
        tag.src = GSI_SRC;
        tag.async = true;
        tag.defer = true;
        document.head.appendChild(tag);
      }
      tag.addEventListener('load', init);
      tag.addEventListener('error', () => onError?.('Could not load Google sign-in. Check your internet connection.'));
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (CLIENT_ID) {
    return (
      <div className={disabled ? 'pointer-events-none opacity-60' : ''}>
        <div ref={holder} className="flex min-h-[40px] justify-center" />
        {!ready && <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />}
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onError?.('Google login is not set up yet. Add your Google Client ID (VITE_GOOGLE_CLIENT_ID and GOOGLE_CLIENT_ID) to enable it.')}
      className="flex h-10 w-full items-center justify-center gap-2.5 rounded-lg border border-slate-300 bg-white text-sm font-medium text-slate-800 shadow-xs transition-colors hover:bg-slate-50"
    >
      <GoogleLogo /> Continue with Google
    </button>
  );
}
