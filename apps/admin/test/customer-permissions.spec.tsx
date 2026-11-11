// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CustomersManagement } from '@/features/customers/components/customers-management';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { setAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customers',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

function makeTenantSession(permissions: string[]) {
  return {
    accountId: 2,
    fullName: 'Quản lý FUTA',
    phoneNumber: '+84900000002',
    email: 'futa@vexgo.test',
    roles: ['NHA_XE_ADMIN'],
    permissions,
    employee: {
      employeeId: 1,
      busCompanyId: 10,
      busCompanyCode: 'FUTA',
      busCompanyName: 'Phương Trang',
    },
    busCompanyId: 10,
  };
}

describe('Customer permissions and navigation gating', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows customer navigation link only when tenant has customer:read permission', () => {
    // 1. Without customer:read
    setAdminTestSession({
      status: 'authenticated',
      session: makeTenantSession(['route:read', 'fare-price:read']),
    });

    const { rerender } = render(
      <SuperAdminLayout activeSection="routes">
        <div>Content</div>
      </SuperAdminLayout>,
    );

    expect(screen.queryByRole('link', { name: /khách hàng/i })).toBeNull();

    // 2. With customer:read
    setAdminTestSession({
      status: 'authenticated',
      session: makeTenantSession(['route:read', 'customer:read']),
    });

    rerender(
      <SuperAdminLayout activeSection="customers">
        <div>Content</div>
      </SuperAdminLayout>,
    );

    expect(screen.getByRole('link', { name: /khách hàng/i })).toBeTruthy();
  });

  it('keeps customer directory strictly read-only without create or mutation actions', async () => {
    setAdminTestSession({
      status: 'authenticated',
      session: makeTenantSession(['customer:read']),
    });

    // Mock global fetch for empty list
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: [],
        meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 },
      }),
    } as Response);

    try {
      render(<CustomersManagement />);

      // Verify no create action in header
      expect(screen.queryByRole('button', { name: /thêm/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /tạo/i })).toBeNull();
      // Verify refresh action exists
      expect(screen.getByRole('button', { name: /làm mới/i })).toBeTruthy();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
