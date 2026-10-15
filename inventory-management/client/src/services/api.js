import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api`;

const api = axios.create({
  baseURL,
  withCredentials: true, // auth lives in an httpOnly cookie
  timeout: 60000,
});

let onUnauthorized = null;
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    if (status === 401 && onUnauthorized && !url.startsWith('/auth/')) onUnauthorized();

    // Blob responses (downloads) carry JSON errors as Blob; decode them.
    if (error.response?.data instanceof Blob && error.response.data.type?.includes('json')) {
      try {
        error.response.data = JSON.parse(await error.response.data.text());
      } catch {
        /* ignore */
      }
    }
    return Promise.reject(error);
  }
);

/** Turns any axios error into { message, fieldErrors, status, data } for the UI. */
export function parseError(error, fallback = 'Something went wrong. Please try again.') {
  if (!error) return { message: fallback, fieldErrors: {} };
  if (!error.response) {
    return {
      message: error.code === 'ECONNABORTED' ? 'The request timed out. Please try again.' : 'Cannot reach the server. Check your connection.',
      fieldErrors: {},
      status: 0,
    };
  }
  const data = error.response.data || {};
  const fieldErrors = {};
  if (Array.isArray(data.errors)) {
    data.errors.forEach((e) => {
      if (e.field && !fieldErrors[e.field]) fieldErrors[e.field] = e.message;
    });
  }
  return { message: data.message || fallback, fieldErrors, status: error.response.status, data };
}

/** Downloads a file endpoint (Excel exports) using the auth cookie. */
export async function downloadFile(url, params = {}, fallbackName = 'export.xlsx') {
  const res = await api.get(url, { params: cleanParams(params), responseType: 'blob', timeout: 180000 });
  const disposition = res.headers['content-disposition'] || '';
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const name = match ? match[1] : fallbackName;
  const href = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
  return name;
}

export function cleanParams(params) {
  const out = {};
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  });
  return out;
}

export function assetUrl(path) {
  if (!path) return null;
  return `${import.meta.env.VITE_API_URL || ''}/uploads/${path}`;
}

export default api;
