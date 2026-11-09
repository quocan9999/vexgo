import { vi } from 'vitest';
import viMessages from '../src/messages/vi.json';

vi.mock('next-intl', () => ({
  useLocale: () => 'vi',
  NextIntlClientProvider: ({ children }: { children?: any }) => children,
  useTranslations: (namespace?: string) => {
    const messages = namespace
      ? (viMessages as Record<string, any>)[namespace] || {}
      : viMessages;
    return (key: string, values?: Record<string, any>) => {
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
