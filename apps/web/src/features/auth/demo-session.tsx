/* eslint-disable */
'use client';

import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { DemoUser, DemoSessionState, createDemoSessionStore } from './demo-session-state';

type DemoSessionContextValue = DemoSessionState & {
  signIn: (user?: Partial<DemoUser>) => void;
  signOut: () => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DemoSessionState>(() => createDemoSessionStore().getState());

  useEffect(() => {
    setState(createDemoSessionStore(window.localStorage).getState());
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      signIn: (nextUser: Partial<DemoUser> = {}) => {
        const store = createDemoSessionStore(window.localStorage);
        store.signIn(nextUser);
        setState(store.getState());
      },
      signOut: () => {
        const store = createDemoSessionStore(window.localStorage);
        store.signOut();
        setState(store.getState());
      },
    }),
    [state],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const context = useContext(DemoSessionContext);
  if (!context) throw new Error('useDemoSession must be used inside DemoSessionProvider');
  return context;
}
