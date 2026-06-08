import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import { api } from '../services/api';
import type { AuthUser } from '../types/api';

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
}

// ─── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * AuthProvider wraps the entire app and provides auth state to all components.
 *
 * HOW IT WORKS:
 * - Stores the access token in localStorage (persists across page refreshes)
 * - Stores user info in component state
 * - Exposes login(), register(), logout() functions
 * - Any component can call useAuth() to read auth state or trigger auth actions
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    // Initialize from localStorage — so if user refreshes the page,
    // they are still "logged in" (the token is still there)
    const token = localStorage.getItem('accessToken');
    return {
      user: null,
      accessToken: token,
      isAuthenticated: !!token,
      isLoading: false,
    };
  });

  useEffect(() => {
    const fetchMe = async () => {
      if (!state.accessToken) return;
      try {
        setState(s => ({ ...s, isLoading: true }));
        const user = await api.auth.me();
        setState(s => ({
          ...s,
          user: user ?? null,
          isAuthenticated: true,
          isLoading: false,
        }));
      } catch (err) {
        console.error('Failed to restore user session:', err);
        localStorage.removeItem('accessToken');
        setState({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      }
    };

    if (state.accessToken && !state.user) {
      fetchMe();
    }
  }, [state.accessToken, state.user]);

  const login = useCallback(async (email: string, password: string) => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const response = await api.auth.login({ email, password });

      if (!response.success || !response.accessToken) {
        throw new Error(response.error ?? 'Login failed');
      }

      // Persist token in localStorage for page refresh
      localStorage.setItem('accessToken', response.accessToken);

      setState({
        user: response.user ?? null,
        accessToken: response.accessToken,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch (err) {
      setState(s => ({ ...s, isLoading: false }));
      throw err; // re-throw so LoginPage can display the error
    }
  }, []);

  const register = useCallback(async (
    email: string,
    fullName: string,
    password: string,
    confirmPassword: string
  ) => {
    setState(s => ({ ...s, isLoading: true }));
    try {
      const response = await api.auth.register({ email, fullName, password, confirmPassword });

      if (!response.success) {
        throw new Error(response.error ?? 'Registration failed');
      }

      setState(s => ({ ...s, isLoading: false }));
      // Note: we don't log in automatically after register
      // User is redirected to /login to sign in explicitly
    } catch (err) {
      setState(s => ({ ...s, isLoading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      // Tell server to clear the refresh token from DB
      await api.auth.logout();
    } catch {
      // Even if the server call fails, we still clear the local token
    } finally {
      localStorage.removeItem('accessToken');
      setState({
        user: null,
        accessToken: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────────────────────────

/**
 * useAuth() — hook to access auth state and actions from any component.
 *
 * Usage:
 *   const { isAuthenticated, user, login, logout } = useAuth();
 *
 * Must be used inside <AuthProvider> (which wraps the entire app).
 */
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth() must be called inside <AuthProvider>');
  }
  return ctx;
}
