import { createContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api.ts';
import { setUnauthorizedHandler } from '../api/client.ts';
import { useToast } from '../hooks/useToast.ts';
import type { User, LoginInput, RegisterInput } from '../types/auth.types.ts';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginInput) => Promise<void>;
  register: (data: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Initial check of GET /api/auth/me on mount
  useEffect(() => {
    let isMounted = true;

    const checkAuth = async () => {
      try {
        const response = await authApi.getMe();
        if (isMounted) {
          setUser(response.user);
        }
      } catch {
        if (isMounted) {
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // Configure 401 unauthorized handler (Requirement 3)
  useEffect(() => {
    setUnauthorizedHandler((previousPath: string) => {
      setUser(null);
      showToast('Session expired. Please log in again.', 'error');
      navigate('/login', { state: { from: previousPath }, replace: true });
    });

    return () => {
      setUnauthorizedHandler(null);
    };
  }, [navigate, showToast]);

  const login = useCallback(async (credentials: LoginInput) => {
    const response = await authApi.login(credentials);
    setUser(response.user);
  }, []);

  const register = useCallback(async (data: RegisterInput) => {
    const response = await authApi.register(data);
    setUser(response.user);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Continue client cleanup even if network request fails
    } finally {
      setUser(null);
      navigate('/login', { replace: true });
    }
  }, [navigate]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
export type { AuthContextType };

