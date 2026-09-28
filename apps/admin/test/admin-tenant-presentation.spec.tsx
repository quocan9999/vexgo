// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/vehicle-types',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import {
  DEMO_SUPER_ADMIN,
  signInDemoAdmin,
  signInTenantPreview,
} from '@/features/admin-auth/services/demo-auth';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';

describe('admin tenant presentation mode', () => {
  afterEach(() => {
    cleanup();
    window.sessionStorage.clear();
  });

  beforeEach(() => {
    window.sessionStorage.clear();
    signInDemoAdmin(DEMO_SUPER_ADMIN.email, DEMO_SUPER_ADMIN.password);
    state.pathname = '/vehicle-types';
    replace.mockClear();
  });

  it('keeps platform navigation focused on platform scope', () => {
    render(
      <SuperAdminLayout activeSection="vehicle-types">
        <h1>Platform page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByRole('link', { name: 'Nhà xe' }).getAttribute('href')).toBe('/bus-companies');
    expect(screen.queryByRole('link', { name: 'Loại xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Tuyến xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bảng giá vé' })).toBeNull();
  });

  it('shows only the Vận hành links in tenant preview without Nhà xe', () => {
    signInTenantPreview();

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Preview page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByText('VẬN HÀNH')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Nhà xe' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Loại xe' }).getAttribute('href')).toBe('/vehicle-types');
    expect(screen.getByRole('link', { name: 'Xe' }).getAttribute('href')).toBe('/vehicles');
    const routeLink = screen.getByRole('link', { name: 'Tuyến xe' });
    expect(routeLink.getAttribute('href')).toBe('/routes');
    expect(routeLink.getAttribute('aria-current')).toBe('page');
    expect(screen.getByRole('link', { name: 'Bảng giá vé' }).getAttribute('href')).toBe('/fare-prices');
  });

  it('does not mount operational data components in tenant preview', () => {
    signInTenantPreview();
    const SensitiveManagement = vi.fn(() => <div>Tenant data list</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(screen.getByText(/Dữ liệu vận hành theo nhà xe sẽ được kết nối/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Loại xe' }).getAttribute('aria-current')).toBe('page');
    expect(screen.queryByText('Tenant data list')).toBeNull();
    expect(SensitiveManagement).not.toHaveBeenCalled();
  });

  it('does not mount platform pages in tenant preview and redirects to operations', () => {
    signInTenantPreview();
    state.pathname = '/bus-companies';
    const SensitiveManagement = vi.fn(() => <div>All bus companies</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(SensitiveManagement).not.toHaveBeenCalled();
    expect(screen.queryByText('All bus companies')).toBeNull();
    expect(replace).toHaveBeenCalledWith('/vehicle-types');
  });
});
