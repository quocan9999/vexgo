import { useSyncExternalStore } from 'react';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';

type TestSessionState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'error'; message: string }
  | { status: 'authenticated'; session: Record<string, unknown> };

const platformSession = {
  accountId: 1,
  fullName: 'Super Admin',
  phoneNumber: '+84900000001',
  email: 'admin@vexgo.test',
  roles: ['SUPER_ADMIN'],
  permissions: [],
  employee: null,
  busCompanyId: null,
};

const mockAdminSession = vi.hoisted(() => ({
  state: null as TestSessionState | null,
  listeners: new Set<() => void>(),
}));

import viMessages from '../src/messages/vi.json';
import enMessages from '../src/messages/en.json';

let currentTestLocale = 'vi';

export function setTestLocale(locale: 'vi' | 'en') {
  currentTestLocale = locale;
}

export function getTestLocale() {
  return currentTestLocale;
}

vi.mock('next-intl', () => ({
  useTranslations: (namespace?: string) => {
    return (key: string, values?: Record<string, any>) => {
      const keys = namespace ? `${namespace}.${key}`.split('.') : key.split('.');
      const messages = currentTestLocale === 'en' ? enMessages : viMessages;
      let val: any = messages;
      for (const k of keys) {
        val = val?.[k];
      }
      if (typeof val === 'string') {
        if (values) {
          return Object.entries(values).reduce(
            (acc, [k, v]) => acc.replace(`{${k}}`, String(v)),
            val,
          );
        }
        return val;
      }
      return key;
    };
  },
  useLocale: () => currentTestLocale,
  NextIntlClientProvider: ({
    locale,
    children,
  }: {
    locale?: string;
    children: React.ReactNode;
  }) => {
    if (locale === 'en' || locale === 'vi') {
      currentTestLocale = locale;
    }
    return children;
  },
}));

vi.mock('@/features/admin-auth/hooks/use-admin-session', () => {
  return {
    useAdminSession: () =>
      useSyncExternalStore(
        (listener) => {
          mockAdminSession.listeners.add(listener);
          return () => mockAdminSession.listeners.delete(listener);
        },
        () => mockAdminSession.state,
        () => mockAdminSession.state,
      ),
  };
});

function publishAdminTestSession(state: TestSessionState) {
  mockAdminSession.state = state;
  mockAdminSession.listeners.forEach((listener) => listener());
}

export function resetAdminTestSession() {
  currentTestLocale = 'vi';
  publishAdminTestSession({
    status: 'authenticated',
    session: platformSession,
  });
}

export function setAdminTestSession(state: TestSessionState) {
  publishAdminTestSession(state);
}

export function setEmployeeAdminTestSession(permissions: string[]) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 2,
      fullName: 'Nhân viên CSKH',
      phoneNumber: '+84900000002',
      email: 'cskh@vexgo.test',
      roles: ['NHAN_VIEN_CSKH'],
      permissions,
      employee: {
        employeeId: 2,
        busCompanyId: 10,
        busCompanyCode: 'FUTA',
        busCompanyName: 'Phương Trang',
      },
      busCompanyId: 10,
    },
  });
}

beforeEach(() => {
  // JSDOM has no media-query engine. Keep the native API shape available for
  // responsive primitives; tests may still supply their own viewport mock.
  if (typeof window !== 'undefined' && !window.matchMedia) {
    window.matchMedia = (media: string): MediaQueryList => {
      const events = new EventTarget();
      return {
        media,
        get matches() {
          const minimum = /min-width:\s*(\d+)px/.exec(media);
          const maximum = /max-width:\s*(\d+)px/.exec(media);
          return (
            (!minimum || window.innerWidth >= Number(minimum[1])) &&
            (!maximum || window.innerWidth <= Number(maximum[1])) &&
            !media.includes('prefers-reduced-motion')
          );
        },
        onchange: null,
        addListener: (listener) => events.addEventListener('change', listener as EventListener),
        removeListener: (listener) => events.removeEventListener('change', listener as EventListener),
        addEventListener: events.addEventListener.bind(events),
        removeEventListener: events.removeEventListener.bind(events),
        dispatchEvent: events.dispatchEvent.bind(events),
      };
    };
  }
  resetAdminTestSession();
});

afterEach(() => {
  if (typeof window !== 'undefined') {
    cleanup();
  }
});
