import type { TenantRbacRoleName } from '@/features/tenant-rbac/types/tenant-rbac';
import { selectCanonicalOption } from './canonical-test-helpers';
// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const account = {
  accountId: 41,
  fullName: 'Nguyễn Minh Anh',
  phoneNumber: '+84912345678',
  dateOfBirth: '1998-05-14',
  citizenId: '079098001234',
  email: 'minhanh@example.test',
  phoneVerified: true,
  status: 'HOAT_DONG' as const,
  roles: ['NHA_XE_ADMIN'] as TenantRbacRoleName[],
  employee: {
    employeeId: 81,
    employeeCode: 'PT-081',
    position: 'Nhân viên kinh doanh',
    joinedAt: '2024-02-01',
    employmentStatus: 'DANG_LAM_VIEC',
  },
  busCompany: {
    busCompanyId: 7,
    code: 'FUTA',
    name: 'Phương Trang',
    status: 'HOAT_DONG' as const,
  },
  createdAt: '2026-09-20T10:00:00.000Z',
  updatedAt: '2026-09-21T10:00:00.000Z',
};
const lockedAccount = {
  ...account,
  status: 'TAM_KHOA' as const,
  updatedAt: '2026-09-22T10:00:00.000Z',
};

const state = vi.hoisted(() => {
  class MockAdminAccountApiError extends Error {
    constructor(
      message: string,
      readonly status: number,
      readonly code?: string,
      readonly details: Array<{ field: string; message: string }> = [],
    ) {
      super(message);
    }
  }

  return {
    AdminAccountApiError: MockAdminAccountApiError,
    authState: null as unknown,
    hook: {
      accountPage: null as unknown,
      error: null as string | null,
      loading: true,
      page: 1,
      searchInput: '',
      status: '' as string,
      busCompanyId: undefined as number | undefined,
      roleName: '' as string,
      createdDateRange: null as { from: string; to: string } | null,
      sortBy: 'createdAt' as string,
      sortDirection: 'desc' as string,
      changePage: vi.fn(),
      refresh: vi.fn(),
      sortAccounts: vi.fn(),
      updateSearch: vi.fn(),
      updateStatus: vi.fn(),
      updateBusCompany: vi.fn(),
      updateRole: vi.fn(),
      updateCreatedDateRange: vi.fn(),
    },
    getAdminAccountById: vi.fn(),
    createAdminAccount: vi.fn(),
    updateAdminAccount: vi.fn(),
    updateAdminAccountStatus: vi.fn(),
    replaceAdminAccountRoles: vi.fn(),
    getBusCompanyFilterOptions: vi.fn(),
    getDefaultRolePermissions: vi.fn(),
  };
});

const roleCatalog = {
  permissions: [
    {
      key: 'bus-company:read',
      scope: 'platform',
      description: 'Xem nhà xe',
    },
    {
      key: 'vehicle:read',
      scope: 'tenant',
      description: 'Xem xe',
    },
  ],
  roles: [
    {
      roleName: 'SUPER_ADMIN',
      description: 'Super Admin',
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
    {
      roleName: 'NHAN_VIEN_BAN_VE',
      description: 'Nhân viên bán vé',
      scope: 'tenant',
      isProtected: false,
      permissionKeys: ['vehicle:read'],
    },
    {
      roleName: 'KHACH_HANG',
      description: 'Khách hàng',
      scope: 'customer',
      isProtected: false,
      permissionKeys: [],
    },
  ],
};

function setAdminPermissions(permissions: string[]) {
  state.authState = {
    status: 'authenticated',
    session: {
      accountId: 1,
      fullName: 'Quản trị VexGo',
      phoneNumber: '+84900000001',
      email: 'admin@vexgo.test',
      roles: ['SUPER_ADMIN'],
      permissions,
      employee: null,
      busCompanyId: null,
    },
  };
}

async function fillRequiredCreateFields(dialog: HTMLElement) {
  fireEvent.change(within(dialog).getByLabelText(/^Họ và tên/), {
    target: { value: 'Trần Minh Anh' },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Số điện thoại/), {
    target: { value: '+84912345678' },
  });
  fireEvent.change(within(dialog).getByLabelText(/^Mật khẩu/), {
    target: { value: 'VexGo@123' },
  });
  await selectCanonicalOption(within(dialog).getByLabelText(/^Nhà xe/), /Phương Trang/);
  fireEvent.click(
    within(dialog).getByRole('checkbox', { name: 'Nhân viên bán vé' }),
  );
}

vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('lucide-react')>();
  const icon = (name: string) =>
    function MockIcon({
      className,
      size,
      ...props
    }: React.SVGProps<SVGSVGElement> & { size?: number }) {
      return (
        <svg
          {...props}
          aria-hidden="true"
          className={`lucide lucide-${name}${className ? ` ${className}` : ''}`}
          height={size}
          width={size}
        />
      );
    };

  return {
    ...actual,
    ArrowDown: icon('arrow-down'),
    ArrowUp: icon('arrow-up'),
    ArrowUpDown: icon('arrow-up-down'),
    CalendarDays: icon('calendar-days'),
    Check: icon('check'),
    ChevronDown: icon('chevron-down'),
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    Eye: icon('eye'),
    LoaderCircle: icon('loader-circle'),
    Plus: icon('plus'),
    RefreshCw: icon('refresh-cw'),
    Search: icon('search'),
    X: icon('x'),
  };
});

vi.mock('@/features/super-admin-layout/components/super-admin-layout', () => ({
  SuperAdminLayout: ({ children }: { children: React.ReactNode }) => (
    <main>{children}</main>
  ),
}));

vi.mock('@/features/admin-accounts/hooks/use-admin-accounts', () => ({
  useAdminAccounts: () => state.hook,
}));

vi.mock('@/features/admin-accounts/services/admin-account-service', () => ({
  AdminAccountApiError: state.AdminAccountApiError,
  getAdminAccountById: state.getAdminAccountById,
  createAdminAccount: state.createAdminAccount,
  updateAdminAccount: state.updateAdminAccount,
  updateAdminAccountStatus: state.updateAdminAccountStatus,
  replaceAdminAccountRoles: state.replaceAdminAccountRoles,
}));

vi.mock('@/features/admin-auth/hooks/use-admin-session', () => ({
  useAdminSession: () => state.authState,
}));

vi.mock('@/features/bus-companies/services/bus-company-service', () => ({
  getBusCompanyFilterOptions: state.getBusCompanyFilterOptions,
}));

vi.mock('@/features/platform-rbac/services/platform-rbac-service', () => ({
  getDefaultRolePermissions: state.getDefaultRolePermissions,
}));

import { AdminAccountsManagement } from '@/features/admin-accounts/components/admin-accounts-management';
import { AdminAccountWorkspace } from '@/features/admin-accounts/components/admin-account-workspace';

describe('Admin accounts management page', () => {
  beforeEach(() => {
    setAdminPermissions(['admin-account:read']);
    state.hook = {
      accountPage: null,
      error: null,
      loading: true,
      page: 1,
      searchInput: '',
      status: '',
      busCompanyId: undefined,
      roleName: '',
      createdDateRange: null,
      sortBy: 'createdAt',
      sortDirection: 'desc',
      changePage: vi.fn(),
      refresh: vi.fn(),
      sortAccounts: vi.fn(),
      updateSearch: vi.fn(),
      updateStatus: vi.fn(),
      updateBusCompany: vi.fn(),
      updateRole: vi.fn(),
      updateCreatedDateRange: vi.fn(),
    };
    state.getAdminAccountById.mockReset().mockResolvedValue(account);
    state.createAdminAccount.mockReset().mockResolvedValue(account);
    state.updateAdminAccount.mockReset().mockResolvedValue(account);
    state.updateAdminAccountStatus.mockReset().mockResolvedValue(account);
    state.replaceAdminAccountRoles.mockReset().mockResolvedValue(account);
    state.getBusCompanyFilterOptions
      .mockReset()
      .mockResolvedValue([{ id: 7, label: 'Phương Trang (FUTA)' }]);
    state.getDefaultRolePermissions.mockReset().mockResolvedValue(roleCatalog);

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

  afterEach(cleanup);

  it('shows the shared loading state before account data arrives', () => {
    render(<AdminAccountsManagement />);

    expect(
      screen.getByRole('status', { name: /danh sách tài khoản/i }),
    ).toBeTruthy();
    expect(
      screen.getByRole('heading', { name: 'Quản lý tài khoản Admin' }),
    ).toBeTruthy();
  });

  it('uses a sortable desktop table for the account list', () => {
    state.hook = {
      ...state.hook,
      accountPage: {
        data: [account],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      },
      loading: false,
    };

    render(<AdminAccountsManagement />);

    const table = screen.getByRole('table');
    const nameHeader = within(table).getByRole('columnheader', {
      name: 'Họ và tên',
    });
    expect(nameHeader.getAttribute('aria-sort')).toBe('none');

    fireEvent.click(
      within(nameHeader).getByRole('button', { name: 'Họ và tên' }),
    );

    expect(state.hook.sortAccounts).toHaveBeenCalledWith('fullName');
    expect(
      within(table).getByRole('row', { name: /Nguyễn Minh Anh/ }),
    ).toBeTruthy();
    expect(
      screen.getAllByText('Nguyễn Minh Anh').find((node) => node.closest('[data-slot="card"]')),
    ).toBeTruthy();
  });

  it('groups create and refresh actions in the shared CRUD header layout', () => {
    setAdminPermissions(['admin-account:read', 'admin-account:create']);

    render(<AdminAccountsManagement />);

    const actions = screen.getByRole('button', { name: 'Thêm tài khoản' }).parentElement;
    expect(actions).toBeTruthy();
    expect(
      within(actions as HTMLElement).getByRole('button', {
        name: /thêm tài khoản/i,
      }),
    ).toBeTruthy();
    expect(
      within(actions as HTMLElement).getByRole('button', { name: 'Làm mới' }),
    ).toBeTruthy();
  });

  it('matches CRUD section spacing and offers company, role and creation-date filters', async () => {
    render(<AdminAccountsManagement />);

    const section = document.querySelector('.admin-page-content');
    expect(section?.className).toContain('gap-[var(--admin-space-section-gap)]');
    expect(
      await screen.findByRole('combobox', { name: 'Lọc theo nhà xe' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('combobox', { name: 'Lọc theo vai trò' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Ngày tạo:/ }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo nhà xe' }));
    const companyOption = await screen.findByRole('option', {
      name: 'Phương Trang (FUTA)',
    });
    fireEvent.pointerDown(companyOption, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(companyOption, { button: 0, pointerType: 'mouse' });
    fireEvent.click(companyOption);
    expect(state.hook.updateBusCompany).toHaveBeenCalledWith('7');

    fireEvent.click(screen.getByRole('combobox', { name: 'Lọc theo vai trò' }));
    const roleOption = await screen.findByRole('option', {
      name: 'Nhân viên bán vé',
    });
    fireEvent.pointerDown(roleOption, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(roleOption, { button: 0, pointerType: 'mouse' });
    fireEvent.click(roleOption);
    expect(state.hook.updateRole).toHaveBeenCalledWith('NHAN_VIEN_BAN_VE');

    fireEvent.click(screen.getByRole('button', { name: /^Ngày tạo:/ }));
    fireEvent.change(screen.getByLabelText('Từ ngày'), {
      target: { value: '2026-09-01' },
    });
    fireEvent.change(screen.getByLabelText('Đến ngày'), {
      target: { value: '2026-09-30' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }));
    expect(state.hook.updateCreatedDateRange).toHaveBeenCalledWith({
      from: '2026-09-01',
      to: '2026-09-30',
    });
  });

  it('shows account identity and links to dedicated workspace', async () => {
    state.hook = {
      ...state.hook,
      accountPage: {
        data: [account],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      },
      loading: false,
    };

    render(<AdminAccountsManagement />);

    const table = screen.getByRole('table');
    const row = within(table).getByRole('row', { name: /Nguyễn Minh Anh/ });
    expect(within(row).getByText('Nguyễn Minh Anh')).toBeTruthy();
    expect(within(row).getByText('+84912345678')).toBeTruthy();
    expect(within(row).getByText('Phương Trang')).toBeTruthy();
    expect(within(row).getByText('Quản trị nhà xe')).toBeTruthy();

    const detailAction = within(table).getAllByRole('button', {
      name: 'Xem chi tiết tài khoản Nguyễn Minh Anh',
    })[0]!;
    expect(
      detailAction.getAttribute('href') ||
        detailAction.closest('a')?.getAttribute('href'),
    ).toBe('/admin-accounts/41');
  });

  it('shows an empty state when there are no matching accounts', () => {
    state.hook = {
      ...state.hook,
      accountPage: {
        data: [],
        meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 },
      },
      loading: false,
    };

    render(<AdminAccountsManagement />);

    expect(screen.getByText('Chưa có tài khoản Admin')).toBeTruthy();
  });

  it('shows a retry action when loading the account list fails', () => {
    state.hook = {
      ...state.hook,
      error: 'Không thể kết nối đến máy chủ API.',
      loading: false,
    };

    render(<AdminAccountsManagement />);

    expect(screen.getByRole('alert').textContent).toContain(
      'Không thể kết nối đến máy chủ API.',
    );
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('shows account creation only when the platform create permission is present', () => {
    setAdminPermissions(['admin-account:read', 'admin-account:create']);
    state.hook = {
      ...state.hook,
      accountPage: {
        data: [account],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      },
      loading: false,
    };

    render(<AdminAccountsManagement />);

    expect(screen.getByRole('button', { name: 'Thêm tài khoản' })).toBeTruthy();
  });

  it('creates an account with the selected tenant role and never offers a platform role', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:create']);
    state.hook = {
      ...state.hook,
      accountPage: {
        data: [account],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      },
      loading: false,
    };

    render(<AdminAccountsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm tài khoản Admin',
    });
    expect(
      within(dialog).queryByRole('checkbox', { name: 'Super Admin' }),
    ).toBeNull();
    expect(
      within(dialog).getByRole('checkbox', { name: 'Nhân viên bán vé' }),
    ).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText(/^Họ và tên/), {
      target: { value: 'Trần Minh Anh' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Số điện thoại/), {
      target: { value: '+84912345678' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Mật khẩu/), {
      target: { value: 'VexGo@123' },
    });
    await selectCanonicalOption(within(dialog).getByLabelText(/^Nhà xe/), /Phương Trang/);
    fireEvent.click(
      within(dialog).getByRole('checkbox', { name: 'Nhân viên bán vé' }),
    );
    fireEvent.change(within(dialog).getByLabelText('Ngày sinh'), {
      target: { value: '1998-05-14' },
    });
    fireEvent.change(within(dialog).getByLabelText('Email'), {
      target: { value: 'minhanh@example.test' },
    });
    fireEvent.change(within(dialog).getByLabelText('CCCD'), {
      target: { value: '079098001234' },
    });
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo tài khoản' }),
    );

    await waitFor(() =>
      expect(state.createAdminAccount).toHaveBeenCalledWith({
        fullName: 'Trần Minh Anh',
        phoneNumber: '+84912345678',
        password: 'VexGo@123',
        busCompanyId: 7,
        roleNames: ['NHAN_VIEN_BAN_VE'],
        dateOfBirth: '1998-05-14',
        email: 'minhanh@example.test',
        citizenId: '079098001234',
        position: null,
        joinedAt: null,
      }),
    );
    expect(state.hook.refresh).toHaveBeenCalledOnce();
  });

  it('rejects invalid phone, password and an empty role set before sending create', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:create']);
    render(<AdminAccountsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản' }));

    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm tài khoản Admin',
    });
    fireEvent.change(within(dialog).getByLabelText(/^Họ và tên/), {
      target: { value: 'Trần Minh Anh' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Số điện thoại/), {
      target: { value: '0912345678' },
    });
    fireEvent.change(within(dialog).getByLabelText(/^Mật khẩu/), {
      target: { value: 'short' },
    });
    await selectCanonicalOption(within(dialog).getByLabelText(/^Nhà xe/), /Phương Trang/);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo tài khoản' }),
    );

    expect(
      await within(dialog).findByText(
        'Số điện thoại phải có dạng +84xxxxxxxxx.',
      ),
    ).toBeTruthy();
    expect(
      within(dialog).getByText(/Mật khẩu phải dài từ 8 đến 72 byte/),
    ).toBeTruthy();
    expect(
      within(dialog).getByText('Vui lòng chọn ít nhất một vai trò nhà xe.'),
    ).toBeTruthy();
    expect(state.createAdminAccount).not.toHaveBeenCalled();
  });

  it('maps an existing phone conflict back to the phone field', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:create']);
    state.createAdminAccount.mockRejectedValue(
      new state.AdminAccountApiError(
        'Số điện thoại đã được đăng ký.',
        409,
        'PHONE_ALREADY_REGISTERED',
      ),
    );

    render(<AdminAccountsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm tài khoản Admin',
    });
    await within(dialog).findByRole('checkbox', { name: 'Nhân viên bán vé' });
    await fillRequiredCreateFields(dialog);
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Tạo tài khoản' }),
    );

    expect(
      await within(dialog).findByText('Số điện thoại đã được đăng ký.'),
    ).toBeTruthy();
    expect(
      within(dialog)
        .getByLabelText(/^Số điện thoại/)
        .getAttribute('aria-invalid'),
    ).toBe('true');
  });

  it('ignores a duplicate submit while account creation is pending', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:create']);
    let resolveCreate!: (createdAccount: typeof account) => void;
    state.createAdminAccount.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        }),
    );

    render(<AdminAccountsManagement />);
    fireEvent.click(screen.getByRole('button', { name: 'Thêm tài khoản' }));
    const dialog = await screen.findByRole('dialog', {
      name: 'Thêm tài khoản Admin',
    });
    await within(dialog).findByRole('checkbox', { name: 'Nhân viên bán vé' });
    await fillRequiredCreateFields(dialog);
    const submit = within(dialog).getByRole('button', {
      name: 'Tạo tài khoản',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(state.createAdminAccount).toHaveBeenCalledOnce();
    resolveCreate(account);
    await waitFor(() => expect(state.hook.refresh).toHaveBeenCalledOnce());
  });

  it('shows profile editing only with update permission and does not expose immutable identity fields', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Chỉnh sửa',
      }),
    );

    const editDialog = await screen.findByRole('dialog', {
      name: 'Chỉnh sửa tài khoản Admin',
    });
    expect(within(editDialog).getByLabelText(/^Họ và tên/)).toBeTruthy();
    expect(within(editDialog).getByLabelText('Email')).toBeTruthy();
    expect(within(editDialog).queryByLabelText('Số điện thoại')).toBeNull();
    expect(within(editDialog).queryByLabelText('Mã nhân viên')).toBeNull();
    expect(within(editDialog).queryByLabelText('Mật khẩu')).toBeNull();

    fireEvent.change(within(editDialog).getByLabelText(/^Họ và tên/), {
      target: { value: 'Nguyễn Minh Anh mới' },
    });
    fireEvent.click(
      within(editDialog).getByRole('button', { name: 'Lưu thay đổi' }),
    );

    await waitFor(() =>
      expect(state.updateAdminAccount).toHaveBeenCalledWith(41, {
        fullName: 'Nguyễn Minh Anh mới',
        dateOfBirth: '1998-05-14',
        email: 'minhanh@example.test',
        citizenId: '079098001234',
        position: 'Nhân viên kinh doanh',
        joinedAt: '2024-02-01',
      }),
    );
    expect(state.hook.refresh).toHaveBeenCalledOnce();
  });

  it('shows the lock action only to a platform account with update permission', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);

    render(<AdminAccountWorkspace accountId={41} initialAccount={account} />);

    expect(
      await screen.findByRole('button', { name: 'Khóa tài khoản' }),
    ).toBeTruthy();
  });

  it('requires confirmation and warns that locking revokes active sessions', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);

    render(<AdminAccountWorkspace accountId={41} initialAccount={account} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Khóa tài khoản' }),
    );

    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Khóa tài khoản này?',
    });
    expect(confirmation.textContent).toContain(
      'các phiên đăng nhập đang hoạt động sẽ bị thu hồi',
    );
  });

  it('locks an account after confirmation and refreshes the account list', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    state.updateAdminAccountStatus.mockResolvedValue(lockedAccount);

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Khóa tài khoản' }),
    );
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Khóa tài khoản này?',
    });
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Khóa tài khoản' }),
    );

    await waitFor(() =>
      expect(state.updateAdminAccountStatus).toHaveBeenCalledWith(
        41,
        'TAM_KHOA',
      ),
    );
    expect(await screen.findByText('Tạm khóa')).toBeTruthy();
    expect(state.hook.refresh).toHaveBeenCalledOnce();
  });

  it('unlocks a locked account without creating a new session', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    state.getAdminAccountById.mockResolvedValue(lockedAccount);
    state.updateAdminAccountStatus.mockResolvedValue(account);

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={lockedAccount}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Mở khóa tài khoản',
      }),
    );
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Mở khóa tài khoản này?',
    });
    expect(confirmation.textContent).toContain('không tạo phiên đăng nhập mới');
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Mở khóa tài khoản' }),
    );

    await waitFor(() =>
      expect(state.updateAdminAccountStatus).toHaveBeenCalledWith(
        41,
        'HOAT_DONG',
      ),
    );
    expect(await screen.findByText('Hoạt động')).toBeTruthy();
    expect(state.hook.refresh).toHaveBeenCalledOnce();
  });

  it('keeps the status confirmation open when the API request fails', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    state.updateAdminAccountStatus.mockRejectedValue(
      new Error('Không thể khóa tài khoản lúc này.'),
    );

    render(<AdminAccountWorkspace accountId={41} initialAccount={account} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Khóa tài khoản' }),
    );
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Khóa tài khoản này?',
    });
    fireEvent.click(
      within(confirmation).getByRole('button', { name: 'Khóa tài khoản' }),
    );

    expect(
      await screen.findByRole('alertdialog', { name: 'Khóa tài khoản này?' }),
    ).toBeTruthy();
    expect(screen.getByText('Hoạt động')).toBeTruthy();
    expect(state.hook.refresh).not.toHaveBeenCalled();
  });

  it('submits a pending status change only once', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    let resolveStatusChange!: (updatedAccount: typeof lockedAccount) => void;
    state.updateAdminAccountStatus.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveStatusChange = resolve;
        }),
    );

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Khóa tài khoản' }),
    );
    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Khóa tài khoản này?',
    });
    const submit = within(confirmation).getByRole('button', {
      name: 'Khóa tài khoản',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(state.updateAdminAccountStatus).toHaveBeenCalledOnce();
    resolveStatusChange(lockedAccount);
    await waitFor(() => expect(state.hook.refresh).toHaveBeenCalledOnce());
  });

  it('does not expose profile editing to a read-only platform account', async () => {
    setAdminPermissions(['admin-account:read']);

    render(<AdminAccountWorkspace accountId={41} initialAccount={account} />);

    expect(
      screen.queryByRole('button', {
        name: 'Chỉnh sửa',
      }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Khóa tài khoản' }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', {
        name: 'Gán vai trò',
      }),
    ).toBeNull();
  });

  it('replaces roles only with tenant catalog entries and refreshes the account', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    const updatedAccount = {
      ...account,
      roles: ['NHA_XE_ADMIN', 'NHAN_VIEN_BAN_VE'] as TenantRbacRoleName[],
    };
    state.replaceAdminAccountRoles.mockResolvedValue(updatedAccount);

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Gán vai trò',
      }),
    );

    const roleDialog = await screen.findByRole('dialog', {
      name: 'Gán vai trò tài khoản',
    });
    expect(
      (
        within(roleDialog).getByRole('checkbox', {
          name: 'Quản trị nhà xe',
        }) as HTMLInputElement
      ).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      (
        within(roleDialog).getByRole('checkbox', {
          name: 'Nhân viên bán vé',
        }) as HTMLInputElement
      ).getAttribute('aria-checked'),
    ).toBe('false');
    expect(
      within(roleDialog).queryByRole('checkbox', { name: 'Super Admin' }),
    ).toBeNull();
    expect(
      within(roleDialog).queryByRole('checkbox', { name: 'Khách hàng' }),
    ).toBeNull();

    fireEvent.click(
      within(roleDialog).getByRole('checkbox', { name: 'Nhân viên bán vé' }),
    );
    fireEvent.click(
      within(roleDialog).getByRole('button', { name: 'Lưu vai trò' }),
    );

    await waitFor(() =>
      expect(state.replaceAdminAccountRoles).toHaveBeenCalledWith(41, [
        'NHA_XE_ADMIN',
        'NHAN_VIEN_BAN_VE',
      ]),
    );
    expect(await screen.findByText('Nhân viên bán vé')).toBeTruthy();
    expect(state.hook.refresh).toHaveBeenCalledOnce();
  });

  it('requires explicit confirmation before revoking every role', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    const noRoleAccount = { ...account, roles: [] as TenantRbacRoleName[] };
    state.replaceAdminAccountRoles.mockResolvedValue(noRoleAccount);

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Gán vai trò',
      }),
    );
    const roleDialog = await screen.findByRole('dialog', {
      name: 'Gán vai trò tài khoản',
    });
    fireEvent.click(
      within(roleDialog).getByRole('checkbox', { name: 'Quản trị nhà xe' }),
    );
    fireEvent.click(
      within(roleDialog).getByRole('button', { name: 'Lưu vai trò' }),
    );

    const confirmation = await screen.findByRole('alertdialog', {
      name: 'Thu hồi toàn bộ vai trò?',
    });
    expect(confirmation.textContent).toContain(
      'tài khoản sẽ không còn quyền quản trị',
    );
    expect(state.replaceAdminAccountRoles).not.toHaveBeenCalled();
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Hủy' }));
    expect(
      screen.queryByRole('alertdialog', { name: 'Thu hồi toàn bộ vai trò?' }),
    ).toBeNull();
    expect(
      screen.getByRole('dialog', { name: 'Gán vai trò tài khoản' }),
    ).toBeTruthy();
    expect(state.replaceAdminAccountRoles).not.toHaveBeenCalled();

    fireEvent.click(
      within(roleDialog).getByRole('button', { name: 'Lưu vai trò' }),
    );
    const secondConfirmation = await screen.findByRole('alertdialog', {
      name: 'Thu hồi toàn bộ vai trò?',
    });
    fireEvent.click(
      within(secondConfirmation).getByRole('button', {
        name: 'Thu hồi vai trò',
      }),
    );

    await waitFor(() =>
      expect(state.replaceAdminAccountRoles).toHaveBeenCalledWith(41, []),
    );
    expect(await screen.findByText('Chưa được gán vai trò')).toBeTruthy();
    expect(state.hook.refresh).toHaveBeenCalledOnce();
  });

  it('keeps role assignment open and reports API errors', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    state.replaceAdminAccountRoles.mockRejectedValue(
      new Error('Không thể cập nhật vai trò lúc này.'),
    );

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Gán vai trò',
      }),
    );
    const roleDialog = await screen.findByRole('dialog', {
      name: 'Gán vai trò tài khoản',
    });
    fireEvent.click(
      within(roleDialog).getByRole('checkbox', { name: 'Nhân viên bán vé' }),
    );
    fireEvent.click(
      within(roleDialog).getByRole('button', { name: 'Lưu vai trò' }),
    );

    expect(await within(roleDialog).findByRole('alert')).toBeTruthy();
    expect(
      within(roleDialog).getByText('Không thể cập nhật vai trò lúc này.'),
    ).toBeTruthy();
    expect(state.hook.refresh).not.toHaveBeenCalled();
  });

  it('submits a pending role replacement only once', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    const updatedAccount = {
      ...account,
      roles: ['NHA_XE_ADMIN', 'NHAN_VIEN_BAN_VE'] as TenantRbacRoleName[],
    };
    let resolveRoleChange!: (value: typeof updatedAccount) => void;
    state.replaceAdminAccountRoles.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveRoleChange = resolve;
        }),
    );

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
        onAccountUpdated={() => state.hook.refresh()}
      />,
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Gán vai trò' }),
    );
    const roleDialog = await screen.findByRole('dialog', {
      name: 'Gán vai trò tài khoản',
    });
    fireEvent.click(
      within(roleDialog).getByRole('checkbox', { name: 'Nhân viên bán vé' }),
    );
    const submit = within(roleDialog).getByRole('button', {
      name: 'Lưu vai trò',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);

    expect(state.replaceAdminAccountRoles).toHaveBeenCalledOnce();
    expect(state.replaceAdminAccountRoles).toHaveBeenCalledWith(41, [
      'NHA_XE_ADMIN',
      'NHAN_VIEN_BAN_VE',
    ]);
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    resolveRoleChange(updatedAccount);
    await waitFor(() => expect(state.hook.refresh).toHaveBeenCalledOnce());
  });

  it('shows catalog errors and allows retry without enabling an unsafe save', async () => {
    setAdminPermissions(['admin-account:read', 'admin-account:update']);
    state.getDefaultRolePermissions.mockResolvedValue(roleCatalog);

    render(
      <AdminAccountWorkspace
        accountId={41}
        initialAccount={account}
      />,
    );

    state.getDefaultRolePermissions.mockRejectedValueOnce(
      new Error('Danh mục vai trò hiện không khả dụng.'),
    );

    fireEvent.click(
      await screen.findByRole('button', { name: 'Gán vai trò' }),
    );

    const roleDialog = await screen.findByRole('dialog', {
      name: 'Gán vai trò tài khoản',
    });
    expect(
      await within(roleDialog).findByText(
        'Danh mục vai trò hiện không khả dụng.',
      ),
    ).toBeTruthy();
    expect(
      (
        within(roleDialog).getByRole('button', {
          name: 'Lưu vai trò',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);

    fireEvent.click(
      within(roleDialog).getByRole('button', { name: 'Tải lại danh mục' }),
    );
    expect(
      await within(roleDialog).findByRole('checkbox', {
        name: 'Quản trị nhà xe',
      }),
    ).toBeTruthy();
    expect(
      within(roleDialog).queryByRole('checkbox', { name: 'Super Admin' }),
    ).toBeNull();
  });
});
