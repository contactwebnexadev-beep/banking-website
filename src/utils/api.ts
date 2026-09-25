/**
 * Safe fetch & JSON parsing utility
 * Prevents "Unexpected end of JSON input" errors by inspecting HTTP response streams
 * and handling empty or non-JSON payloads gracefully.
 */

export interface SafeApiResponse<T = any> {
  data: T;
  ok: boolean;
  status: number;
  error?: string;
}

export async function safeParseResponse<T = any>(res: Response): Promise<SafeApiResponse<T>> {
  let data: any = {};
  let error: string | undefined = undefined;

  try {
    const text = await res.text();
    if (text && text.trim().length > 0) {
      try {
        data = JSON.parse(text);
      } catch {
        // Response was text or HTML rather than valid JSON
        data = { error: text };
        error = text;
      }
    } else {
      // Empty response body (e.g. 204 No Content or closed connection)
      data = {};
      if (!res.ok) {
        error = `Server returned an empty response (HTTP status ${res.status}).`;
      }
    }
  } catch (err: any) {
    data = {};
    error = err?.message || 'Failed to read response stream.';
  }

  if (!res.ok) {
    error = data?.error || error || `Request failed with status code ${res.status}.`;
  }

  return {
    data,
    ok: res.ok,
    status: res.status,
    error,
  };
}

/**
 * Retrieve the active authentication token from localStorage or sessionStorage.
 * Checks all supported key conventions ('boa_auth_token', 'boa_token')
 * ensuring compatibility across components and iframe contexts.
 */
export function getStoredAuthToken(): string {
  if (typeof window === 'undefined') return '';
  return (
    localStorage.getItem('boa_auth_token') ||
    localStorage.getItem('boa_token') ||
    sessionStorage.getItem('boa_auth_token') ||
    sessionStorage.getItem('boa_token') ||
    ''
  );
}

/**
 * Persist the auth token to all standard client storage keys.
 */
export function setStoredAuthToken(token: string): void {
  if (typeof window === 'undefined' || !token) return;
  try {
    localStorage.setItem('boa_auth_token', token);
    localStorage.setItem('boa_token', token);
    sessionStorage.setItem('boa_auth_token', token);
    sessionStorage.setItem('boa_token', token);
  } catch (e) {
    console.warn('Unable to persist auth token to web storage:', e);
  }
}

/**
 * Clear stored auth tokens upon sign out.
 */
export function clearStoredAuthToken(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem('boa_auth_token');
    localStorage.removeItem('boa_token');
    sessionStorage.removeItem('boa_auth_token');
    sessionStorage.removeItem('boa_token');
  } catch (e) {
    console.warn('Unable to remove auth token from web storage:', e);
  }
}

/**
 * Build request headers including the Bearer Authorization header if a token exists.
 */
export function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  const token = getStoredAuthToken();
  return {
    ...extraHeaders,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
