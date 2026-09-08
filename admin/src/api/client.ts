import type { ApiFailure, ApiSuccess } from './types';

const API_BASE =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ||
  'http://127.0.0.1:3000/api/v1';

const ACCESS_KEY = 'dayfax_admin_access';
const REFRESH_KEY = 'dayfax_admin_refresh';

export class ApiError extends Error {
  status: number;
  body: ApiFailure | null;

  constructor(message: string, status: number, body: ApiFailure | null = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export function getStoredTokens() {
  return {
    accessToken: localStorage.getItem(ACCESS_KEY),
    refreshToken: localStorage.getItem(REFRESH_KEY),
  };
}

export function setStoredTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearStoredTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/admin/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const json = (await res.json()) as ApiSuccess<{
      accessToken: string;
      refreshToken: string;
    }> | ApiFailure;
    if (!res.ok || !json.success) {
      clearStoredTokens();
      return false;
    }
    setStoredTokens(json.data.accessToken, json.data.refreshToken);
    return true;
  } catch {
    clearStoredTokens();
    return false;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const { accessToken } = getStoredTokens();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) {
      return apiRequest<T>(path, options, false);
    }
  }

  let json: ApiSuccess<T> | ApiFailure | null = null;
  try {
    json = (await res.json()) as ApiSuccess<T> | ApiFailure;
  } catch {
    json = null;
  }

  if (!res.ok || !json || !json.success) {
    const message =
      json && 'message' in json ? json.message : `Request failed (${res.status})`;
    throw new ApiError(message, res.status, json && !json.success ? json : null);
  }

  return json.data;
}

export function formatPaise(paise: number, currency = 'INR') {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(rupees);
}
