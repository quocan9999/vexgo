// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { CustomerWorkspace } from '@/features/customers/components/customer-workspace';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/customers/101',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
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

const mockShipment = {
  shipmentId: 301,
  waybillCode: 'VD000301',
  sentAt: '2026-09-23T08:00:00.000Z',
  status: 'DANG_VAN_CHUYEN',
  receiver: {
    fullName: 'Trần Văn B',
    phoneNumber: '0912345678',
    address: '123 Lê Lợi, P.1, Đà Lạt',
  },
  pickupMethod: 'TAI_BUU_CUC',
  deliveryMethod: 'GIAO_TAN_NOI',
  pickupAddress: '456 Mai Chí Thọ, Q.2, TP.HCM',
  mainFee: 80000,
  serviceFee: 10000,
  discountAmount: 5000,
  totalFee: 85000,
  freightPayer: 'NGUOI_GUI',
  trip: {
    tripId: 101,
    code: 'FUTA-CX-0001',
  },
  originBranch: {
    branchId: 1,
    code: 'FUTA-BC-001',
    name: 'Bưu cục Miền Đông',
  },
  destinationBranch: {
    branchId: 2,
    code: 'FUTA-BC-002',
    name: 'Bưu cục Đà Lạt',
  },
};

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

function installApi(
  options: {
    customerNotFound?: boolean;
    shipmentsError?: boolean;
    shipments?: typeof mockShipment[];
  } = {},
) {
  setEmployeeAdminTestSession(['customer:read']);
  vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4003');

  const requests: { url: string; method: string }[] = [];

  const mockFetch = vi
    .fn()
    .mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      requests.push({ url, method });

      if (url.includes('/api/v1/customers/101/shipments')) {
        if (options.shipmentsError) {
          return response(
            { message: 'Lỗi tải lịch sử gửi hàng từ máy chủ.' },
            false,
            500,
          );
        }
        const shipments = options.shipments ?? [mockShipment];
        return response({
          data: shipments,
          meta: {
            page: 1,
            pageSize: 10,
            totalItems: shipments.length,
            totalPages: shipments.length === 0 ? 0 : 1,
          },
        });
      }

      if (url.includes('/api/v1/customers/101/transactions')) {
        return response({
          data: [],
          meta: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
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

describe('Customer Shipment History Tab (Feature 06.4)', () => {
  beforeAll(() => {
    Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
      configurable: true,
      value(this: HTMLDialogElement) {
        (
          this as HTMLDialogElement & { returnFocusTo?: Element | null }
        ).returnFocusTo = document.activeElement;
        this.setAttribute('open', '');
      },
    });
    Object.defineProperty(HTMLDialogElement.prototype, 'close', {
      configurable: true,
      value(this: HTMLDialogElement) {
        this.removeAttribute('open');
        const returnFocusTo = (
          this as HTMLDialogElement & { returnFocusTo?: Element | null }
        ).returnFocusTo;
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

  it('renders shipments tab in workspace and lists customer shipments', async () => {
    installApi();
    render(<CustomerWorkspace customerId={101} />);

    // Switch to Gửi hàng tab
    const shipmentsTab = await screen.findByRole('tab', { name: 'Gửi hàng' });
    fireEvent.click(shipmentsTab);

    expect(shipmentsTab.getAttribute('aria-selected')).toBe('true');

    // Shipment details
    expect((await screen.findAllByText('VD000301')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Trần Văn B').length).toBeGreaterThan(0);
    expect(screen.getAllByText('0912345678').length).toBeGreaterThan(0);
    expect(screen.getAllByText('85.000 đ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đang vận chuyển').length).toBeGreaterThan(0);
  });

  it('shows empty state when customer has no shipments with current tenant', async () => {
    installApi({ shipments: [] });
    render(<CustomerWorkspace customerId={101} />);

    const shipmentsTab = await screen.findByRole('tab', { name: 'Gửi hàng' });
    fireEvent.click(shipmentsTab);

    expect(
      await screen.findByText('Khách hàng chưa có đơn gửi hàng tại nhà xe này.'),
    ).toBeTruthy();
  });

  it('shows safe error and retry button when shipments API fails', async () => {
    installApi({ shipmentsError: true });
    render(<CustomerWorkspace customerId={101} />);

    const shipmentsTab = await screen.findByRole('tab', { name: 'Gửi hàng' });
    fireEvent.click(shipmentsTab);

    expect(
      await screen.findByText('Lỗi tải lịch sử gửi hàng từ máy chủ.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('allows searching shipments by query', async () => {
    const { requests } = installApi();
    render(<CustomerWorkspace customerId={101} />);

    const shipmentsTab = await screen.findByRole('tab', { name: 'Gửi hàng' });
    fireEvent.click(shipmentsTab);

    const searchInput = await screen.findByLabelText('Tìm kiếm đơn gửi hàng');
    fireEvent.change(searchInput, { target: { value: 'VD000301' } });

    // Wait a moment for debounced search
    await new Promise((r) => setTimeout(r, 400));

    expect(
      requests.some((r) => r.url.includes('search=VD000301')),
    ).toBe(true);
  });
});
