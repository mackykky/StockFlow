
import { useCallback } from 'react';
import { useAuth } from '../features/auth/useAuth';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');


export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);

    this.name = 'ApiError';
    this.status = status;
  }
}


export function useApi() {
  const { accessToken, signOut } = useAuth();

  const request = useCallback(
    async <T>(
      endpoint: string,
      options: RequestInit = {},
    ): Promise<T> => {
      if (!accessToken) {
        throw new ApiError('You must sign in to continue.', 401);
      }

      const headers = new Headers(options.headers);

      headers.set('Authorization', `Bearer ${accessToken}`);

      // Only set JSON content type when sending JSON data.
      if (options.body && !headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
      }

      let response: Response;

      try {
        response = await fetch(
          `${API_BASE_URL}/${endpoint.replace(/^\/+/, '')}`,
          {
            ...options,
            headers,
          },
        );
      } catch {
        throw new ApiError(
          'Unable to connect to the server. Please check your connection.',
          0,
        );
      }

      if (response.status === 401) {
        signOut();

        throw new ApiError(
          'Your session has expired. Please sign in again.',
          401,
        );
      }

      if (response.status === 403) {
        throw new ApiError(
          'You do not have permission to perform this action.',
          403,
        );
      }

      if (response.status === 429) {
        throw new ApiError(
          'Too many requests. Please try again later.',
          429,
        );
      }

      if (response.status === 409) {
        const details = await response.json().catch(() => null);
        throw new ApiError(typeof details?.message === "string" ? details.message : "The record has changed. Refresh and try again.", 409);
      }

      if (!response.ok) {
        throw new ApiError(
          `Request failed with status ${response.status}.`,
          response.status,
        );
      }

      if (response.status === 204) {
        return undefined as T;
      }

      return (await response.json()) as T;
    },
    [accessToken, signOut],
  );

  return { request };
}
