// @vitest-environment jsdom
import {
  cleanup,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
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

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import {
  resetAdminTestSession,
  setAdminTestSession,
} from './admin-auth-test-session';

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/admin-auth/services/admin-auth')
    >();
  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
  };
});

function setTenantSession(
  roles = ['NHA_XE_ADMIN'],
  permissions = [
    'vehicle-type:read',
    'vehicle-type:create',
    'vehicle-type:update',
    'vehicle:read',
    'vehicle:create',
    'vehicle:update',
    'seat:read',
    'seat:create',
    'seat:update',
    'seat:delete',
    'route:read',
    'route:create',
    'route:update',
    'fare-price:read',
    'fare-price:create',
    'fare-price:update',
  ],
) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 2,
      fullName: 'Quản lý FUTA',
      phoneNumber: '+84900000002',
      email: 'futa@vexgo.test',
      roles,
      permissions,
      employee: {
        employeeId: 1,
        busCompanyId: 10,
        busCompanyCode: 'FUTA',
        busCompanyName: 'FUTA',
      },
      busCompanyId: 10,
    },
  });
}

describe('admin tenant presentation mode', () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    resetAdminTestSession();
    state.pathname = '/vehicle-types';
    replace.mockClear();
  });

  it('keeps platform navigation focused on platform scope', () => {
    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 1,
        fullName: 'Super Admin',
        phoneNumber: '+84900000001',
        email: 'admin@vexgo.test',
        roles: ['SUPER_ADMIN'],
        permissions: ['route:read', 'fare-price:read', 'bus-company:read'],
        employee: null,
        busCompanyId: null,
      },
    });

    render(
      <SuperAdminLayout activeSection="vehicle-types">
        <h1>Platform page</h1>
      </SuperAdminLayout>,
    );

    expect(
      screen.getByRole('link', { name: 'Nhà xe' }).getAttribute('href'),
    ).toBe('/bus-companies');
    expect(screen.queryByRole('link', { name: 'Loại xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Tuyến xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bảng giá vé' })).toBeNull();
  });

  it('shows only the Vận hành links in tenant preview without Nhà xe', () => {
    setTenantSession();

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Preview page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByText('VẬN HÀNH')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Nhà xe' })).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Loại xe' }).getAttribute('href'),
    ).toBe('/vehicle-types');
    expect(screen.getByRole('link', { name: 'Xe' }).getAttribute('href')).toBe(
      '/vehicles',
    );
    const routeLink = screen.getByRole('link', { name: 'Tuyến xe' });
    expect(routeLink.getAttribute('href')).toBe('/routes');
    expect(routeLink.getAttribute('aria-current')).toBe('page');
    expect(
      screen.getByRole('link', { name: 'Bảng giá vé' }).getAttribute('href'),
    ).toBe('/fare-prices');
  });

  it('shows tenant name and uppercase role in the sidebar brand with a header logout action', () => {
    setTenantSession(['NHA_XE_ADMIN', 'NHAN_VIEN_CSKH']);

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Tenant page</h1>
      </SuperAdminLayout>,
    );

    const brand = screen.getByRole('link', { name: /VexGo/ });
    expect(brand.textContent).toContain('FUTA');
    expect(brand.textContent).toContain('NHÂN VIÊN CSKH');
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
  });

  it('shows Super Admin and no tenant in the sidebar brand', () => {
    render(
      <SuperAdminLayout activeSection="overview">
        <h1>Platform page</h1>
      </SuperAdminLayout>,
    );

    const brand = screen.getByRole('link', { name: /VexGo/ });
    expect(brand.textContent).toContain('SUPER ADMIN');
    expect(brand.textContent).toContain('NHÀ XE: NONE');
  });

  it('keeps platform RBAC navigation available without any platform permissions', () => {
    render(
      <SuperAdminLayout activeSection="overview">
        <h1>Platform page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByRole('link', { name: 'Phân quyền' }).getAttribute('href'))
      .toBe('/rbac');
    expect(screen.queryByRole('link', { name: 'Nhà xe' })).toBeNull();
  });

  it('hides the Nhà xe link when Super Admin lacks bus-company:read', () => {
    render(
      <SuperAdminLayout activeSection="overview">
        <h1>Platform page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByRole('link', { name: 'Tổng quan' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Nhà xe' })).toBeNull();
  });

  it('allows an authenticated tenant account to open its operational route', () => {
    setTenantSession();
    const SensitiveManagement = vi.fn(() => <div>Tenant data list</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Tenant data list')).toBeTruthy();
    expect(SensitiveManagement).toHaveBeenCalled();
  });

  it('allows a scoped tenant admin with role:read to mount tenant RBAC', () => {
    setTenantSession(['NHA_XE_ADMIN'], ['role:read']);
    state.pathname = '/tenant-rbac';
    const TenantRbac = vi.fn(() => <div>Tenant role permissions</div>);

    render(
      <AdminSessionGuard>
        <TenantRbac />
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Tenant role permissions')).toBeTruthy();
    expect(TenantRbac).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not mount tenant RBAC for an employee-only account with RBAC permissions', () => {
    setTenantSession(['NHAN_VIEN_CSKH'], ['role:read', 'permission:assign']);
    state.pathname = '/tenant-rbac';
    const TenantRbac = vi.fn(() => <div>Tenant role permissions</div>);

    render(
      <AdminSessionGuard>
        <TenantRbac />
      </AdminSessionGuard>,
    );

    expect(TenantRbac).not.toHaveBeenCalled();
    expect(screen.queryByText('Tenant role permissions')).toBeNull();
    expect(screen.getByText(/chưa được cấp chức năng trong Admin Web/i)).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not mount tenant RBAC for Super Admin and redirects to platform overview', async () => {
    state.pathname = '/tenant-rbac';
    const TenantRbac = vi.fn(() => <div>Tenant role permissions</div>);

    render(
      <AdminSessionGuard>
        <TenantRbac />
      </AdminSessionGuard>,
    );

    expect(TenantRbac).not.toHaveBeenCalled();
    expect(screen.queryByText('Tenant role permissions')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('does not mount tenant RBAC without role:read and redirects an admin to an allowed page', async () => {
    setTenantSession(['NHA_XE_ADMIN'], ['vehicle-type:read']);
    state.pathname = '/tenant-rbac';
    const TenantRbac = vi.fn(() => <div>Tenant role permissions</div>);

    render(
      <AdminSessionGuard>
        <TenantRbac />
      </AdminSessionGuard>,
    );

    expect(TenantRbac).not.toHaveBeenCalled();
    expect(screen.queryByText('Tenant role permissions')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/vehicle-types'));
  });

  it('shows exactly the tenant navigation items granted by read permission', () => {
    setTenantSession(
      ['NHAN_VIEN_CSKH'],
      ['route:read', 'fare-price:read'],
    );

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Tenant page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByText('VẬN HÀNH')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Tuyến xe' }).getAttribute('href'))
      .toBe('/routes');
    expect(screen.getByRole('link', { name: 'Bảng giá vé' }).getAttribute('href'))
      .toBe('/fare-prices');
    expect(screen.queryByRole('link', { name: 'Loại xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Nhà xe' })).toBeNull();
    expect(screen.getByRole('link', { name: /VexGo/ }).getAttribute('href'))
      .toBe('/routes');
  });

  it('shows tenant RBAC separately for a tenant admin with role:read', () => {
    setTenantSession(['NHA_XE_ADMIN'], ['vehicle-type:read', 'role:read']);

    render(
      <SuperAdminLayout activeSection="tenant-rbac">
        <h1>Tenant RBAC</h1>
      </SuperAdminLayout>,
    );

    const link = screen.getByRole('link', { name: 'Phân quyền' });
    expect(link.getAttribute('href')).toBe('/tenant-rbac');
    expect(link.getAttribute('aria-current')).toBe('page');
    expect(screen.getAllByText('QUẢN TRỊ NHÀ XE')).toHaveLength(2);
    expect(screen.getByText('VẬN HÀNH')).toBeTruthy();
  });

  it('does not show tenant RBAC to employee-only accounts, even with RBAC keys', () => {
    setTenantSession(['NHAN_VIEN_CSKH'], ['route:read', 'role:read', 'permission:assign']);

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Tenant page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.queryByText('QUẢN TRỊ NHÀ XE')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Phân quyền' })).toBeNull();
  });

  it('hides tenant RBAC from a tenant admin without role:read', () => {
    setTenantSession(['NHA_XE_ADMIN'], ['vehicle-type:read']);

    render(
      <SuperAdminLayout activeSection="vehicle-types">
        <h1>Tenant operations</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByText('VẬN HÀNH')).toBeTruthy();
    expect(screen.getAllByText('QUẢN TRỊ NHÀ XE')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Phân quyền' })).toBeNull();
  });

  it('does not render an empty tenant operations group without read permissions', () => {
    setTenantSession(['NHAN_VIEN_CSKH'], []);

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Restricted page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.queryByText('VẬN HÀNH')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Loại xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Tuyến xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Bảng giá vé' })).toBeNull();
  });

  it('allows an employee-only tenant account with valid identity to open a permitted page', () => {
    setTenantSession(['NHAN_VIEN_CSKH'], ['route:read']);
    state.pathname = '/routes';
    const TenantRoutes = vi.fn(() => <div>Tenant routes</div>);

    render(
      <AdminSessionGuard>
        <TenantRoutes />
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Tenant routes')).toBeTruthy();
    expect(TenantRoutes).toHaveBeenCalled();
  });

  it('does not mount a direct URL without its read permission and redirects to the first allowed page', async () => {
    setTenantSession(['NHAN_VIEN_CSKH'], ['route:read']);
    state.pathname = '/vehicle-types';
    const SensitiveVehicleTypes = vi.fn(() => <div>Vehicle types data</div>);

    render(
      <AdminSessionGuard>
        <SensitiveVehicleTypes />
      </AdminSessionGuard>,
    );

    expect(SensitiveVehicleTypes).not.toHaveBeenCalled();
    expect(screen.queryByText('Vehicle types data')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/routes'));
  });

  it('shows a restricted state when the tenant has no operational read permission', () => {
    setTenantSession(['NHAN_VIEN_CSKH'], []);
    state.pathname = '/routes';
    const SensitiveRoutes = vi.fn(() => <div>Restricted routes data</div>);

    render(
      <AdminSessionGuard>
        <SensitiveRoutes />
      </AdminSessionGuard>,
    );

    expect(SensitiveRoutes).not.toHaveBeenCalled();
    expect(screen.queryByText('Restricted routes data')).toBeNull();
    expect(
      screen.getByText(/chưa được cấp chức năng trong Admin Web/i),
    ).toBeTruthy();
    expect(replace).not.toHaveBeenCalled();
  });

  it('requires vehicle and seat read permissions before mounting the seat workspace', () => {
    setTenantSession(['NHAN_VIEN_CSKH'], ['seat:read']);
    state.pathname = '/vehicles/42/seats';
    const SensitiveSeats = vi.fn(() => <div>Seat configuration</div>);

    render(
      <AdminSessionGuard>
        <SensitiveSeats />
      </AdminSessionGuard>,
    );

    expect(SensitiveSeats).not.toHaveBeenCalled();
    expect(screen.queryByText('Seat configuration')).toBeNull();
    expect(
      screen.getByText(/chưa được cấp chức năng trong Admin Web/i),
    ).toBeTruthy();
  });

  it('keeps tenant navigation for an admin who also has an employee role', () => {
    setTenantSession(['NHA_XE_ADMIN', 'NHAN_VIEN_BAN_VE']);

    render(
      <SuperAdminLayout activeSection="routes">
        <h1>Tenant page</h1>
      </SuperAdminLayout>,
    );

    expect(screen.getByText('VẬN HÀNH')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Nhà xe' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Phân quyền' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Tuyến xe' })).toBeTruthy();
  });

  it('fails closed for a tenant admin mixed with a customer role', () => {
    setTenantSession(['NHA_XE_ADMIN', 'KHACH_HANG']);
    const SensitiveManagement = vi.fn(() => <div>Tenant data list</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(
      screen.getByText(/phạm vi vai trò của tài khoản chưa hợp lệ/i),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Đăng xuất' })).toBeTruthy();
    expect(SensitiveManagement).not.toHaveBeenCalled();
  });

  it('does not mount platform pages for a tenant account and redirects to operations', async () => {
    setTenantSession();
    state.pathname = '/bus-companies';
    const SensitiveManagement = vi.fn(() => <div>All bus companies</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(SensitiveManagement).not.toHaveBeenCalled();
    expect(screen.queryByText('All bus companies')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/vehicle-types'));
  });

  it('does not mount the platform RBAC route for a tenant admin', async () => {
    setTenantSession(['NHAN_VIEN_CSKH'], ['route:read']);
    state.pathname = '/rbac';
    const SensitiveRbac = vi.fn(() => <div>Platform permissions</div>);

    render(
      <AdminSessionGuard>
        <SensitiveRbac />
      </AdminSessionGuard>,
    );

    expect(SensitiveRbac).not.toHaveBeenCalled();
    expect(screen.queryByText('Platform permissions')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/routes'));
  });

  it('does not mount the platform RBAC route for a mixed platform and tenant identity', () => {
    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 2,
        fullName: 'Tài khoản sai phạm vi',
        phoneNumber: '+84900000002',
        email: 'mixed@vexgo.test',
        roles: ['SUPER_ADMIN', 'NHA_XE_ADMIN'],
        permissions: [],
        employee: {
          employeeId: 2,
          busCompanyId: 10,
          busCompanyCode: 'FUTA',
          busCompanyName: 'FUTA',
        },
        busCompanyId: 10,
      },
    });
    state.pathname = '/rbac';
    const SensitiveRbac = vi.fn(() => <div>Platform permissions</div>);

    render(
      <AdminSessionGuard>
        <SensitiveRbac />
      </AdminSessionGuard>,
    );

    expect(SensitiveRbac).not.toHaveBeenCalled();
    expect(screen.queryByText('Platform permissions')).toBeNull();
    expect(screen.getByText(/phạm vi vai trò của tài khoản chưa hợp lệ/i)).toBeTruthy();
  });

  it('mounts the platform RBAC route for exact SUPER_ADMIN with no permissions', () => {
    state.pathname = '/rbac';
    const PlatformRbac = vi.fn(() => <div>Platform permissions</div>);

    render(
      <AdminSessionGuard>
        <PlatformRbac />
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Platform permissions')).toBeTruthy();
    expect(PlatformRbac).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not mount the Nhà xe page for Super Admin without bus-company:read', async () => {
    state.pathname = '/bus-companies';
    const SensitiveManagement = vi.fn(() => <div>All bus companies</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(SensitiveManagement).not.toHaveBeenCalled();
    expect(screen.queryByText('All bus companies')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('mounts the Nhà xe page for Super Admin with bus-company:read', () => {
    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 1,
        fullName: 'Super Admin',
        phoneNumber: '+84900000001',
        email: 'admin@vexgo.test',
        roles: ['SUPER_ADMIN'],
        permissions: ['bus-company:read'],
        employee: null,
        busCompanyId: null,
      },
    });
    state.pathname = '/bus-companies';
    const CompanyManagement = vi.fn(() => <div>Company management</div>);

    render(
      <AdminSessionGuard>
        <CompanyManagement />
      </AdminSessionGuard>,
    );

    expect(screen.getByText('Company management')).toBeTruthy();
    expect(CompanyManagement).toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });

  it('does not mount operational pages for Super Admin and redirects to platform overview', async () => {
    state.pathname = '/routes';
    const SensitiveManagement = vi.fn(() => <div>Tenant routes</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(SensitiveManagement).not.toHaveBeenCalled();
    expect(screen.queryByText('Tenant routes')).toBeNull();
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
  });

  it('does not mount admin pages for staff without an Admin role', () => {
    setAdminTestSession({
      status: 'authenticated',
      session: {
        accountId: 3,
        fullName: 'Nhân viên',
        phoneNumber: '+84900000003',
        email: null,
        roles: ['NHAN_VIEN'],
        permissions: [],
        employee: null,
        busCompanyId: null,
      },
    });
    const SensitiveManagement = vi.fn(() => <div>Restricted data</div>);

    render(
      <AdminSessionGuard>
        <SensitiveManagement />
      </AdminSessionGuard>,
    );

    expect(
      screen.getByText(
        'Tài khoản đã đăng nhập nhưng hiện chưa được cấp chức năng trong Admin Web.',
      ),
    ).toBeTruthy();
    expect(SensitiveManagement).not.toHaveBeenCalled();
  });
});
