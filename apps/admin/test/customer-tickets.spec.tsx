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

const mockTicket = {
  ticketId: 901,
  ticketCode: 'VE000901',
  status: 'DA_XUAT',
  pickupPoint: 'Bến xe Miền Đông',
  listedPrice: 320000,
  actualPrice: 290000,
  booking: {
    bookingId: 80,
    code: 'PDV000080',
    bookedAt: '2026-09-22T07:00:00.000Z',
    status: 'HOAN_TAT',
  },
  trip: {
    tripId: 101,
    code: 'FUTA-CX-0001',
    departureDate: '2026-09-25',
    departureTime: '07:00:00',
    status: 'SAP_KHOI_HANH',
    route: {
      routeId: 12,
      code: 'FUTA-TX-0001',
      origin: 'TP.HCM',
      destination: 'Đà Lạt',
    },
    vehicle: {
      vehicleId: 8,
      licensePlate: '30F-123.45',
    },
  },
  seat: {
    seatId: 501,
    code: 'A01',
    position: 'Tầng dưới',
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
    ticketsError?: boolean;
    tickets?: typeof mockTicket[];
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

      if (url.includes('/api/v1/customers/101/tickets')) {
        if (options.ticketsError) {
          return response(
            { message: 'Lỗi tải lịch sử vé từ máy chủ.' },
            false,
            500,
          );
        }
        const tickets = options.tickets ?? [mockTicket];
        return response({
          data: tickets,
          meta: {
            page: 1,
            pageSize: 10,
            totalItems: tickets.length,
            totalPages: 1,
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
            totalPages: 1,
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

describe('Customer Ticket History Tab (Feature 06.3)', () => {
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

  it('renders tickets tab in workspace and lists customer tickets', async () => {
    installApi();
    render(<CustomerWorkspace customerId={101} />);

    // Switch to Vé tab
    const ticketsTab = await screen.findByRole('tab', { name: 'Vé' });
    fireEvent.click(ticketsTab);

    expect(ticketsTab.getAttribute('aria-selected')).toBe('true');

    // Ticket details
    expect((await screen.findAllByText('VE000901')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('PDV000080').length).toBeGreaterThan(0);
    expect(screen.getAllByText('TP.HCM → Đà Lạt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('290.000 đ').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Đã xuất vé').length).toBeGreaterThan(0);
  });

  it('shows empty state when customer has no tickets with current tenant', async () => {
    installApi({ tickets: [] });
    render(<CustomerWorkspace customerId={101} />);

    const ticketsTab = await screen.findByRole('tab', { name: 'Vé' });
    fireEvent.click(ticketsTab);

    expect(
      await screen.findByText('Khách hàng chưa có vé tại nhà xe này.'),
    ).toBeTruthy();
  });

  it('shows safe error and retry button when tickets API fails', async () => {
    installApi({ ticketsError: true });
    render(<CustomerWorkspace customerId={101} />);

    const ticketsTab = await screen.findByRole('tab', { name: 'Vé' });
    fireEvent.click(ticketsTab);

    expect(
      await screen.findByText('Lỗi tải lịch sử vé từ máy chủ.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
  });

  it('allows searching tickets by query', async () => {
    const { requests } = installApi();
    render(<CustomerWorkspace customerId={101} />);

    const ticketsTab = await screen.findByRole('tab', { name: 'Vé' });
    fireEvent.click(ticketsTab);

    const searchInput = await screen.findByLabelText('Tìm kiếm vé');
    fireEvent.change(searchInput, { target: { value: 'CX-0001' } });

    // Wait a moment for debounced search
    await new Promise((r) => setTimeout(r, 400));

    expect(
      requests.some((r) => r.url.includes('search=CX-0001')),
    ).toBe(true);
  });
});
