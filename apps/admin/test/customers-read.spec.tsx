// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CustomersManagement } from '@/features/customers/components/customers-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customers',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

const mockCustomerSummary = {
  customerId: 101,
  customerCode: 'KH000101',
  fullName: 'Nguyễn Văn A',
  phoneNumber: '+84901234567',
  email: 'nguyenvana@example.com',
  loyaltyPoints: 150,
  account: {
    accountId: 201,
    status: 'HOAT_DONG',
    phoneVerified: true,
  },
  createdAt: '2026-09-01T08:30:00.000Z',
  updatedAt: '2026-09-02T08:30:00.000Z',
};

const mockCustomerDetail = {
  customerId: 101,
  customerCode: 'KH000101',
  fullName: 'Nguyễn Văn A',
  phoneNumber: '+84901234567',
  email: 'nguyenvana@example.com',
  loyaltyPoints: 150,
  account: {
    accountId: 201,
    status: 'HOAT_DONG',
    phoneVerified: true,
    createdAt: '2026-09-01T08:30:00.000Z',
    updatedAt: '2026-09-02T08:30:00.000Z',
  },
  createdAt: '2026-09-01T08:30:00.000Z',
  updatedAt: '2026-09-02T08:30:00.000Z',
};

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function installApi(options: {
  customers?: typeof mockCustomerSummary[];
  totalItems?: number;
  totalPages?: number;
  detailCustomer?: typeof mockCustomerDetail;
  error?: boolean;
} = {}) {
  setEmployeeAdminTestSession(['customer:read']);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4003');

  const requests: { url: string; method: string }[] = [];

  const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ url, method });

    if (options.error) {
      return response({ message: 'Lỗi tải dữ liệu khách hàng từ máy chủ.' }, false, 500);
    }

    if (url.includes('/api/v1/customers/101')) {
      return response({ data: options.detailCustomer ?? mockCustomerDetail });
    }

    if (url.includes('/api/v1/customers')) {
      const customers = options.customers ?? [mockCustomerSummary];
      return response({
        data: customers,
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: options.totalItems ?? customers.length,
          totalPages: options.totalPages ?? 1,
        },
      });
    }

    return response({}, false, 404);
  });

  vi.stubGlobal('fetch', mockFetch);
  return { requests };
}

describe('Customer Directory & Detail (/customers)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        (this as HTMLDialogElement & { returnFocusTo?: Element | null }).returnFocusTo = document.activeElement;
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        const returnFocusTo = (this as HTMLDialogElement & { returnFocusTo?: Element | null }).returnFocusTo;
        if (returnFocusTo instanceof HTMLElement) returnFocusTo.focus();
        this.dispatchEvent(new Event('close'));
      },
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('renders customer list and result summary without mutation actions', async () => {
    installApi();
    render(<CustomersManagement />);

    expect((await screen.findAllByText('KH000101')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0);
    expect(screen.getAllByText('+84901234567').length).toBeGreaterThan(0);
    expect(screen.getAllByText('nguyenvana@example.com').length).toBeGreaterThan(0);
    expect(screen.getAllByText('150').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang hoạt động').length).toBeGreaterThan(0);

    // Verify result count summary
    expect(screen.getByText('1 kết quả')).toBeTruthy();

    // Verify Read-Management boundary: NO create button, NO edit button, NO status toggle
    expect(screen.queryByRole('button', { name: /thêm/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /tạo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /chỉnh sửa/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /khóa/i })).toBeNull();
  });

  it('shows empty state when no customers are returned', async () => {
    installApi({ customers: [], totalItems: 0 });
    render(<CustomersManagement />);

    expect(
      await screen.findByText('Chưa có khách hàng nào trong hệ thống nhà xe.'),
    ).toBeTruthy();
  });

  it('shows filtered empty state and allows resetting filters', async () => {
    installApi({ customers: [], totalItems: 0 });
    render(<CustomersManagement />);

    const searchInput = screen.getByPlaceholderText('Tìm theo mã, tên, SĐT, email...');
    fireEvent.change(searchInput, { target: { value: 'KhôngTồnTại' } });

    expect(
      await screen.findByText('Không tìm thấy khách hàng phù hợp với bộ lọc.'),
    ).toBeTruthy();

    const resetButton = screen.getByRole('button', { name: 'Đặt lại bộ lọc' });
    fireEvent.click(resetButton);

    expect((searchInput as HTMLInputElement).value).toBe('');
  });

  it('shows error panel on API failure and allows retry', async () => {
    installApi({ error: true });
    render(<CustomersManagement />);

    expect(
      await screen.findByText('Lỗi tải dữ liệu khách hàng từ máy chủ.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();

    const retryButton = screen.getByRole('button', { name: 'Thử lại' });
    expect(retryButton).toBeTruthy();
  });

  it('opens customer detail sheet with complete account and metadata upon clicking detail action', async () => {
    installApi();
    render(<CustomersManagement />);

    const detailButtons = await screen.findAllByRole('button', { name: /xem chi tiết/i });
    expect(detailButtons.length).toBeGreaterThan(0);
    fireEvent.click(detailButtons[0]);

    const sheet = await screen.findByRole('dialog', { name: 'Chi tiết khách hàng' });
    expect(sheet).toBeTruthy();

    expect(within(sheet).getByText(/KH000101/)).toBeTruthy();
    expect(within(sheet).getByText('Nguyễn Văn A')).toBeTruthy();
    expect(within(sheet).getByText('+84901234567')).toBeTruthy();
    expect(within(sheet).getByText('150')).toBeTruthy();
    expect(within(sheet).getByText(/201/)).toBeTruthy();
    expect(within(sheet).getByText('Đã xác thực')).toBeTruthy();

    // Close detail sheet
    const closeButton = within(sheet).getByRole('button', { name: 'Đóng thông tin khách hàng' });
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Chi tiết khách hàng' })).toBeNull();
    });
  });

  it('supports sorting columns with accessible aria-sort direction', async () => {
    installApi();
    render(<CustomersManagement />);

    const codeHeader = await screen.findByRole('columnheader', { name: /mã kh/i });
    expect(codeHeader.getAttribute('aria-sort')).toBe('ascending');

    // Click to toggle sort
    const sortBtn = within(codeHeader).getByRole('button');
    fireEvent.click(sortBtn);

    await waitFor(() => {
      const updatedHeader = screen.getByRole('columnheader', { name: /mã kh/i });
      expect(updatedHeader.getAttribute('aria-sort')).toBe('descending');
    });
  });
});
