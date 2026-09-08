import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  apiRequest,
  clearStoredTokens,
  getStoredTokens,
  setStoredTokens,
} from '../api/client';
import type { AuthUser } from '../api/types';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (input: { email: string; password: string }) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const { accessToken } = getStoredTokens();
    if (!accessToken) {
      setUser(null);
      return;
    }
    const me = await apiRequest<AuthUser>('/admin/auth/me');
    if (!me.roles.includes('ADMIN')) {
      clearStoredTokens();
      setUser(null);
      throw new Error('Admin access required');
    }
    setUser(me);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { accessToken } = getStoredTokens();
        if (!accessToken) {
          if (!cancelled) setUser(null);
          return;
        }
        await refreshMe();
      } catch {
        clearStoredTokens();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshMe]);

  const login = useCallback(async (input: { email: string; password: string }) => {
    const data = await apiRequest<{
      accessToken: string;
      refreshToken: string;
      user: AuthUser;
    }>('/admin/auth/login', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    setStoredTokens(data.accessToken, data.refreshToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    clearStoredTokens();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, logout, refreshMe }),
    [user, loading, login, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
