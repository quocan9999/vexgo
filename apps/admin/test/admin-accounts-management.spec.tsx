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
  roles: ['NHA_XE_ADMIN'] as const,
  employee: {
    employeeId: 81,
    employeeCode: 'PT-081',
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

const state = vi.hoisted(() => ({
  hook: {
    accountPage: null as unknown,
    error: null as string | null,
    loading: true,
    page: 1,
    searchInput: '',
    status: '' as string,
    sortBy: 'createdAt' as string,
    sortDirection: 'desc' as string,
    changePage: vi.fn(),
    refresh: vi.fn(),
    sortAccounts: vi.fn(),
    updateSearch: vi.fn(),
    updateStatus: vi.fn(),
  },
  getAdminAccountById: vi.fn(),
}));

vi.mock('lucide-react', () => {
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
    ArrowDown: icon('arrow-down'),
    ArrowUp: icon('arrow-up'),
    ArrowUpDown: icon('arrow-up-down'),
    Check: icon('check'),
    ChevronDown: icon('chevron-down'),
    ChevronLeft: icon('chevron-left'),
    ChevronRight: icon('chevron-right'),
    Eye: icon('eye'),
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
  getAdminAccountById: state.getAdminAccountById,
}));

import { AdminAccountsManagement } from '@/features/admin-accounts/components/admin-accounts-management';

describe('Admin accounts management page', () => {
  beforeEach(() => {
    state.hook = {
      accountPage: null,
      error: null,
      loading: true,
      page: 1,
      searchInput: '',
      status: '',
      sortBy: 'createdAt',
      sortDirection: 'desc',
      changePage: vi.fn(),
      refresh: vi.fn(),
      sortAccounts: vi.fn(),
      updateSearch: vi.fn(),
      updateStatus: vi.fn(),
    };
    state.getAdminAccountById.mockReset().mockResolvedValue(account);

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

  it('shows account identity and opens a detail sheet with tenant and role', async () => {
    state.hook = {
      ...state.hook,
      accountPage: {
        data: [account],
        meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
      },
      loading: false,
    };

    render(<AdminAccountsManagement />);

    expect(screen.getByText('Nguyễn Minh Anh')).toBeTruthy();
    expect(screen.getByText('+84912345678')).toBeTruthy();
    expect(screen.getByText('Phương Trang')).toBeTruthy();
    expect(screen.getByText('Quản trị nhà xe')).toBeTruthy();

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Xem chi tiết tài khoản Nguyễn Minh Anh',
      }),
    );

    expect(
      await screen.findByRole('heading', { name: 'Thông tin tài khoản' }),
    ).toBeTruthy();
    const detailSheet = screen.getByRole('dialog');
    expect(within(detailSheet).getByText('PT-081')).toBeTruthy();
    expect(within(detailSheet).getByText(/Phương Trang/)).toBeTruthy();
    await waitFor(() =>
      expect(state.getAdminAccountById).toHaveBeenCalledWith(
        41,
        expect.any(AbortSignal),
      ),
    );
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

    expect(screen.getByText('Không tìm thấy tài khoản Admin')).toBeTruthy();
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
});
