// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { navigation, reloadAdminSession, tenantRbac, busCompanies } = vi.hoisted(() => ({
  navigation: { pathname: '/rbac/tenants/12', replace: vi.fn() },
  reloadAdminSession: vi.fn(),
  tenantRbac: {
    getPlatformTenantRolePermissions: vi.fn(),
    replacePlatformTenantRolePermissions: vi.fn(),
    resetPlatformTenantRolePermissions: vi.fn(),
    getTenantRolePermissions: vi.fn(),
    replaceTenantRolePermissions: vi.fn(),
    resetTenantRolePermissions: vi.fn(),
  },
  busCompanies: {
    getBusCompanyById: vi.fn(),
    getBusCompanyFilterOptions: vi.fn(),
  },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/tenant-rbac/services/tenant-rbac-service', () => tenantRbac);
vi.mock('@/features/bus-companies/services/bus-company-service', () => busCompanies);

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/features/admin-auth/services/admin-auth')
  >();
  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
    reloadAdminSession,
  };
});

import PlatformTenantRbacPage from '@/app/rbac/tenants/[nhaXeId]/page';
import type {
  TenantRbacConfig,
  TenantRbacPermission,
  TenantRbacRole,
  TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import {
  resetAdminTestSession,
  setAdminTestSession,
  setEmployeeAdminTestSession,
} from './admin-auth-test-session';

const permissions: TenantRbacPermission[] = [
  { key: 'role:read', scope: 'tenant', description: 'Xem vai trò.' },
  { key: 'permission:assign', scope: 'tenant', description: 'Gán quyền.' },
  { key: 'route:read', scope: 'tenant', description: 'Xem tuyến xe.' },
];

const roleNames: readonly TenantRbacRoleName[] = [
  'NHA_XE_ADMIN',
  'NHAN_VIEN_DIEU_HANH',
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
];

function makeConfig(tenantLabel = 'Nhà xe 12'): TenantRbacConfig {
  return {
    permissions,
    roles: roleNames.map((roleName, index) => {
      const defaultPermissionKeys = index === 0
        ? ['role:read', 'permission:assign']
        : [];
      return {
        roleName,
        description: `${tenantLabel} · ${roleName}`,
        scope: 'tenant',
        isProtected: false,
        defaultPermissionKeys,
        overridePermissionKeys: null,
        effectivePermissionKeys: defaultPermissionKeys,
        source: 'global',
      };
    }),
  };
}

function setSuperAdminSession() {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'root@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions: ['permission:assign', 'role:read'],
      employee: null,
      busCompanyId: null,
    },
  });
}

function makeSavedRole(role: TenantRbacRole, permissionKeys: string[]): TenantRbacRole {
  return {
    ...role,
    overridePermissionKeys: permissionKeys,
    effectivePermissionKeys: permissionKeys,
    source: 'override',
  };
}

async function pageFor(nhaXeId: string) {
  return PlatformTenantRbacPage({
    params: Promise.resolve({ nhaXeId }),
  });
}

describe('Super Admin tenant RBAC editor', () => {
  beforeEach(() => {
    cleanup();
    resetAdminTestSession();
    setSuperAdminSession();
    navigation.pathname = '/rbac/tenants/12';
    navigation.replace.mockReset();
    reloadAdminSession.mockReset();
    tenantRbac.getPlatformTenantRolePermissions.mockReset().mockImplementation(
      async (nhaXeId: number) => makeConfig(`Nhà xe ${nhaXeId}`),
    );
    tenantRbac.replacePlatformTenantRolePermissions.mockReset().mockImplementation(
      async (_nhaXeId: number, role: TenantRbacRole, keys: string[]) => makeSavedRole(role, keys),
    );
    tenantRbac.resetPlatformTenantRolePermissions.mockReset().mockImplementation(
      async (_nhaXeId: number, role: TenantRbacRole) => ({
        ...role,
        overridePermissionKeys: null,
        effectivePermissionKeys: role.defaultPermissionKeys,
        source: 'global',
      }),
    );
    tenantRbac.getTenantRolePermissions.mockReset();
    tenantRbac.replaceTenantRolePermissions.mockReset();
    tenantRbac.resetTenantRolePermissions.mockReset();
    busCompanies.getBusCompanyById.mockReset().mockRejectedValue(
      new Error('Không có quyền đọc danh sách vận hành.'),
    );
    busCompanies.getBusCompanyFilterOptions.mockReset();
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) { this.setAttribute('open', ''); },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    });
  });

  afterEach(cleanup);

  it('loads only the selected tenant config for Super Admin and keeps name lookup optional', async () => {
    render(await pageFor('12'));

    expect(await screen.findByRole('heading', { name: 'Phân quyền vai trò' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Phạm vi cấu hình quyền' }).textContent)
      .toContain('Nhà xe (12)');
    expect(tenantRbac.getPlatformTenantRolePermissions.mock.calls[0][0]).toBe(12);
    expect(tenantRbac.getTenantRolePermissions).not.toHaveBeenCalled();
    expect(busCompanies.getBusCompanyById).toHaveBeenCalledWith(12, expect.any(AbortSignal));
    expect(busCompanies.getBusCompanyFilterOptions).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Vận hành' })).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Phạm vi phân quyền' })
      .querySelector('a[aria-current="page"]')?.textContent).toContain('Theo nhà xe');
  });

  it.each([
    ['tenant administrator', ['NHA_XE_ADMIN'], ['role:read', 'permission:assign']],
    ['employee', ['NHAN_VIEN_CSKH'], ['role:read', 'permission:assign']],
    ['mixed platform and tenant roles', ['SUPER_ADMIN', 'NHA_XE_ADMIN'], []],
  ])('does not mount the tenant editor for a %s opening its direct URL', async (_label, roles, permissionsForSession) => {
    if (roles[0] === 'NHAN_VIEN_CSKH') {
      setEmployeeAdminTestSession(permissionsForSession);
    } else {
      setAdminTestSession({
        status: 'authenticated',
        session: {
          accountId: 2,
          fullName: 'Tài khoản kiểm thử',
          phoneNumber: '+84900000002',
          email: 'test@vexgo.test',
          roles,
          permissions: permissionsForSession,
          employee: roles.includes('NHA_XE_ADMIN')
            ? { employeeId: 2, busCompanyId: 12, busCompanyCode: 'FUTA', busCompanyName: 'Phương Trang' }
            : null,
          busCompanyId: roles.includes('NHA_XE_ADMIN') ? 12 : null,
        },
      });
    }

    render(await pageFor('12'));

    expect(screen.queryByRole('heading', { name: 'Phân quyền vai trò' })).toBeNull();
    expect(tenantRbac.getPlatformTenantRolePermissions).not.toHaveBeenCalled();
    expect(busCompanies.getBusCompanyById).not.toHaveBeenCalled();
  });

  it.each(['0', '-1', '1.5', '9007199254740992', '12abc'])('rejects invalid tenant id %s before making a request', async (id) => {
    navigation.pathname = `/rbac/tenants/${id}`;
    render(await pageFor(id));

    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(tenantRbac.getPlatformTenantRolePermissions).not.toHaveBeenCalled();
    expect(busCompanies.getBusCompanyById).not.toHaveBeenCalled();
  });

  it('keeps persisted permissions visible until the full replacement succeeds', async () => {
    tenantRbac.replacePlatformTenantRolePermissions.mockRejectedValueOnce(
      new Error('Máy chủ từ chối thay đổi.'),
    );
    render(await pageFor('12'));

    const heading = await screen.findByRole('heading', { name: 'Phân quyền vai trò' });
    expect(heading).toBeTruthy();
    const applied = screen.getByRole('region', { name: 'Quyền đang áp dụng' });
    const routeRead = screen.getByRole('checkbox', {
      name: 'Gán quyền route:read cho NHA_XE_ADMIN',
    });
    fireEvent.click(routeRead);
    expect((routeRead as HTMLInputElement).checked).toBe(true);
    expect(within(applied).queryByText('route:read')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Máy chủ từ chối thay đổi.');
    expect((routeRead as HTMLInputElement).checked).toBe(true);
    expect(within(applied).queryByText('route:read')).toBeNull();
    expect(tenantRbac.replacePlatformTenantRolePermissions).toHaveBeenCalledWith(
      12,
      makeConfig().roles[0],
      ['role:read', 'permission:assign', 'route:read'],
      permissions,
    );
    expect(reloadAdminSession).not.toHaveBeenCalled();
  });

  it('uses DELETE to restore inheritance and does not refresh the Super Admin session', async () => {
    const config = makeConfig();
    const targetRole = config.roles.find((role) => role.roleName === 'NHAN_VIEN_CSKH')!;
    const overriddenRole: TenantRbacRole = {
      ...targetRole,
      overridePermissionKeys: [],
      effectivePermissionKeys: [],
      source: 'override',
    };
    tenantRbac.getPlatformTenantRolePermissions.mockResolvedValueOnce({
      ...config,
      roles: config.roles.map((role) => role.roleName === overriddenRole.roleName ? overriddenRole : role),
    });
    render(await pageFor('12'));
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });

    fireEvent.click(screen.getByRole('radio', { name: /NHAN_VIEN_CSKH/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục mặc định' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận khôi phục' }));

    await waitFor(() => expect(tenantRbac.resetPlatformTenantRolePermissions).toHaveBeenCalledWith(
      12,
      overriddenRole,
      permissions,
    ));
    expect(await screen.findByText(/đã khôi phục quyền mặc định/i)).toBeTruthy();
    expect(screen.getByText('Kế thừa mặc định')).toBeTruthy();
    expect(reloadAdminSession).not.toHaveBeenCalled();
  });

  it('aborts the previous tenant request when the route changes to another tenant', async () => {
    let resolveFirst: ((config: TenantRbacConfig) => void) | undefined;
    let firstSignal: AbortSignal | undefined;
    tenantRbac.getPlatformTenantRolePermissions.mockImplementation((id: number, signal: AbortSignal) => {
      if (id === 12) {
        firstSignal = signal;
        return new Promise<TenantRbacConfig>((resolve) => { resolveFirst = resolve; });
      }
      return Promise.resolve(makeConfig('Dữ liệu nhà xe 23'));
    });

    const firstPage = await pageFor('12');
    const { rerender } = render(firstPage);
    expect(tenantRbac.getPlatformTenantRolePermissions.mock.calls[0][0]).toBe(12);

    navigation.pathname = '/rbac/tenants/23';
    rerender(await pageFor('23'));
    expect(await screen.findByText('Dữ liệu nhà xe 23 · NHA_XE_ADMIN')).toBeTruthy();
    expect(firstSignal?.aborted).toBe(true);

    resolveFirst?.(makeConfig('Dữ liệu cũ nhà xe 12'));
    await waitFor(() => expect(screen.queryByText('Dữ liệu cũ nhà xe 12 · NHA_XE_ADMIN')).toBeNull());
  });
});
