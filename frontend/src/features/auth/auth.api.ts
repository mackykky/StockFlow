
import type {
  LoginCredentials,
  LoginResponse,
} from './auth.types';

const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ??
  'http://localhost:3000'
).replace(/\/$/, '');

export async function login(
  credentials: LoginCredentials,
): Promise<LoginResponse> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid email or password.');
    }

    if (response.status === 429) {
      throw new Error(
        'Too many login attempts. Please try again later.',
      );
    }

    throw new Error(
      'Unable to sign in. Please try again.',
    );
  }

  return (await response.json()) as LoginResponse;
}
