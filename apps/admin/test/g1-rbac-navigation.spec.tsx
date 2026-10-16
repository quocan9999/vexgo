// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminSession } from '@/features/admin-auth/services/admin-auth';
import {
  ADMIN_OPERATION_SECTIONS,
  getFirstAccessibleAdminPath,
  getRequiredAdminPermissions,
  hasAdminPermission,
} from '@/features/admin-auth/services/admin-access';
import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  setAdminTestSession,
  setEmployeeAdminTestSession,
} from './admin-auth-test-session';

const { route, replace } = vi.hoisted(() => ({
  route: { pathname: '/promotions' },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => route.pathname,
  useRouter: () => ({ replace }),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock(
  '@/features/admin-auth/services/admin-auth',
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import('@/features/admin-auth/services/admin-auth')
    >()),
    initializeAdminSession: vi.fn(async () => null),
  }),
);

beforeEach(() => {
  replace.mockClear();
  route.pathname = '/promotions';
  localStorage.clear();
});
afterEach(cleanup);

describe('G1 merged tenant navigation and route guards', () => {
  it.each([
    {
      permissions: ['promotion:read'],
      labels: ['Khuyến mãi'],
      active: 'promotions',
    },
    {
      permissions: ['shipment:read'],
      labels: ['Gửi hàng'],
      active: 'shipments',
    },
    {
      permissions: ['promotion:read', 'shipment:read'],
      labels: ['Khuyến mãi', 'Gửi hàng'],
      active: 'shipments',
    },
    {
      permissions: ['promotion:create', 'promotion:update', 'shipment:update'],
      labels: [],
      active: 'promotions',
    },
  ] as const)(
    'renders only readable menus for $permissions',
    ({ permissions, labels, active }) => {
      setEmployeeAdminTestSession([...permissions]);
      const { container } = render(
        <SuperAdminLayout activeSection={active}>Nội dung</SuperAdminLayout>,
      );
      const sidebar = within(
        screen.getByRole('complementary', { name: 'Điều hướng quản trị' }),
      );
      for (const [label, href] of [
        ['Khuyến mãi', '/promotions'],
        ['Gửi hàng', '/shipments'],
      ]) {
        const links = sidebar.queryAllByRole('link', { name: label });
        expect(links).toHaveLength(
          (labels as readonly string[]).includes(label) ? 1 : 0,
        );
        if (links.length) {
          expect(links[0].getAttribute('href')).toBe(href);
          expect(links[0].getAttribute('aria-current')).toBe(
            href === `/${active}` ? 'page' : null,
          );
        }
      }
      expect(screen.getAllByRole('main')).toHaveLength(1);
      expect(container.querySelectorAll('.admin-shell')).toHaveLength(1);
    },
  );

  it.each([
    ['/promotions', 'promotion:read'],
    ['/promotions/15', 'promotion:read'],
    ['/shipments', 'shipment:read'],
    ['/shipments/15', 'shipment:read'],
  ])('requires the matching read permission at %s', (path, permission) => {
    expect(getRequiredAdminPermissions(path)).toEqual([permission]);
  });

  it.each([
    '/promotions-extra',
    '/shipments-extra',
    '/promotions%2F15',
    '/shipments%2F15',
  ])('does not match unsafe route prefix %s', (path) => {
    expect(getRequiredAdminPermissions(path)).toBeNull();
  });

  it.each([
    { permissions: ['promotion:read'], path: '/promotions/15' },
    { permissions: ['shipment:read'], path: '/shipments/15' },
  ])('allows the read-only session at $path', ({ permissions, path }) => {
    route.pathname = path;
    setEmployeeAdminTestSession(permissions);
    render(
      <AdminSessionGuard>
        <p>Được phép truy cập</p>
      </AdminSessionGuard>,
    );
    expect(screen.getByText('Được phép truy cập')).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it.each([
    {
      permissions: ['shipment:read'],
      path: '/promotions',
      target: '/shipments',
    },
    {
      permissions: ['promotion:read'],
      path: '/shipments',
      target: '/promotions',
    },
    {
      permissions: ['promotion:read'],
      path: '/promotions-extra',
      target: '/promotions',
    },
  ])(
    'blocks $path and redirects to $target',
    async ({ permissions, path, target }) => {
      route.pathname = path;
      setEmployeeAdminTestSession(permissions);
      render(
        <AdminSessionGuard>
          <p>Nội dung bị cấm</p>
        </AdminSessionGuard>,
      );
      expect(screen.queryByText('Nội dung bị cấm')).toBeNull();
      await waitFor(() => expect(replace).toHaveBeenCalledWith(target));
    },
  );

  it.each(['platform', 'tenant-mismatch'] as const)(
    'fails closed for %s even with both read keys',
    (principal) => {
      const session: AdminSession = {
        accountId: 1,
        fullName: 'Admin',
        phoneNumber: '+84900000001',
        email: 'admin@vexgo.test',
        roles: ['SUPER_ADMIN'],
        permissions: ['promotion:read', 'shipment:read'],
        employee: null,
        busCompanyId: null,
      };
      if (principal === 'tenant-mismatch') {
        session.roles = ['NHA_XE_ADMIN'];
        session.busCompanyId = 10;
        session.employee = {
          employeeId: 1,
          busCompanyId: 11,
          busCompanyCode: 'OTHER',
          busCompanyName: 'Nhà xe khác',
        };
      }
      setAdminTestSession({ status: 'authenticated', session });
      expect(hasAdminPermission(session, 'promotion:read')).toBe(false);
      expect(hasAdminPermission(session, 'shipment:read')).toBe(false);
      expect(getFirstAccessibleAdminPath(session)).toBeNull();
      render(
        <SuperAdminLayout activeSection="overview">Nội dung</SuperAdminLayout>,
      );
      const sidebar = within(
        screen.getByRole('complementary', { name: 'Điều hướng quản trị' }),
      );
      expect(sidebar.queryByRole('link', { name: 'Khuyến mãi' })).toBeNull();
      expect(sidebar.queryByRole('link', { name: 'Gửi hàng' })).toBeNull();
    },
  );

  it('defines each operational route once', () => {
    expect(new Set(ADMIN_OPERATION_SECTIONS.map(({ href }) => href)).size).toBe(
      ADMIN_OPERATION_SECTIONS.length,
    );
  });

  it.each(['/promotions', '/shipments'])(
    'blocks platform-only access to %s even with tenant keys',
    async (path) => {
      route.pathname = path;
      setAdminTestSession({
        status: 'authenticated',
        session: {
          accountId: 1,
          fullName: 'Super Admin',
          phoneNumber: '+84900000001',
          email: 'admin@vexgo.test',
          roles: ['SUPER_ADMIN'],
          permissions: ['promotion:read', 'shipment:read'],
          employee: null,
          busCompanyId: null,
        },
      });
      render(
        <AdminSessionGuard>
          <p>Nội dung tenant bị cấm</p>
        </AdminSessionGuard>,
      );
      expect(screen.queryByText('Nội dung tenant bị cấm')).toBeNull();
      await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    },
  );

  it('does not infer read access from create/update permissions', () => {
    setEmployeeAdminTestSession([
      'promotion:create',
      'promotion:update',
      'shipment:update',
    ]);
    render(
      <AdminSessionGuard>
        <p>Nội dung bị cấm</p>
      </AdminSessionGuard>,
    );
    expect(screen.queryByText('Nội dung bị cấm')).toBeNull();
    expect(
      screen.getByRole('heading', {
        name: 'Tài khoản chưa có chức năng quản trị khả dụng',
      }),
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });
});
