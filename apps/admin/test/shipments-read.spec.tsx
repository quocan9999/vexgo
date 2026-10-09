// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { AnchorHTMLAttributes } from 'react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ShipmentsManagement } from '@/features/shipments/components/shipments-management';
import { setEmployeeAdminTestSession } from './admin-auth-test-session';

vi.mock('next/navigation', () => ({
  usePathname: () => '/shipments',
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

const mockShipmentSummary = {
  shipmentId: 10,
  waybillCode: 'VD20261009001',
  sentAt: '2026-10-09T08:00:00.000Z',
  status: 'MOI_TAO',
  sender: {
    fullName: 'Trần Văn Gửi',
    phoneNumber: '+84911222333',
  },
  receiver: {
    fullName: 'Lê Thị Nhận',
    phoneNumber: '+84944555666',
  },
  trip: {
    tripId: 5,
    code: 'CX005',
    departureDate: '2026-10-10',
    departureTime: '09:00',
  },
  originPoint: {
    pointId: 1,
    name: 'Bến xe Miền Đông',
    code: 'BXMD',
    address: '292 Đinh Bộ Lĩnh, Bình Thạnh',
  },
  destinationPoint: {
    pointId: 2,
    name: 'Bến xe Đà Lạt',
    code: 'BXDL',
    address: '01 Tô Hiến Thành, Đà Lạt',
  },
  totalFee: 150000,
};

const mockShipmentDetail = {
  shipmentId: 10,
  waybillCode: 'VD20261009001',
  sentAt: '2026-10-09T08:00:00.000Z',
  status: 'MOI_TAO',
  note: 'Hàng dễ vỡ, xin nhẹ tay',
  sender: {
    fullName: 'Trần Văn Gửi',
    phoneNumber: '+84911222333',
  },
  receiver: {
    fullName: 'Lê Thị Nhận',
    phoneNumber: '+84944555666',
  },
  trip: {
    tripId: 5,
    code: 'CX005',
    departureDate: '2026-10-10',
    departureTime: '09:00',
  },
  originPoint: {
    pointId: 1,
    name: 'Bến xe Miền Đông',
    code: 'BXMD',
    address: '292 Đinh Bộ Lĩnh, Bình Thạnh',
  },
  destinationPoint: {
    pointId: 2,
    name: 'Bến xe Đà Lạt',
    code: 'BXDL',
    address: '01 Tô Hiến Thành, Đà Lạt',
  },
  cargoItems: [
    {
      cargoId: 1,
      name: 'Thùng trái cây sấy',
      typeName: 'Nông sản',
      weightKg: 5.5,
      quantity: 2,
      dimensions: {
        length: 30,
        width: 20,
        height: 15,
      },
      declaredValue: 500000,
      description: 'Hàng đóng thùng carton',
    },
  ],
  cargoFeeDetails: [
    {
      feeDetailId: 1,
      cargoTypeName: 'Nông sản',
      chargeableWeightKg: 5.5,
      fee: 150000,
    },
  ],
  feeSummary: {
    mainFee: 150000,
    serviceFee: 0,
    discountAmount: 0,
    totalFee: 150000,
    freightPayer: 'NGUOI_GUI',
  },
  history: [
    {
      historyId: 1,
      status: 'MOI_TAO',
      time: '2026-10-09T08:00:00.000Z',
      note: 'Tạo phiếu gửi mới qua quầy',
      actor: {
        accountId: 5,
        fullName: 'Nhân viên Điều hành',
      },
    },
  ],
  totalFee: 150000,
};

function response(body: unknown, ok = true, status = ok ? 200 : 500): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('ShipmentsManagement UI', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4003');
    HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
      this.open = true;
    };
    HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
      this.open = false;
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders shipment list from real API envelope with table and shared components', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          response({
            data: [mockShipmentSummary],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
            },
          }),
        );
      }
      return Promise.resolve(response({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    expect(
      screen.getByRole('heading', { name: 'Danh sách phiếu gửi hàng' }),
    ).toBeTruthy();

    const waybills = await screen.findAllByText('VD20261009001');
    expect(waybills.length).toBeGreaterThan(0);

    expect(screen.getAllByText('Trần Văn Gửi').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Lê Thị Nhận').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bến xe Miền Đông').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Bến xe Đà Lạt').length).toBeGreaterThan(0);
    expect(screen.getAllByText('150.000 đ').length).toBeGreaterThan(0);

    const detailButtons = screen.getAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    });
    expect(detailButtons.length).toBeGreaterThan(0);

    // Verify Read-Management boundary: Không có action mutation trong Phase 03
    expect(screen.queryByRole('button', { name: /thêm/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /tạo/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /xóa/i })).toBeNull();
  });

  it('opens detail sheet with cargo, fees, and timeline history when clicking detail button', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(
          response({
            data: mockShipmentDetail,
          }),
        );
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          response({
            data: [mockShipmentSummary],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
            },
          }),
        );
      }
      return Promise.resolve(response({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const waybills = await screen.findAllByText('VD20261009001');
    expect(waybills.length).toBeGreaterThan(0);

    const detailButton = screen.getAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    })[0];
    fireEvent.click(detailButton);

    expect(
      await screen.findByRole('heading', { name: 'Chi tiết phiếu gửi' }),
    ).toBeTruthy();

    expect(await screen.findByText('Thùng trái cây sấy')).toBeTruthy();
    expect(screen.getByText('Hàng dễ vỡ, xin nhẹ tay')).toBeTruthy();
    expect(screen.getByText('Nhân viên Điều hành')).toBeTruthy();
    expect(screen.getByText(/Tạo phiếu gửi mới qua quầy/)).toBeTruthy();
    expect(screen.getByText('Người gửi trả')).toBeTruthy();
  });

  it('handles empty timeline and null actor without crashing', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const shipmentWithoutHistory = {
      ...mockShipmentDetail,
      history: [],
      note: null,
    };

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(
          response({
            data: shipmentWithoutHistory,
          }),
        );
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          response({
            data: [mockShipmentSummary],
            meta: {
              page: 1,
              pageSize: 10,
              totalItems: 1,
              totalPages: 1,
            },
          }),
        );
      }
      return Promise.resolve(response({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const waybills = await screen.findAllByText('VD20261009001');
    expect(waybills.length).toBeGreaterThan(0);

    const detailButton = screen.getAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    })[0];
    fireEvent.click(detailButton);

    expect(
      await screen.findByText('Chưa có lịch sử trạng thái'),
    ).toBeTruthy();
  });

  it('renders empty filter state when no shipments match query', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      return Promise.resolve(
        response({
          data: [],
          meta: {
            page: 1,
            pageSize: 10,
            totalItems: 0,
            totalPages: 0,
          },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    expect(
      await screen.findByText('Chưa có phiếu gửi hàng nào trong hệ thống nhà xe.'),
    ).toBeTruthy();
  });
});
