// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace, reloadAdminSession, service } = vi.hoisted(() => ({
  state: { pathname: '/tenant-rbac' },
  replace: vi.fn(),
  reloadAdminSession: vi.fn(),
  service: {
    getTenantRolePermissions: vi.fn(),
    replaceTenantRolePermissions: vi.fn(),
    resetTenantRolePermissions: vi.fn(),
  },
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
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

vi.mock('@/features/tenant-rbac/services/tenant-rbac-service', () => service);

vi.mock('@/features/admin-auth/services/admin-auth', async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import('@/features/admin-auth/services/admin-auth')
    >();
  return {
    ...actual,
    initializeAdminSession: vi.fn(async () => null),
    reloadAdminSession,
  };
});

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { TenantRbacManagement } from '@/features/tenant-rbac/components/tenant-rbac-management';
import type {
  TenantRbacConfig,
  TenantRbacPermission,
  TenantRbacRole,
  TenantRbacRoleName,
} from '@/features/tenant-rbac/types/tenant-rbac';
import {
  resetAdminTestSession,
  setAdminTestSession,
} from './admin-auth-test-session';

const permissions: TenantRbacPermission[] = [
  { key: 'role:read', scope: 'tenant', description: 'Xem vai trò.' },
  {
    key: 'permission:assign',
    scope: 'tenant',
    description: 'Gán quyền trong nhà xe.',
  },
  { key: 'route:read', scope: 'tenant', description: 'Xem tuyến xe.' },
];

const roleNames: readonly TenantRbacRoleName[] = [
  'NHA_XE_ADMIN',
  'NHAN_VIEN_BAN_VE',
  'NHAN_VIEN_CSKH',
  'NHAN_VIEN_PHU_XE',
  'NHAN_VIEN_KINH_DOANH',
];

const config: TenantRbacConfig = {
  permissions,
  roles: roleNames.map((roleName, index) => {
    const defaultPermissionKeys = index === 0
      ? ['role:read', 'permission:assign']
      : [];
    return {
      roleName,
      description: `Mô tả ${roleName}`,
      scope: 'tenant',
      isProtected: false,
      defaultPermissionKeys,
      overridePermissionKeys: null,
      effectivePermissionKeys: defaultPermissionKeys,
      source: 'global',
    };
  }),
};

function tenantSessionSnapshot(
  permissionsForSession: string[] = ['role:read', 'permission:assign'],
  roles: string[] = ['NHA_XE_ADMIN'],
) {
  return {
    accountId: 7,
    fullName: 'Quản trị FUTA',
    phoneNumber: '+84900000007',
    email: 'futa@vexgo.test',
    roles,
    permissions: permissionsForSession,
    employee: {
      employeeId: 17,
      busCompanyId: 70,
      busCompanyCode: 'FUTA',
      busCompanyName: 'Phương Trang',
    },
    busCompanyId: 70,
  };
}

function setTenantSession(
  permissionsForSession: string[] = ['role:read', 'permission:assign'],
  roles: string[] = ['NHA_XE_ADMIN'],
) {
  setAdminTestSession({
    status: 'authenticated',
    session: tenantSessionSnapshot(permissionsForSession, roles),
  });
}

function renderManagement() {
  return render(
    <AdminSessionGuard>
      <TenantRbacManagement />
    </AdminSessionGuard>,
  );
}

function selectRole(roleName: TenantRbacRoleName) {
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(roleName) }));
}

function makeSavedRole(
  role: TenantRbacRole,
  permissionKeys: string[],
): TenantRbacRole {
  return {
    ...role,
    overridePermissionKeys: permissionKeys,
    effectivePermissionKeys: permissionKeys,
    source: 'override',
  };
}

describe('tenant RBAC management', () => {
  beforeEach(() => {
    resetAdminTestSession();
    setTenantSession();
    state.pathname = '/tenant-rbac';
    replace.mockReset();
    reloadAdminSession.mockReset().mockResolvedValue({
      accountId: 7,
      fullName: 'Quản trị FUTA',
      phoneNumber: '+84900000007',
      email: 'futa@vexgo.test',
      roles: ['NHA_XE_ADMIN'],
      permissions: ['role:read', 'permission:assign'],
      employee: {
        employeeId: 17,
        busCompanyId: 70,
        busCompanyCode: 'FUTA',
        busCompanyName: 'Phương Trang',
      },
      busCompanyId: 70,
    });
    service.getTenantRolePermissions.mockReset().mockResolvedValue(config);
    service.replaceTenantRolePermissions.mockReset().mockImplementation(
      async (role: TenantRbacRole, keys: string[]) => makeSavedRole(role, keys),
    );
    service.resetTenantRolePermissions.mockReset().mockImplementation(
      async (role: TenantRbacRole) => ({ ...role, overridePermissionKeys: null, effectivePermissionKeys: role.defaultPermissionKeys, source: 'global' }),
    );
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

  afterEach(() => cleanup());

  it('shows inherited configuration and the effective permission list', async () => {
    renderManagement();

    expect(await screen.findByRole('heading', { name: 'Phân quyền vai trò' })).toBeTruthy();
    expect(screen.getByText('Kế thừa mặc định')).toBeTruthy();
    expect(screen.getByText('Chưa cấu hình override')).toBeTruthy();
    expect(screen.getByText(/Quyền đang áp dụng/)).toBeTruthy();
    expect(
      (screen.getByRole('checkbox', {
        name: 'Gán quyền role:read cho NHA_XE_ADMIN',
      }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it('keeps the applied summary on persisted permissions while the matrix has an unsaved draft', async () => {
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });

    const appliedPermissions = screen.getByRole('region', {
      name: 'Quyền đang áp dụng',
    });
    const readCheckbox = screen.getByRole('checkbox', {
      name: 'Gán quyền role:read cho NHA_XE_ADMIN',
    });
    expect(within(appliedPermissions).getByText('role:read')).toBeTruthy();

    fireEvent.click(readCheckbox);

    expect((readCheckbox as HTMLInputElement).checked).toBe(false);
    expect(within(appliedPermissions).getByText('role:read')).toBeTruthy();
    expect(service.replaceTenantRolePermissions).not.toHaveBeenCalled();
  });

  it('keeps a read-only tenant admin from changing or submitting permissions', async () => {
    setTenantSession(['role:read']);
    service.getTenantRolePermissions.mockResolvedValueOnce({
      ...config,
      roles: config.roles.map((role, index) =>
        index === 0
          ? {
              ...role,
              overridePermissionKeys: [],
              effectivePermissionKeys: [],
              source: 'override',
            }
          : role,
      ),
    });
    renderManagement();

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Gán quyền role:read cho NHA_XE_ADMIN',
    });
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/chỉ có quyền xem/i)).toBeTruthy();
    expect(
      (screen.getByRole('button', { name: 'Lưu thay đổi' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: 'Khôi phục mặc định',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(service.replaceTenantRolePermissions).not.toHaveBeenCalled();
    expect(service.resetTenantRolePermissions).not.toHaveBeenCalled();
  });

  it('saves an intentional empty override and refreshes the trusted session', async () => {
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });

    fireEvent.click(screen.getByRole('checkbox', { name: 'Gán quyền role:read cho NHA_XE_ADMIN' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gán quyền permission:assign cho NHA_XE_ADMIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    await waitFor(() => expect(service.replaceTenantRolePermissions).toHaveBeenCalledWith(
      config.roles[0],
      [],
      permissions,
    ));
    await waitFor(() => expect(reloadAdminSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/đã lưu override rỗng/i)).toBeTruthy();
    expect(screen.getByText('Override riêng')).toBeTruthy();
  });

  it('updates the applied summary only after the API returns saved permissions', async () => {
    let resolveSavedRole: ((role: TenantRbacRole) => void) | undefined;
    service.replaceTenantRolePermissions.mockImplementationOnce(
      () => new Promise<TenantRbacRole>((resolve) => {
        resolveSavedRole = resolve;
      }),
    );
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });

    const appliedPermissions = screen.getByRole('region', {
      name: 'Quyền đang áp dụng',
    });
    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Gán quyền route:read cho NHA_XE_ADMIN',
    }));
    expect(within(appliedPermissions).queryByText('route:read')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));
    await waitFor(() => expect(service.replaceTenantRolePermissions).toHaveBeenCalledTimes(1));
    expect(within(appliedPermissions).queryByText('route:read')).toBeNull();

    resolveSavedRole?.(makeSavedRole(config.roles[0], [
      'role:read',
      'permission:assign',
      'route:read',
    ]));

    expect(await within(appliedPermissions).findByText('route:read')).toBeTruthy();
  });

  it('uses DELETE to restore inheritance and never conflates it with undo', async () => {
    const overriddenRole = {
      ...config.roles[2],
      overridePermissionKeys: [],
      effectivePermissionKeys: [],
      source: 'override',
    } satisfies TenantRbacRole;
    service.getTenantRolePermissions.mockResolvedValueOnce({
      ...config,
      roles: config.roles.map((role) =>
        role.roleName === overriddenRole.roleName ? overriddenRole : role,
      ),
    });
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });
    selectRole('NHAN_VIEN_CSKH');

    fireEvent.click(screen.getByRole('button', { name: 'Khôi phục mặc định' }));
    expect(service.resetTenantRolePermissions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận khôi phục' }));

    await waitFor(() => expect(service.resetTenantRolePermissions).toHaveBeenCalledWith(
      overriddenRole,
      permissions,
    ));
    await waitFor(() => expect(reloadAdminSession).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/đã khôi phục quyền mặc định/i)).toBeTruthy();
  });

  it('keeps the draft and shows the API error when save fails', async () => {
    service.replaceTenantRolePermissions.mockRejectedValueOnce(new Error('Máy chủ từ chối.'));
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gán quyền route:read cho NHA_XE_ADMIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Máy chủ từ chối.');
    expect(
      (
        screen.getByRole('checkbox', {
          name: 'Gán quyền route:read cho NHA_XE_ADMIN',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      within(
        screen.getByRole('region', { name: 'Quyền đang áp dụng' }),
      ).getByText('role:read'),
    ).toBeTruthy();
    expect(
      within(
        screen.getByRole('region', { name: 'Quyền đang áp dụng' }),
      ).queryByText('route:read'),
    ).toBeNull();
    expect(reloadAdminSession).not.toHaveBeenCalled();
  });

  it('warns before saving a change that removes the current account role:read permission', async () => {
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gán quyền role:read cho NHA_XE_ADMIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(screen.getByText(/mất quyền mở trang phân quyền nhà xe/i)).toBeTruthy();
    expect(service.replaceTenantRolePermissions).not.toHaveBeenCalled();
  });

  it('reports a saved mutation when trusted session refresh fails', async () => {
    reloadAdminSession.mockRejectedValueOnce(new Error('Phiên chưa đồng bộ.'));
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Gán quyền route:read cho NHA_XE_ADMIN' }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/đã được lưu.*phiên chưa đồng bộ/i);
    expect(service.replaceTenantRolePermissions).toHaveBeenCalledTimes(1);
    expect(reloadAdminSession).toHaveBeenCalledTimes(1);
    expect(
      (
        within(
          screen.getByRole('region', { name: 'Quyền của NHA_XE_ADMIN' }),
        ).getByRole('checkbox', {
          name: 'Gán quyền route:read cho NHA_XE_ADMIN',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });

  it('removes the tenant RBAC page after refresh removes the session role:read permission', async () => {
    reloadAdminSession.mockImplementationOnce(async () => {
      const refreshedSession = tenantSessionSnapshot(['permission:assign']);
      setAdminTestSession({ status: 'authenticated', session: refreshedSession });
      return refreshedSession;
    });
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Gán quyền role:read cho NHA_XE_ADMIN',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    expect(await screen.findByRole('heading', {
      name: 'Tài khoản chưa có chức năng quản trị khả dụng',
    })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Phân quyền vai trò' })).toBeNull();
    expect(screen.queryByRole('complementary', {
      name: 'Điều hướng quản trị',
    })).toBeNull();
  });

  it('keeps the tenant RBAC page read-only after refresh removes permission:assign', async () => {
    reloadAdminSession.mockImplementationOnce(async () => {
      const refreshedSession = tenantSessionSnapshot(['role:read']);
      setAdminTestSession({ status: 'authenticated', session: refreshedSession });
      return refreshedSession;
    });
    renderManagement();
    await screen.findByRole('heading', { name: 'Phân quyền vai trò' });

    fireEvent.click(screen.getByRole('checkbox', {
      name: 'Gán quyền permission:assign cho NHA_XE_ADMIN',
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }));

    expect(await screen.findByText(/chỉ có quyền xem/i)).toBeTruthy();
    expect((screen.getByRole('checkbox', {
      name: 'Gán quyền role:read cho NHA_XE_ADMIN',
    }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', {
      name: 'Lưu thay đổi',
    }) as HTMLButtonElement).disabled).toBe(true);
    expect(service.replaceTenantRolePermissions).toHaveBeenCalledTimes(1);
  });
});
