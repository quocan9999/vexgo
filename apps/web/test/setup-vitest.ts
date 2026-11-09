import type React from 'react';
import { vi } from 'vitest';
import viMessages from '../src/messages/vi.json';

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  NextIntlClientProvider: ({ children }: { children?: React.ReactNode }) => children,
  useTranslations: (namespace?: string) => {
    const messages = (namespace
      ? (viMessages as unknown as Record<string, Record<string, string>>)[namespace] || {}
      : (viMessages as unknown as Record<string, string>));
    return (key: string, values?: Record<string, unknown>) => {
      let text = messages[key] ?? key;
      if (values && typeof text === 'string') {
        Object.entries(values).forEach(([k, v]) => {
          text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
        });
      }
      return text;
    };
  },
}));
