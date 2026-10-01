'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
} from 'react';
import {
  clearStoredAuth,
  readStoredAuth,
  writeStoredAuth,
  type AuthState,
  type AuthUser,
} from './auth-session-state';
import { authApi } from './services/auth.api';
import { runWithAuthRetry, type TokenPair } from './services/auth-retry';

export type { AuthState, AuthUser } from './auth-session-state';

type AuthSessionContextValue = AuthState & {
  signIn: (data: {
    user: AuthUser;
    accessToken: string;
    refreshToken: string;
  }) => void;
  signOut: () => void;
  refreshSession: () => Promise<string | null>;
  executeWithAuth: <T>(action: (token: string) => Promise<T>) => Promise<T>;
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
    refreshToken: null,
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

  const signIn = useCallback(
    (data: { user: AuthUser; accessToken: string; refreshToken: string }) => {
      const nextState = {
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        isAuthenticated: true,
        isHydrated: true,
      };
      setState(nextState);
      try {
        writeStoredAuth(window.localStorage, data);
      } catch {}
    },
    [],
  );

  const signOut = useCallback(() => {
    const currentToken = state.accessToken;
    const currentRefreshToken = state.refreshToken;
    const nextState = {
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isHydrated: true,
    };
    void authApi.logout(currentRefreshToken, currentToken);
    setState(nextState);
    try {
      clearStoredAuth(window.localStorage);
    } catch {}
  }, [state.accessToken, state.refreshToken]);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    const currentRefreshToken = state.refreshToken;
    if (!currentRefreshToken) {
      signOut();
      return null;
    }
    try {
      const res = await authApi.refresh(currentRefreshToken);
      const newTokens = res.data;
      if (state.user) {
        const nextState = {
          user: state.user,
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          isAuthenticated: true,
          isHydrated: true,
        };
        setState(nextState);
        try {
          writeStoredAuth(window.localStorage, {
            user: state.user,
            accessToken: newTokens.accessToken,
            refreshToken: newTokens.refreshToken,
          });
        } catch {}
        return newTokens.accessToken;
      }
      signOut();
      return null;
    } catch {
      signOut();
      return null;
    }
  }, [state.refreshToken, state.user, signOut]);

  const executeWithAuth = useCallback(
    async <T,>(action: (token: string) => Promise<T>): Promise<T> => {
      return runWithAuthRetry(action, {
        getTokens: () => ({
          accessToken: state.accessToken,
          refreshToken: state.refreshToken,
        }),
        onRefresh: (newTokens: TokenPair) => {
          if (state.user) {
            const nextState = {
              user: state.user,
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              isAuthenticated: true,
              isHydrated: true,
            };
            setState(nextState);
            try {
              writeStoredAuth(window.localStorage, {
                user: state.user,
                accessToken: newTokens.accessToken,
                refreshToken: newTokens.refreshToken,
              });
            } catch {}
          }
        },
        onAuthFailed: () => {
          signOut();
        },
        refreshFn: (rt) => authApi.refresh(rt),
      });
    },
    [state.accessToken, state.refreshToken, state.user, signOut],
  );

  const value = useMemo(
    () => ({
      ...state,
      signIn,
      signOut,
      refreshSession,
      executeWithAuth,
    }),
    [state, signIn, signOut, refreshSession, executeWithAuth],
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
