// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CustomerDetails } from '@/features/customers/components/customer-details';
import { CustomerWorkspace } from '@/features/customers/components/customer-workspace';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customers/101',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}));

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

const mockTransactionBooking = {
  transactionId: 501,
  code: 'GD000501',
  createdDate: '2026-09-22T07:00:00.000Z',
  totalAmount: 320000,
  status: 'THANH_CONG',
  customerSnapshot: {
    fullName: 'Nguyễn Văn A',
    phoneNumber: '+84901234567',
    email: 'nguyenvana@example.com',
  },
  booking: {
    bookingId: 80,
    code: 'PDV000080',
    status: 'DA_XAC_NHAN',
  },
  shipment: null,
  createdAt: '2026-09-22T07:00:00.000Z',
  updatedAt: '2026-09-22T07:00:00.000Z',
};

const mockTransactionShipment = {
  transactionId: 502,
  code: 'GD000502',
  createdDate: '2026-09-25T09:00:00.000Z',
  totalAmount: 85000,
  status: 'THANH_CONG',
  customerSnapshot: {
    fullName: 'Nguyễn Văn A',
    phoneNumber: '+84901234567',
    email: 'nguyenvana@example.com',
  },
  booking: null,
  shipment: {
    shipmentId: 90,
    code: 'PGH000090',
    status: 'DA_NHAN_HANG',
  },
  createdAt: '2026-09-25T09:00:00.000Z',
  updatedAt: '2026-09-25T09:00:00.000Z',
};

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function installApi(options: {
  customerNotFound?: boolean;
  transactionsError?: boolean;
  transactions?: typeof mockTransactionBooking[];
} = {}) {
  setEmployeeAdminTestSession(['customer:read']);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4003');

  const requests: { url: string; method: string }[] = [];

  const mockFetch = vi.fn().mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    requests.push({ url, method });

    if (url.includes('/api/v1/customers/101/transactions')) {
      if (options.transactionsError) {
        return response({ message: 'Lỗi tải lịch sử giao dịch từ máy chủ.' }, false, 500);
      }
      const txs = options.transactions ?? [mockTransactionBooking, mockTransactionShipment];
      return response({
        data: txs,
        meta: {
          page: 1,
          pageSize: 10,
          totalItems: txs.length,
          totalPages: txs.length === 0 ? 0 : 1,
        },
      });
    }

    if (url.includes('/api/v1/customers/101')) {
      if (options.customerNotFound) {
        return response({ message: 'Không tìm thấy khách hàng.' }, false, 404);
      }
      return response({ data: mockCustomerDetail });
    }

    return response({}, false, 404);
  });

  vi.stubGlobal('fetch', mockFetch);
  return { requests };
}

describe('Customer Transaction History & Workspace (/customers/[customerId])', () => {
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

  it('renders link to activity workspace from customer detail sheet', async () => {
    installApi();
    render(<CustomerDetails customerId={101} onClose={vi.fn()} />);

    const link = await screen.findByRole('link', { name: 'Xem lịch sử hoạt động' });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/customers/101');
  });

  it('renders dedicated workspace with customer summary and transaction list', async () => {
    installApi();
    render(<CustomerWorkspace customerId={101} />);

    // Customer summary
    expect(await screen.findByText('KH000101')).toBeTruthy();
    expect(screen.getAllByText('Nguyễn Văn A').length).toBeGreaterThan(0);
    expect(screen.getByText('+84901234567')).toBeTruthy();
    expect(screen.getByText('nguyenvana@example.com')).toBeTruthy();
    expect(screen.getByText('150')).toBeTruthy();
    expect(screen.getByText('Đang hoạt động')).toBeTruthy();

    // Transactions list
    expect((await screen.findAllByText('GD000501')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('GD000502').length).toBeGreaterThan(0);
    expect(screen.getAllByText('320.000 đ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('85.000 đ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PDV000080').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PGH000090').length).toBeGreaterThan(0);
  });

  it('shows empty state when customer has no transactions with current tenant', async () => {
    installApi({ transactions: [] });
    render(<CustomerWorkspace customerId={101} />);

    expect(
      await screen.findByText('Chưa có giao dịch với nhà xe này.'),
    ).toBeTruthy();
  });

  it('shows safe error and retry when transactions API fails', async () => {
    installApi({ transactionsError: true });
    render(<CustomerWorkspace customerId={101} />);

    expect(
      await screen.findByText('Lỗi tải lịch sử giao dịch từ máy chủ.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('allows switching between Overview and Transactions tabs', async () => {
    installApi();
    render(<CustomerWorkspace customerId={101} />);

    const overviewTab = await screen.findByRole('tab', { name: 'Tổng quan' });
    const transactionsTab = screen.getByRole('tab', { name: 'Lịch sử giao dịch' });

    expect(transactionsTab.getAttribute('aria-selected')).toBe('true');
    expect(overviewTab.getAttribute('aria-selected')).toBe('false');

    // Click Overview tab
    fireEvent.click(overviewTab);

    expect(overviewTab.getAttribute('aria-selected')).toBe('true');
    expect(transactionsTab.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByText('#201')).toBeTruthy();
    expect(screen.getByText('Đã xác thực')).toBeTruthy();
  });

  it('handles customer not found (404) with safe error panel and link back to list', async () => {
    installApi({ customerNotFound: true });
    render(<CustomerWorkspace customerId={101} />);

    expect(
      await screen.findByText('Không tìm thấy khách hàng.'),
    ).toBeTruthy();
    const backLink = screen.getByRole('link', { name: 'Về danh sách khách hàng' });
    expect(backLink.getAttribute('href')).toBe('/customers');
  });
});
