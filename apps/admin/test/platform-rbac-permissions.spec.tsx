// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { state, replace, reloadAdminSession, service } = vi.hoisted(() => ({
  state: { pathname: '/rbac' },
  replace: vi.fn(),
  reloadAdminSession: vi.fn(),
  service: {
    getDefaultRolePermissions: vi.fn(),
    replaceDefaultRolePermissions: vi.fn(),
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
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/features/platform-rbac/services/platform-rbac-service', () => service);

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
import { PlatformRbacManagement } from '@/features/platform-rbac/components/platform-rbac-management';
import {
  resetAdminTestSession,
  setAdminTestSession,
} from './admin-auth-test-session';

const catalog = [
  {
    key: 'bus-company:read',
    scope: 'platform',
    description: 'Xem danh sách nhà xe trên nền tảng.',
  },
  {
    key: 'bus-company:create',
    scope: 'platform',
    description: 'Tạo nhà xe trên nền tảng.',
  },
  {
    key: 'vehicle:read',
    scope: 'tenant',
    description: 'Xem xe trong phạm vi nhà xe.',
  },
];

const roleData = [
  {
    roleName: 'SUPER_ADMIN',
    description: 'Quản trị nền tảng',
    scope: 'platform',
    isProtected: true,
    permissionKeys: ['bus-company:read'],
  },
  {
    roleName: 'NHA_XE_ADMIN',
    description: 'Quản trị nhà xe',
    scope: 'tenant',
    isProtected: false,
    permissionKeys: ['vehicle:read'],
  },
  ...(['NHAN_VIEN_BAN_VE', 'NHAN_VIEN_CSKH', 'NHAN_VIEN_PHU_XE', 'NHAN_VIEN_KINH_DOANH'] as const).map(
    (roleName) => ({
      roleName,
      description: null,
      scope: 'tenant',
      isProtected: false,
      permissionKeys: [],
    }),
  ),
];

const config = { permissions: catalog, roles: roleData };

function setPlatformSession(permissions: string[] = []) {
  setAdminTestSession({
    status: 'authenticated',
    session: {
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions,
      employee: null,
      busCompanyId: null,
    },
  });
}

function renderManagement() {
  return render(
    <AdminSessionGuard>
      <PlatformRbacManagement />
    </AdminSessionGuard>,
  );
}

describe('platform role permission management', () => {
  beforeEach(() => {
    resetAdminTestSession();
    state.pathname = '/rbac';
    replace.mockReset();
    reloadAdminSession.mockReset().mockResolvedValue({
      accountId: 1,
      fullName: 'Super Admin',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions: [],
      employee: null,
      busCompanyId: null,
    });
    service.getDefaultRolePermissions.mockReset().mockResolvedValue(config);
    service.replaceDefaultRolePermissions.mockReset().mockImplementation(
      async (role, permissionKeys) => ({ ...role, permissionKeys }),
    );
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows loading, then the protected role and global mapping notice', async () => {
    let resolveConfig!: (value: typeof config) => void;
    service.getDefaultRolePermissions.mockImplementationOnce(
      () => new Promise((resolve) => { resolveConfig = resolve; }),
    );

    renderManagement();
    expect(screen.getByRole('status')).toBeTruthy();
    resolveConfig(config);

    expect(await screen.findByRole('heading', { name: 'Phân quyền vai trò' })).toBeTruthy();
    expect(screen.getAllByRole('main')).toHaveLength(1);
    expect(screen.getByText('Vai trò hệ thống · Được bảo vệ')).toBeTruthy();
    expect(
      screen.getByText(/Thay đổi áp dụng cho các tài khoản mang vai trò này/),
    ).toBeTruthy();
  });

  it('renders only permissions in the selected role scope', async () => {
    setPlatformSession();
    renderManagement();

    expect(await screen.findByRole('checkbox', { name: /bus-company:read/ })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /vehicle:read/ })).toBeNull();
    fireEvent.click(screen.getByRole('radio', { name: /Quản trị nhà xe/ }));
    expect(await screen.findByRole('checkbox', { name: /vehicle:read/ })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: /bus-company:read/ })).toBeNull();
  });

  it('keeps a separate draft per role and can reset the selected role', async () => {
    renderManagement();
    const createPermission = await screen.findByRole('checkbox', {
      name: /bus-company:create/,
    });
    fireEvent.click(createPermission);
    expect(screen.getByText('Chưa lưu')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /Quản trị nhà xe/ }));
    expect(screen.getByText('Chưa lưu')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /SUPER_ADMIN/ }));
    expect(screen.getByRole('checkbox', { name: /bus-company:create/ })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Hoàn tác' }));
    expect(screen.getByRole('checkbox', { name: /bus-company:create/ })).toHaveProperty(
      'checked',
      false,
    );
  });

  it('asks for confirmation that save replaces the global role mapping', async () => {
    renderManagement();
    fireEvent.click(await screen.findByRole('checkbox', { name: /bus-company:create/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));

    expect(await screen.findByRole('dialog')).toBeTruthy();
    expect(screen.getByText(/thay thế toàn bộ quyền mặc định/)).toBeTruthy();
    expect(service.replaceDefaultRolePermissions).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hủy' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('saves an empty mapping and reloads the trusted SUPER_ADMIN session', async () => {
    setPlatformSession(['bus-company:read']);
    renderManagement();
    fireEvent.click(await screen.findByRole('checkbox', { name: /bus-company:read/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận lưu' }));

    await waitFor(() =>
      expect(service.replaceDefaultRolePermissions).toHaveBeenCalledWith(
        roleData[0],
        [],
        catalog,
      ),
    );
    await waitFor(() => expect(reloadAdminSession).toHaveBeenCalledTimes(1));
    expect((await screen.findByRole('status')).textContent).toMatch(/đã được lưu/);
    expect(screen.getByRole('link', { name: 'Phân quyền' })).toBeTruthy();
  });

  it('keeps the draft and reports an API rejection without claiming success', async () => {
    service.replaceDefaultRolePermissions.mockRejectedValueOnce(
      new Error('Không đủ quyền.'),
    );
    renderManagement();
    const permission = await screen.findByRole('checkbox', { name: /bus-company:create/ });
    fireEvent.click(permission);
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận lưu' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Không đủ quyền.');
    expect(permission).toHaveProperty('checked', true);
    expect(reloadAdminSession).not.toHaveBeenCalled();
  });

  it('distinguishes a successful save from a failed session refresh', async () => {
    reloadAdminSession.mockRejectedValueOnce(new Error('Không đọc được phiên.'));
    renderManagement();
    fireEvent.click(await screen.findByRole('checkbox', { name: /bus-company:create/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Xác nhận lưu' }));

    expect((await screen.findByRole('alert')).textContent).toMatch(/đã lưu nhưng phiên chưa được làm mới/);
    expect(service.replaceDefaultRolePermissions).toHaveBeenCalledTimes(1);
  });

  it('offers retry when the role catalog cannot be loaded', async () => {
    service.getDefaultRolePermissions
      .mockRejectedValueOnce(new Error('Không thể tải quyền.'))
      .mockResolvedValueOnce(config);
    renderManagement();

    expect((await screen.findByRole('alert')).textContent).toContain('Không thể tải quyền.');
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));
    expect(await screen.findByRole('heading', { name: 'Phân quyền vai trò' })).toBeTruthy();
    expect(service.getDefaultRolePermissions).toHaveBeenCalledTimes(2);
  });
});
