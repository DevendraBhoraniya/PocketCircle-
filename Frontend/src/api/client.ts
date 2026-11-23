const API_BASE_URL = import.meta.env.VITE_API_URL !== undefined
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? 'http://localhost:8000' : '');

export interface ApiClientOptions extends RequestInit {
  _isRetry?: boolean;
  skipCache?: boolean;
}

interface CachedResponsePayload {
  body: string;
  status: number;
  statusText: string;
  headers: [string, string][];
  timestamp: number;
}

const API_CACHE_TTL_MS = 20_000; // 20-second client cache for instant tab navigation
const apiCache = new Map<string, CachedResponsePayload>();
const inFlightRequests = new Map<string, Promise<Response>>();

export function invalidateApiCache(prefix?: string) {
  if (!prefix) {
    apiCache.clear();
    return;
  }
  for (const key of apiCache.keys()) {
    if (key.includes(prefix)) {
      apiCache.delete(key);
    }
  }
}

function createResponseFromCache(cached: CachedResponsePayload): Response {
  return new Response(cached.body, {
    status: cached.status,
    statusText: cached.statusText,
    headers: new Headers(cached.headers),
  });
}

let activeRefreshPromise: Promise<boolean> | null = null;
let unauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedCallback(callback: (() => void) | null) {
  unauthorizedCallback = callback;
}

async function requestSessionRefresh(): Promise<boolean> {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

const NO_AUTO_REFRESH_ENDPOINTS = [
  '/auth/refresh',
  '/auth/login',
  '/auth/register',
  '/auth/verify-otp',
  '/auth/resend-otp',
  '/auth/logout',
  '/auth/google',
];

export async function apiClient(endpoint: string, options: ApiClientOptions = {}): Promise<Response> {
  const url = `${API_BASE_URL}${endpoint}`;
  const { _isRetry, skipCache, ...fetchOptions } = options;
  const method = (fetchOptions.method || 'GET').toUpperCase();

  // Invalidate client cache on any mutating request (POST, PUT, PATCH, DELETE)
  if (method !== 'GET' && method !== 'HEAD') {
    invalidateApiCache();
  }

  // Fast-path: return cached response if fresh (GET only)
  if (method === 'GET' && !skipCache) {
    const cached = apiCache.get(endpoint);
    if (cached && Date.now() - cached.timestamp < API_CACHE_TTL_MS) {
      return createResponseFromCache(cached);
    }

    // Deduplicate concurrent in-flight GET requests
    const inFlight = inFlightRequests.get(endpoint);
    if (inFlight) {
      const res = await inFlight;
      return res.clone();
    }
  }

  const executeFetch = async (): Promise<Response> => {
    const defaultOptions: RequestInit = {
      ...fetchOptions,
      credentials: 'include', // Always send session cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...fetchOptions.headers,
      },
    };

    const response = await fetch(url, defaultOptions);

    // If 401 Unauthorized, check if this request should attempt token refresh
    const isExcluded = NO_AUTO_REFRESH_ENDPOINTS.some((prefix) => endpoint.startsWith(prefix));

    if (response.status === 401 && !isExcluded) {
      if (!_isRetry) {
        const refreshed = await requestSessionRefresh();
        if (refreshed) {
          // Retry original request once with fresh tokens in cookies
          return apiClient(endpoint, {
            ...options,
            _isRetry: true,
          });
        }
      }

      // Refresh failed or retry still unauthorized; notify auth context to clear stale user session
      if (unauthorizedCallback) {
        unauthorizedCallback();
      }
    }

    // Cache successful GET responses
    if (response.ok && method === 'GET' && !skipCache) {
      try {
        const clone = response.clone();
        const body = await clone.text();
        const headers = Array.from(clone.headers.entries());
        apiCache.set(endpoint, {
          body,
          status: clone.status,
          statusText: clone.statusText,
          headers,
          timestamp: Date.now(),
        });
      } catch {
        // Stream reading failed, bypass caching
      }
    }

    return response;
  };

  if (method === 'GET' && !skipCache) {
    const fetchPromise = executeFetch().finally(() => {
      inFlightRequests.delete(endpoint);
    });
    inFlightRequests.set(endpoint, fetchPromise);
    const result = await fetchPromise;
    return result.clone();
  }

  return await executeFetch();
}

export async function getErrorMessage(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'detail' in body &&
      typeof body.detail === 'string'
    ) {
      return body.detail;
    }
  } catch {
    // The server may return an empty or non-JSON error response.
  }

  return fallback;
}
