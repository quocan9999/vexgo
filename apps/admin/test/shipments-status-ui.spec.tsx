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

const mockShipmentDetailMoiTao = {
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
      typeName: 'Hoa quả',
      weightKg: 5.5,
      quantity: 2,
      dimensions: { length: 30, width: 20, height: 15 },
      declaredValue: 500000,
      description: 'Hàng khô đóng thùng carton',
    },
  ],
  cargoFeeDetails: [
    {
      feeDetailId: 1,
      cargoTypeName: 'Hoa quả',
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
        accountId: 1,
        fullName: 'Nhân viên Điều hành',
      },
    },
  ],
  totalFee: 150000,
};

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: async () => data,
  } as Response;
}

describe('Shipment Status Actions UI (Phase 05)', () => {
  beforeAll(() => {
    vi.stubEnv('NEXT_PUBLIC_API_URL', 'http://localhost:4003');
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('hides status action panel for read-only admin user without shipment:update', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(jsonResponse({ data: mockShipmentDetailMoiTao }));
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          jsonResponse({
            data: [mockShipmentSummary],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const detailButton = (await screen.findAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    }))[0];
    fireEvent.click(detailButton);

    expect(
      await screen.findByRole('heading', { name: 'Chi tiết phiếu gửi' }),
    ).toBeTruthy();

    // Verify no action buttons are rendered
    expect(screen.queryByText('Thao tác trạng thái:')).toBeNull();
    expect(
      screen.queryByRole('button', { name: 'Xác nhận đã tiếp nhận hàng' }),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Hủy phiếu gửi' })).toBeNull();
  });

  it('renders available transition actions for user with shipment:update on MOI_TAO', async () => {
    setEmployeeAdminTestSession(['shipment:read', 'shipment:update']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(jsonResponse({ data: mockShipmentDetailMoiTao }));
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          jsonResponse({
            data: [mockShipmentSummary],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const detailButton = (await screen.findAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    }))[0];
    fireEvent.click(detailButton);

    expect(
      await screen.findByRole('heading', { name: 'Chi tiết phiếu gửi' }),
    ).toBeTruthy();

    expect(await screen.findByText('Thao tác trạng thái:')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Xác nhận đã tiếp nhận hàng' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Hủy phiếu gửi' })).toBeTruthy();
  });

  it('opens confirmation dialog and successfully executes status transition', async () => {
    setEmployeeAdminTestSession(['shipment:read', 'shipment:update']);

    const updatedDetail = {
      ...mockShipmentDetailMoiTao,
      status: 'DA_TIEP_NHAN',
      history: [
        {
          historyId: 2,
          status: 'DA_TIEP_NHAN',
          time: '2026-10-09T09:00:00.000Z',
          note: 'Hàng đã nhập kho tại Bến xe Miền Đông',
          actor: { accountId: 1, fullName: 'Nhân viên Điều hành' },
        },
        ...mockShipmentDetailMoiTao.history,
      ],
    };

    let patchCalled = false;
    let patchPayload: unknown = null;

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10/status') && init?.method === 'PATCH') {
        patchCalled = true;
        patchPayload = JSON.parse(String(init.body));
        return Promise.resolve(
          jsonResponse({
            data: {
              shipmentId: 10,
              status: 'DA_TIEP_NHAN',
              updatedAt: '2026-10-09T09:00:00.000Z',
            },
          }),
        );
      }
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(
          jsonResponse({
            data: patchCalled ? updatedDetail : mockShipmentDetailMoiTao,
          }),
        );
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          jsonResponse({
            data: [mockShipmentSummary],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const detailButton = (await screen.findAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    }))[0];
    fireEvent.click(detailButton);

    const acceptButton = await screen.findByRole('button', {
      name: 'Xác nhận đã tiếp nhận hàng',
    });
    fireEvent.click(acceptButton);

    // Dialog should open
    expect(await screen.findByText('Tiếp nhận hàng gửi?')).toBeTruthy();

    const noteTextarea = screen.getByLabelText(/Ghi chú trạng thái/i);
    fireEvent.change(noteTextarea, {
      target: { value: 'Hàng đã nhập kho tại Bến xe Miền Đông' },
    });

    const confirmButton = screen.getByRole('button', {
      name: 'Xác nhận tiếp nhận',
    }) as HTMLButtonElement;
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(patchCalled).toBe(true);
    });

    expect(patchPayload).toEqual({
      status: 'DA_TIEP_NHAN',
      note: 'Hàng đã nhập kho tại Bến xe Miền Đông',
    });

    // Check refetched timeline and updated status
    expect(
      await screen.findByText(/Hàng đã nhập kho tại Bến xe Miền Đông/i),
    ).toBeTruthy();
  });

  it('displays 409 conflict error clearly in dialog without false success', async () => {
    setEmployeeAdminTestSession(['shipment:read', 'shipment:update']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10/status') && init?.method === 'PATCH') {
        return Promise.resolve(
          jsonResponse(
            {
              statusCode: 409,
              error: 'SHIPMENT_REFUND_REQUIRED',
              message:
                'Phiếu gửi hàng đã thanh toán thành công, không thể hủy khi chưa có quy trình hoàn tiền trong MVP.',
            },
            false,
            409,
          ),
        );
      }
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(jsonResponse({ data: mockShipmentDetailMoiTao }));
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          jsonResponse({
            data: [mockShipmentSummary],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const detailButton = (await screen.findAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    }))[0];
    fireEvent.click(detailButton);

    const cancelButton = await screen.findByRole('button', {
      name: 'Hủy phiếu gửi',
    });
    fireEvent.click(cancelButton);

    expect(await screen.findByText('Hủy phiếu gửi hàng?')).toBeTruthy();

    const confirmButton = screen.getByRole('button', {
      name: 'Xác nhận hủy',
    });
    fireEvent.click(confirmButton);

    // Dialog stays open and shows error
    expect(
      await screen.findByText(
        'Phiếu gửi hàng đã thanh toán thành công, không thể hủy khi chưa có quy trình hoàn tiền trong MVP.',
      ),
    ).toBeTruthy();
  });

  it('sends only one status request while the first submission is pending', async () => {
    setEmployeeAdminTestSession(['shipment:read', 'shipment:update']);

    const updatedDetail = {
      ...mockShipmentDetailMoiTao,
      status: 'DA_TIEP_NHAN',
      history: [
        {
          historyId: 2,
          status: 'DA_TIEP_NHAN',
          time: '2026-10-09T09:00:00.000Z',
          note: 'Đã tiếp nhận tại quầy',
          actor: { accountId: 1, fullName: 'Nhân viên Điều hành' },
        },
        ...mockShipmentDetailMoiTao.history,
      ],
    };
    let patchCount = 0;
    let releasePatch: ((response: Response) => void) | undefined;
    const patchResponse = new Promise<Response>((resolve) => {
      releasePatch = resolve;
    });

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10/status') && init?.method === 'PATCH') {
        patchCount += 1;
        return patchResponse;
      }
      if (url.includes('/api/v1/shipments/10')) {
        return Promise.resolve(
          jsonResponse({ data: patchCount > 0 ? updatedDetail : mockShipmentDetailMoiTao }),
        );
      }
      if (url.includes('/api/v1/shipments')) {
        return Promise.resolve(
          jsonResponse({
            data: [mockShipmentSummary],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const detailButton = (await screen.findAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    }))[0];
    fireEvent.click(detailButton);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Xác nhận đã tiếp nhận hàng',
      }),
    );

    const confirmButton = screen.getByRole('button', {
      name: 'Xác nhận tiếp nhận',
    }) as HTMLButtonElement;
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(patchCount).toBe(1);
      expect(confirmButton.disabled).toBe(true);
    });

    fireEvent.click(confirmButton);
    expect(patchCount).toBe(1);

    releasePatch?.(
      jsonResponse({
        data: {
          shipmentId: 10,
          status: 'DA_TIEP_NHAN',
          updatedAt: '2026-10-09T09:00:00.000Z',
        },
      }),
    );

    expect(await screen.findByText(/Đã tiếp nhận tại quầy/)).toBeTruthy();
    expect(patchCount).toBe(1);
  });

  it('refetches detail and list after another request changes shipment status', async () => {
    setEmployeeAdminTestSession(['shipment:read', 'shipment:update']);

    const latestDetail = {
      ...mockShipmentDetailMoiTao,
      status: 'DA_TIEP_NHAN',
      history: [
        {
          historyId: 2,
          status: 'DA_TIEP_NHAN',
          time: '2026-10-09T09:00:00.000Z',
          note: 'Đã tiếp nhận bởi nhân viên khác',
          actor: { accountId: 2, fullName: 'Nhân viên khác' },
        },
        ...mockShipmentDetailMoiTao.history,
      ],
    };
    const latestSummary = {
      ...mockShipmentSummary,
      status: 'DA_TIEP_NHAN',
    };
    let detailReadCount = 0;
    let listReadCount = 0;
    let patchCount = 0;

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/v1/shipments/10/status') && init?.method === 'PATCH') {
        patchCount += 1;
        return Promise.resolve(
          jsonResponse(
            {
              statusCode: 409,
              error: 'CONCURRENT_STATUS_UPDATE',
              message: 'Trạng thái phiếu gửi đã bị thay đổi bởi thao tác khác.',
            },
            false,
            409,
          ),
        );
      }
      if (url.includes('/api/v1/shipments/10')) {
        detailReadCount += 1;
        return Promise.resolve(
          jsonResponse({
            data: detailReadCount > 1 ? latestDetail : mockShipmentDetailMoiTao,
          }),
        );
      }
      if (url.includes('/api/v1/shipments')) {
        listReadCount += 1;
        return Promise.resolve(
          jsonResponse({
            data: [latestSummary],
            meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
          }),
        );
      }
      return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);

    const detailButton = (await screen.findAllByRole('button', {
      name: /Xem chi tiết phiếu gửi VD20261009001/i,
    }))[0];
    fireEvent.click(detailButton);

    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Xác nhận đã tiếp nhận hàng',
      }),
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Xác nhận tiếp nhận' }),
    );

    const statusError = await screen.findByRole('alert');
    expect(statusError.textContent).toMatch(/Trạng thái phiếu gửi/i);

    await waitFor(() => {
      expect(detailReadCount).toBe(2);
      expect(listReadCount).toBe(2);
    });

    expect(
      await screen.findByText(/Đã tiếp nhận bởi nhân viên khác/),
    ).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Xác nhận tiếp nhận' }),
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Đóng' })).toBeTruthy();
    expect(patchCount).toBe(1);
  });

  it('hides previous filter results and pagination when the new filter request fails', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname !== '/api/v1/shipments') {
        return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
      }
      if (url.searchParams.get('status') === 'DA_HUY') {
        return Promise.resolve(
          jsonResponse({ message: 'Không thể tải dữ liệu theo bộ lọc.' }, false, 503),
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: [mockShipmentSummary],
          meta: { page: 1, pageSize: 10, totalItems: 15, totalPages: 2 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);
    await waitFor(() => {
      expect(screen.getAllByText('VD20261009001')).toHaveLength(2);
    });

    fireEvent.click(screen.getByRole('combobox', { name: 'Trạng thái phiếu gửi' }));
    const cancelledOption = await screen.findByRole('option', { name: 'Đã hủy' });
    fireEvent.pointerDown(cancelledOption, { button: 0, pointerType: 'mouse' });
    fireEvent.pointerUp(cancelledOption, { button: 0, pointerType: 'mouse' });
    fireEvent.click(cancelledOption);

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Không thể tải dữ liệu theo bộ lọc.',
    );
    expect(screen.queryAllByText('VD20261009001')).toHaveLength(0);
    expect(screen.queryByText('Trang 1 / 2')).toBeNull();
    expect(screen.queryByText('Không tìm thấy phiếu gửi hàng phù hợp với bộ lọc.')).toBeNull();
  });

  it('hides previous page results and pagination when the new page request fails', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname !== '/api/v1/shipments') {
        return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
      }
      if (url.searchParams.get('page') === '2') {
        return Promise.resolve(
          jsonResponse({ message: 'Không thể tải trang tiếp theo.' }, false, 503),
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: [mockShipmentSummary],
          meta: { page: 1, pageSize: 10, totalItems: 15, totalPages: 2 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);
    await waitFor(() => {
      expect(screen.getAllByText('VD20261009001')).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Trang sau' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Không thể tải trang tiếp theo.',
    );
    expect(screen.queryAllByText('VD20261009001')).toHaveLength(0);
    expect(screen.queryByText('Trang 1 / 2')).toBeNull();
  });

  it('keeps matching rows visible and reports an error when refreshing the same query fails', async () => {
    setEmployeeAdminTestSession(['shipment:read']);

    let requestCount = 0;
    const fetchMock = vi.fn().mockImplementation((input: RequestInfo | URL) => {
      const url = new URL(String(input));
      if (url.pathname !== '/api/v1/shipments') {
        return Promise.resolve(jsonResponse({ message: 'Not found' }, false, 404));
      }
      requestCount += 1;
      if (requestCount > 1) {
        return Promise.resolve(
          jsonResponse({ message: 'Không thể làm mới danh sách.' }, false, 503),
        );
      }
      return Promise.resolve(
        jsonResponse({
          data: [mockShipmentSummary],
          meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ShipmentsManagement />);
    await waitFor(() => {
      expect(screen.getAllByText('VD20261009001')).toHaveLength(2);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Làm mới' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Không thể làm mới danh sách.',
    );
    expect(screen.getAllByText('VD20261009001')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Thử lại' })).toBeTruthy();
    expect(requestCount).toBe(2);
  });
});
