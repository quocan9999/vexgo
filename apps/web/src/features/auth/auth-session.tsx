'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';

export type AuthUser = {
  accountId: number;
  customerId: number | null;
  fullName: string;
  phoneNumber: string;
  roles: string[];
};

export type AuthState = {
  user: AuthUser | null;
  accessToken: string | null;
  isAuthenticated: boolean;
};

type AuthSessionContextValue = AuthState & {
  signIn: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => void;
  signOut: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export const AUTH_STORAGE_KEY = 'vexgo:auth';

function readStoredAuth(): AuthState {
  if (typeof window === 'undefined') return { user: null, accessToken: null, isAuthenticated: false };
  try {
    const stored = window.localStorage.getItem(AUTH_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.accessToken && parsed.user) {
        return {
          user: parsed.user,
          accessToken: parsed.accessToken,
          isAuthenticated: true,
        };
      }
    }
  } catch (error) {
    console.error('Lỗi khi đọc token từ localStorage:', error);
  }
  return { user: null, accessToken: null, isAuthenticated: false };
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, accessToken: null, isAuthenticated: false });

  useEffect(() => {
    setState(readStoredAuth());
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      signIn: (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
        const nextState = { user: data.user, accessToken: data.accessToken, isAuthenticated: true };
        setState(nextState);
        try {
          window.localStorage.setItem(
            AUTH_STORAGE_KEY,
            JSON.stringify({
              user: data.user,
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
            })
          );
        } catch {}
      },
      signOut: () => {
        setState({ user: null, accessToken: null, isAuthenticated: false });
        try {
          window.localStorage.removeItem(AUTH_STORAGE_KEY);
        } catch {}
      },
    }),
    [state]
  );

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>;
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context) throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return context;
}
