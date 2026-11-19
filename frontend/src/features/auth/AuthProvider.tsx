
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { login } from './auth.api';
import { AuthContext } from './AuthContext';
import type { AuthUser, LoginCredentials } from './auth.types';

interface AuthSession {
  accessToken: string;
  user: AuthUser;
  expiresAt: number;
}

export default function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [session, setSession] = useState<AuthSession | null>(null);

  const signIn = useCallback(async (credentials: LoginCredentials) => {
    const response = await login(credentials);

    setSession({
      accessToken: response.accessToken,
      user: response.user,
      expiresAt: Date.now() + response.expiresIn * 1000,
    });
  }, []);

  const signOut = useCallback(() => {
    setSession(null);
  }, []);

  useEffect(() => {
    if (!session) return;

    const remaining = Math.max(0, session.expiresAt - Date.now());

    const timeoutId = window.setTimeout(() => {
      setSession((current) =>
        current === session ? null : current,
      );
    }, remaining);

    return () => window.clearTimeout(timeoutId);
  }, [session]);

  const value = useMemo(
  () => ({
    user: session?.user ?? null,
    accessToken: session?.accessToken ?? null,
    isAuthenticated: session !== null,
    signIn,
    signOut,
  }),
  [session, signIn, signOut],
);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
