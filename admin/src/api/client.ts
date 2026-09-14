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

type RefreshOutcome = 'refreshed' | 'unauthenticated' | 'transient';

let refreshPromise: Promise<RefreshOutcome> | null = null;

function accessTokenNeedsRefresh(token: string | null): boolean {
  if (!token) return false;
  const parts = token.split('.');
  if (parts.length < 2) return true;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return payload.exp <= Math.floor(Date.now() / 1000) + 90;
  } catch {
    return true;
  }
}

function isAuthPath(path: string): boolean {
  return path.includes('/admin/auth/login') || path.includes('/admin/auth/token/refresh');
}

async function refreshAccessToken(): Promise<RefreshOutcome> {
  const { refreshToken } = getStoredTokens();
  if (!refreshToken) return 'unauthenticated';

  try {
    const res = await fetch(`${API_BASE}/admin/auth/token/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    let json: ApiSuccess<{ accessToken: string; refreshToken: string }> | ApiFailure | null = null;
    try {
      json = (await res.json()) as ApiSuccess<{
        accessToken: string;
        refreshToken: string;
      }> | ApiFailure;
    } catch {
      json = null;
    }

    if (res.ok && json && json.success) {
      setStoredTokens(json.data.accessToken, json.data.refreshToken);
      return 'refreshed';
    }

    const current = getStoredTokens().refreshToken;
    if (current && current !== refreshToken) return 'refreshed';
    if (res.status === 401 || res.status === 403) return 'unauthenticated';
    return 'transient';
  } catch {
    const current = getStoredTokens().refreshToken;
    if (current && current !== refreshToken) return 'refreshed';
    return 'transient';
  }
}

async function refreshOnce(): Promise<RefreshOutcome> {
  if (!refreshPromise) {
    const pending = refreshAccessToken().finally(() => {
      if (refreshPromise === pending) {
        refreshPromise = null;
      }
    });
    refreshPromise = pending;
  }
  return refreshPromise;
}

async function ensureFreshAccessToken(): Promise<string | null> {
  const { accessToken, refreshToken } = getStoredTokens();
  if (!accessToken && !refreshToken) return null;
  if (!accessToken || accessTokenNeedsRefresh(accessToken)) {
    const outcome = await refreshOnce();
    if (outcome !== 'refreshed') return accessToken;
  }
  return getStoredTokens().accessToken;
}

export async function authorizedFetch(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const accessToken = isAuthPath(path)
    ? getStoredTokens().accessToken
    : await ensureFreshAccessToken();
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && retry && !isAuthPath(path)) {
    const outcome = await refreshOnce();
    if (outcome === 'refreshed') {
      return authorizedFetch(path, options, false);
    }
    if (outcome === 'unauthenticated') {
      clearStoredTokens();
    }
  }

  return res;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
  retry = true,
): Promise<T> {
  const res = await authorizedFetch(path, options, retry);

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
