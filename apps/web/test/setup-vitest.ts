import type React from 'react';
import { vi } from 'vitest';
import viMessages from '../src/messages/vi.json';
import enMessages from '../src/messages/en.json';

let currentLocale = 'vi';
let currentMessages: Record<string, unknown> = viMessages as Record<string, unknown>;

export function setTestLocale(locale: 'vi' | 'en') {
  currentLocale = locale;
  currentMessages = (locale === 'en' ? enMessages : viMessages) as Record<string, unknown>;
}

vi.mock('next-intl', () => ({
  useLocale: () => currentLocale,
  NextIntlClientProvider: ({
    locale,
    messages,
    children,
  }: {
    locale?: string;
    messages?: Record<string, unknown>;
    children?: React.ReactNode;
  }) => {
    if (locale) currentLocale = locale;
    if (messages) currentMessages = messages;
    return children;
  },
  useTranslations: (namespace?: string) => {
    const t = (key: string, values?: Record<string, unknown>) => {
      const keys = namespace ? `${namespace}.${key}`.split('.') : key.split('.');
      let val: unknown = currentMessages;
      for (const k of keys) {
        val = (val as Record<string, unknown>)?.[k];
      }
      if (typeof val === 'string') {
        let text = val;
        if (values) {
          Object.entries(values).forEach(([k, v]) => {
            text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
          });
        }
        return text;
      }
      return key;
    };
    t.rich = (key: string, values?: Record<string, unknown>) => t(key, values);
    t.markup = (key: string, values?: Record<string, unknown>) => t(key, values);
    return t;
  },
}));
