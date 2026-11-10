// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace, refresh } = vi.hoisted(() => ({
  state: {
    pathname: '/',
  },
  replace: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace, refresh }),
}));

import {
  CustomerLanguageSwitcher,
  getLocalizedPath,
} from '@/components/layout/customer-language-switcher';

describe('CustomerLanguageSwitcher', () => {
  beforeEach(() => {
    cleanup();
    state.pathname = '/';
    replace.mockReset();
    refresh.mockReset();
    document.cookie = '';
  });

  afterEach(() => {
    cleanup();
  });

  describe('getLocalizedPath', () => {
    it('prepends new locale to root path', () => {
      expect(getLocalizedPath('/', 'en')).toBe('/en');
      expect(getLocalizedPath('/', 'vi')).toBe('/vi');
    });

    it('switches locale in paths that already have a locale prefix', () => {
      expect(getLocalizedPath('/vi/trips', 'en')).toBe('/en/trips');
      expect(getLocalizedPath('/en/account/tickets', 'vi')).toBe(
        '/vi/account/tickets',
      );
      expect(getLocalizedPath('/vi', 'en')).toBe('/en');
    });

    it('adds locale to non-prefixed paths', () => {
      expect(getLocalizedPath('/trips', 'en')).toBe('/en/trips');
      expect(getLocalizedPath('/promotions', 'vi')).toBe('/vi/promotions');
    });
  });

  describe('desktop switcher', () => {
    it('renders current language badge VI by default', () => {
      state.pathname = '/';
      render(<CustomerLanguageSwitcher />);

      const button = screen.getByRole('button', {
        name: /đổi ngôn ngữ/i,
      });
      expect(button).toBeTruthy();
      expect(screen.getByText('VI')).toBeTruthy();
    });

    it('renders current language badge EN when pathname starts with /en', () => {
      state.pathname = '/en/trips';
      render(<CustomerLanguageSwitcher />);

      expect(screen.getByText('EN')).toBeTruthy();
    });

    it('opens dropdown when clicked and switches to EN', () => {
      state.pathname = '/trips';
      render(<CustomerLanguageSwitcher />);

      const trigger = screen.getByRole('button', {
        name: /đổi ngôn ngữ/i,
      });
      fireEvent.click(trigger);

      expect(screen.getByRole('listbox')).toBeTruthy();
      expect(screen.getByText('Tiếng Việt')).toBeTruthy();
      expect(screen.getByText('English')).toBeTruthy();

      const enOption = screen.getByRole('option', { name: /english/i });
      fireEvent.click(enOption);

      expect(replace).toHaveBeenCalledWith('/en/trips');
      expect(document.cookie).toContain('NEXT_LOCALE=en');
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });

  describe('mobile switcher', () => {
    it('renders both language buttons directly for mobile drawer', () => {
      state.pathname = '/account/tickets';
      render(<CustomerLanguageSwitcher isMobile />);

      expect(screen.getByText('Ngôn ngữ / Language')).toBeTruthy();
      const viButton = screen.getByRole('button', { name: /tiếng việt/i });
      const enButton = screen.getByRole('button', { name: /english/i });
      expect(viButton).toBeTruthy();
      expect(enButton).toBeTruthy();

      fireEvent.click(enButton);
      expect(replace).toHaveBeenCalledWith('/en/account/tickets');
      expect(document.cookie).toContain('NEXT_LOCALE=en');
    });
  });
});
