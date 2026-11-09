// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdminLanguageSwitcher,
  getLocalizedPath,
} from '@/components/admin/admin-language-switcher';

const mockRouter = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

const mockUsePathname = vi.hoisted(() => vi.fn(() => '/vi/trips'));

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => mockUsePathname(),
}));

describe('AdminLanguageSwitcher', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('correctly calculates localized paths with getLocalizedPath', () => {
    expect(getLocalizedPath('/vi/trips', 'en')).toBe('/en/trips');
    expect(getLocalizedPath('/en/trips', 'vi')).toBe('/vi/trips');
    expect(getLocalizedPath('/trips', 'en')).toBe('/en/trips');
    expect(getLocalizedPath('/', 'en')).toBe('/en');
  });

  it('renders default Vietnamese locale badge', () => {
    render(<AdminLanguageSwitcher />);
    expect(screen.getByText('VI')).toBeTruthy();
  });

  it('renders English locale badge when value is en', () => {
    render(<AdminLanguageSwitcher value="en" />);
    expect(screen.getByText('EN')).toBeTruthy();
  });

  it('opens popover and triggers navigation when selecting English', () => {
    const handleChange = vi.fn();
    render(<AdminLanguageSwitcher onChange={handleChange} />);

    // Click trigger button
    const trigger = screen.getByRole('button', { name: /ngôn ngữ/i });
    fireEvent.click(trigger);

    // Click English option
    const englishBtn = screen.getByRole('menuitem', { name: /English/i });
    fireEvent.click(englishBtn);

    expect(handleChange).toHaveBeenCalledWith('en');
    expect(mockRouter.replace).toHaveBeenCalledWith('/en/trips');
  });
});
