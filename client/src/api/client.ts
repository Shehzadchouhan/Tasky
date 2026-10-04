import type { ApiErrorResponse, ValidationErrorDetail } from '../types/api.types.ts';

export class ApiClientError extends Error {
  status: number;
  details?: ValidationErrorDetail[];

  constructor(message: string, status: number, details?: ValidationErrorDetail[]) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.details = details;
  }
}

type UnauthorizedHandler = (currentPath: string) => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

export interface RequestOptions extends RequestInit {
  skipAuthRedirect?: boolean;
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { skipAuthRedirect = false, headers, ...restOptions } = options;

  const url = endpoint.startsWith('http')
    ? endpoint
    : `${BASE_URL.replace(/\/+$/, '')}/${endpoint.replace(/^\/+/, '')}`;

  const requestHeaders = new Headers(headers);
  if (!requestHeaders.has('Content-Type') && !(restOptions.body instanceof FormData)) {
    requestHeaders.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...restOptions,
      headers: requestHeaders,
      credentials: 'include',
    });
  } catch (err) {
    throw new ApiClientError(
      err instanceof Error ? err.message : 'Network error. Please check your connection.',
      0
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  let data: any;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorData = (typeof data === 'object' && data !== null ? data : {}) as Partial<ApiErrorResponse>;
    const errorMessage = errorData.error || response.statusText || 'An unexpected error occurred';
    const details = errorData.details;

    // Trigger unauthorized callback on 401 if not an exempted check (like initial /me)
    const isMeEndpoint = endpoint.includes('/auth/me');
    if (response.status === 401 && !skipAuthRedirect && !isMeEndpoint) {
      if (unauthorizedHandler) {
        const currentPath = window.location.pathname + window.location.search;
        unauthorizedHandler(currentPath);
      }
    }

    throw new ApiClientError(errorMessage, response.status, details);
  }

  return data as T;
}
