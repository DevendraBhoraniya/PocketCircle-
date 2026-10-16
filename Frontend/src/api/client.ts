const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export async function apiClient(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    ...options,
    credentials: 'include', // Always send cookies
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  return fetch(url, defaultOptions);
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
