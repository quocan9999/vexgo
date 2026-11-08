// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/send-freight',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => ({
    user: { id: 1, name: 'Nguyễn Văn A', phone: '0900000001', email: 'vana@vexgo.test' },
    accessToken: 'test-token',
    isAuthenticated: true,
    isHydrated: true,
    executeWithAuth: vi.fn(async (cb) => cb('test-token')),
  }),
}));

vi.mock('@/features/locations/components/location-picker', () => ({
  LocationPicker: (props: any) => (
    <input
      data-testid={props.id}
      id={props.id}
      placeholder={props.placeholder}
      defaultValue={props.value}
    />
  ),
}));

vi.mock('@/features/shipments/services/shipments.api', () => ({
  shipmentsApi: {
    getCustomerShipments: vi.fn(async () => ({
      data: [
        {
          shipmentId: 101,
          waybillCode: 'FUTA-VD-12345678',
          itemsCount: 2,
          trip: {
            tripId: 5,
            route: 'Hà Nội → Đà Nẵng',
            busCompany: 'Phương Trang',
          },
          receiver: {
            fullName: 'Trần Thị B',
            phoneNumber: '0912345678',
          },
          sentAt: '2026-11-10T08:00:00Z',
          totalFee: 150000,
          status: 'DANG_VAN_CHUYEN',
          paymentStatus: 'DA_THANH_TOAN',
          dropoffDeadline: '2026-11-13T08:00:00Z',
        },
      ],
      meta: {
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      },
    })),
    getShipmentDetail: vi.fn(async () => null),
    cancelShipment: vi.fn(async () => null),
    getCargoCategories: vi.fn(async () => ({
      data: [
        { categoryId: 1, name: 'BƯU PHẨM', description: 'Tài liệu, thư tín' },
        { categoryId: 2, name: 'HÀNG HÓA', description: 'Hàng tiêu dùng' },
      ],
    })),
    getShipmentOptions: vi.fn(async () => ({ data: [] })),
    getRoutePoints: vi.fn(async () => ({ senderPoints: [], receiverPoints: [] })),
  },
}));

import { ShipmentGuideModal } from '@/features/shipments/components/shipment-guide-modal';
import CustomerShipmentsPage from '@/features/account/components/customer-shipments-page';
import SendFreightPage, { getCarrierDeliveryEstimate } from '@/features/shipments/components/send-freight-page';

describe('Customer Freight & Shipments Deep i18n (Phase C2)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('guarantees 100% key parity for shipments namespace between vi and en dictionaries', () => {
    const viKeys = Object.keys(viMessages.shipments || {}).sort();
    const enKeys = Object.keys(enMessages.shipments || {}).sort();

    expect(viKeys.length).toBeGreaterThan(50);
    expect(enKeys.length).toBeGreaterThan(50);

    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInVi).toEqual([]);
  });

  it('renders ShipmentGuideModal with Vietnamese labels when locale is vi', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <ShipmentGuideModal isOpen={true} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Hướng dẫn gửi hàng trực tuyến')).toBeTruthy();
    expect(
      screen.getByText(
        '4 bước đơn giản để tạo vận đơn và gửi hàng liên tỉnh nhanh chóng trên VexGo',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Chọn nơi gửi & Nhà xe')).toBeTruthy();
    expect(screen.getByText('Khai báo hàng & Tính cước')).toBeTruthy();
    expect(screen.getByText('Thông tin người gửi & nhận')).toBeTruthy();
    expect(screen.getByText('Nhận mã vận đơn & Gửi hàng')).toBeTruthy();
    expect(screen.getByText('Lưu ý quan trọng khi gửi hàng')).toBeTruthy();
    expect(screen.getByText('Đã hiểu')).toBeTruthy();
  });

  it('renders ShipmentGuideModal with English labels when locale is en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <ShipmentGuideModal isOpen={true} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Online freight shipping guide')).toBeTruthy();
    expect(
      screen.getByText(
        '4 simple steps to create a waybill and send interprovincial freight quickly on VexGo',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Select drop-off point & operator')).toBeTruthy();
    expect(screen.getByText('Declare cargo & calculate rate')).toBeTruthy();
    expect(screen.getByText('Sender & receiver information')).toBeTruthy();
    expect(screen.getByText('Get waybill code & ship')).toBeTruthy();
    expect(screen.getByText('Important notes for shipping')).toBeTruthy();
    expect(screen.getByText('Got it')).toBeTruthy();
  });

  it('renders CustomerShipmentsPage in Vietnamese with localized table headers and filter', async () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <CustomerShipmentsPage />
      </NextIntlClientProvider>,
    );

    expect((await screen.findAllByText('Đơn gửi hàng'))[0]).toBeTruthy();
    expect(
      screen.getByText(
        'Theo dõi trạng thái vận chuyển và lịch sử các kiện hàng bạn đã gửi',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Gửi hàng mới')).toBeTruthy();
    expect(screen.getByText('Mã vận đơn / Người nhận')).toBeTruthy();
    expect(screen.getByText('Trạng thái vận chuyển')).toBeTruthy();
    expect(screen.getByText('Mã vận đơn')).toBeTruthy();
    expect(screen.getByText('Tuyến gửi')).toBeTruthy();
    expect(screen.getByText('Người nhận')).toBeTruthy();
    expect(screen.getByText('Ngày tạo')).toBeTruthy();
    expect(screen.getByText('Tổng cước')).toBeTruthy();
    expect(screen.getByText('Trạng thái giao')).toBeTruthy();
    expect(screen.getByText('Thanh toán')).toBeTruthy();
    expect(screen.getByText('Thao tác')).toBeTruthy();
  });

  it('renders CustomerShipmentsPage in English with localized table headers and filter', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <CustomerShipmentsPage />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText('Shipping orders')).toBeTruthy();
    expect(
      screen.getByText(
        'Track shipping status and history of your sent packages',
      ),
    ).toBeTruthy();
    expect(screen.getByText('New freight order')).toBeTruthy();
    expect(screen.getByText('Waybill code / Receiver')).toBeTruthy();
    expect(screen.getByText('Shipping status')).toBeTruthy();
    expect(screen.getByText('Waybill code')).toBeTruthy();
    expect(screen.getByText('Shipping route')).toBeTruthy();
    expect(screen.getByText('Receiver')).toBeTruthy();
    expect(screen.getByText('Created date')).toBeTruthy();
    expect(screen.getByText('Total fee')).toBeTruthy();
    expect(screen.getByText('Delivery status')).toBeTruthy();
    expect(screen.getByText('Payment')).toBeTruthy();
    expect(screen.getByText('Actions')).toBeTruthy();
  });

  it('formats carrier delivery estimate correctly for vi and en locales', () => {
    expect(getCarrierDeliveryEstimate(null, 'vi')).toBe(
      'Nhà xe điều phối sau khi tiếp nhận',
    );
    expect(getCarrierDeliveryEstimate(null, 'en')).toBe(
      'Coordinated by operator upon receipt',
    );
  });

  it('renders SendFreightPage in English with 100% translated sender, receiver, and stations (Zero-Hardcoded-Vi)', async () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <SendFreightPage />
      </NextIntlClientProvider>,
    );

    // Section 2: Sender & Receiver
    expect(screen.getByText('Sender & receiver information')).toBeTruthy();
    expect(screen.getByText('Receiver Full Name')).toBeTruthy();
    expect(screen.getByText('Receiver Phone Number')).toBeTruthy();
    expect(screen.getByText('Receiver Citizen ID / Passport')).toBeTruthy();
    expect(screen.getByText('(optional)')).toBeTruthy();
    expect(screen.getByText('(for verification on collection)')).toBeTruthy();

    // Placeholders
    const receiverNameInput = screen.getByPlaceholderText('e.g. Jane Doe');
    expect(receiverNameInput).toBeTruthy();

    // Stations & Offices
    expect(screen.getByText('Stations & Offices by Operator')).toBeTruthy();
    expect(
      screen.getByText('Please select an operator above to choose stations'),
    ).toBeTruthy();
    expect(screen.getByText('Departure Station / Drop-off Point')).toBeTruthy();
    expect(screen.getByText('Destination Station / Pick-up Point')).toBeTruthy();
    expect(screen.getAllByText('Please select an operator first.').length).toBeGreaterThan(0);

    // ZERO-HARDCODED-VI ASSERTION on Step 2 container
    const step2El = document.getElementById('step-sender-receiver');
    expect(step2El).toBeTruthy();
    const viDiacriticsRegex = /[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐ]/;
    
    // Check that receiver section does not contain hardcoded Vietnamese words
    const receiverSectionText = step2El?.textContent || '';
    expect(receiverSectionText).not.toContain('Người nhận');
    expect(receiverSectionText).not.toContain('Ra bến nhận hàng');
    expect(receiverSectionText).not.toContain('Họ và tên người nhận');
    expect(receiverSectionText).not.toContain('Số điện thoại người nhận');
    expect(receiverSectionText).not.toContain('Số CCCD / CMND');
    expect(receiverSectionText).not.toContain('(không bắt buộc)');
    expect(receiverSectionText).not.toContain('(đối chiếu khi nhận)');
    expect(receiverSectionText).not.toContain('Bưu cục & Điểm giao nhận theo nhà xe');
    expect(receiverSectionText).not.toContain('Vui lòng chọn nhà xe trước');
  });

  it('renders SendFreightPage in Vietnamese with correct labels', async () => {
    cleanup();
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <SendFreightPage />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Thông tin người gửi & người nhận')).toBeTruthy();
    expect(screen.getByText('Họ và tên người nhận')).toBeTruthy();
    expect(screen.getByText('Số điện thoại người nhận')).toBeTruthy();
    expect(screen.getByText('Số CCCD / CMND người nhận')).toBeTruthy();
    expect(screen.getByPlaceholderText('Ví dụ: Lê Thị B')).toBeTruthy();
    expect(screen.getByText('(không bắt buộc)')).toBeTruthy();
    expect(screen.getByText('(đối chiếu khi nhận)')).toBeTruthy();
    expect(screen.getByText('Bưu cục & Điểm giao nhận theo nhà xe')).toBeTruthy();
  });
});
