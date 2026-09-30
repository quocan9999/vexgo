'use client';

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
  type AuthState,
  type AuthUser,
} from './auth-session-state';

export type { AuthState, AuthUser } from './auth-session-state';

type AuthSessionContextValue = AuthState & {
  signIn: (data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  signOut: () => void;
};

const AuthSessionContext = createContext<AuthSessionContextValue | null>(null);

export function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    isHydrated: false,
  });

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setState(readStoredAuth(window.localStorage));
    });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      signIn: (data: {
        user: AuthUser;
        accessToken: string;
        refreshToken: string;
      }) => {
        const nextState = {
          user: data.user,
          accessToken: data.accessToken,
          isAuthenticated: true,
          isHydrated: true,
        };
        setState(nextState);
        try {
          writeStoredAuth(window.localStorage, data);
        } catch {}
      },
      signOut: () => {
        const currentToken = state.accessToken;
        const nextState = {
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isHydrated: true,
        };
        // Call the logout API endpoint; clear local state regardless of outcome
        const doLogout = async () => {
          try {
            await fetch(
              `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1'}/auth/logout`,
              {
                method: 'POST',
                headers: currentToken
                  ? { Authorization: `Bearer ${currentToken}` }
                  : {},
              },
            );
          } catch {
            // ignore network errors – local session must still be cleared
          }
        };
        void doLogout();
        setState(nextState);
        try {
          clearStoredAuth(window.localStorage);
        } catch {}
      },
    }),
    [state],
  );

  return (
    <AuthSessionContext.Provider value={value}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext);
  if (!context)
    throw new Error('useAuthSession must be used inside AuthSessionProvider');
  return context;
}
