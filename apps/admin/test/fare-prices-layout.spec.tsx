// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/fare-prices',
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

describe('Super Admin navigation for fare prices', () => {
  it('shows the current fare-price section in navigation and breadcrumb', () => {
    render(
      <SuperAdminLayout activeSection="fare-prices">
        <h1>Quản lý bảng giá vé</h1>
      </SuperAdminLayout>,
    );

    const link = screen.getByRole('link', { name: 'Bảng giá vé' });
    expect(link.getAttribute('href')).toBe('/fare-prices');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'VexGo SUPER ADMIN' })).toBeTruthy();
    expect(screen.getByText('Bảng giá vé', { selector: 'strong' })).toBeTruthy();
  });
});
