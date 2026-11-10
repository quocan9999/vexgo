// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipmentCreateView } from '@/features/shipments/components/shipment-create-view';
import * as shipmentService from '@/features/shipments/services/shipment-service';
import * as locationService from '@/features/locations/services/location-service';

// Mock Next.js navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
}));

const mockLocations: locationService.LocationOption[] = [
  {
    id: 'loc-1',
    name: 'Hồ Chí Minh',
    value: 'Hồ Chí Minh',
    aliases: ['TPHCM', 'Sài Gòn'],
    versions: ['current'],
    kind: 'province',
    province: null,
  },
  {
    id: 'loc-2',
    name: 'Đà Lạt',
    value: 'Đà Lạt',
    aliases: ['Lâm Đồng'],
    versions: ['current'],
    kind: 'city',
    province: 'Lâm Đồng',
  },
];

const mockRoutes: shipmentService.AdminShipmentRouteOption[] = [
  {
    routeId: 101,
    busCompany: { id: 1, name: 'Phương Trang' },
    route: { origin: 'Hồ Chí Minh', destination: 'Đà Lạt' },
    minimumEstimatedFee: 50000,
  },
  {
    routeId: 102,
    busCompany: { id: 1, name: 'Phương Trang' },
    route: { origin: 'Đà Lạt', destination: 'Hồ Chí Minh' },
    minimumEstimatedFee: 50000,
  },
];

const mockCategories: shipmentService.AdminCargoCategory[] = [
  {
    categoryId: 1,
    name: 'Bưu phẩm',
    description: 'Thư từ, tài liệu',
    capacityGroup: 'HANG_NHE',
  },
];

const mockPoints: shipmentService.AdminRoutePointsResult = {
  senderPoints: [
    { id: 1, name: 'Bến xe Miền Đông', address: 'TP.HCM' },
  ],
  receiverPoints: [
    { id: 2, name: 'Bến xe Đà Lạt', address: 'Lâm Đồng' },
  ],
  rates: [],
};

const mockQuoteResult: shipmentService.AdminShipmentQuoteResult = {
  baseFee: 50000,
  serviceFee: 0,
  totalFee: 50000,
  rates: [
    {
      categoryId: 1,
      rateId: 5,
      billableWeight: 5,
      fee: 50000,
    },
  ],
};

const mockCreateResult: shipmentService.CreateAdminShipmentResult = {
  shipmentId: 999,
  waybillCode: '0123456789abcdef0123456789abcdef',
  orderCode: 'abcdef0123456789abcdef0123456789',
  orderId: 888,
  status: 'DA_TIEP_NHAN',
  paymentStatus: 'DA_THANH_TOAN',
  pricing: {
    baseFee: 50000,
    serviceFee: 0,
    discount: 0,
    totalFee: 50000,
  },
};

describe('ShipmentCreateView', () => {
  beforeEach(() => {
    vi.spyOn(locationService, 'getLocations').mockResolvedValue(mockLocations);
    vi.spyOn(shipmentService, 'getAdminShipmentRouteOptions').mockResolvedValue(mockRoutes);
    vi.spyOn(shipmentService, 'getAdminShipmentCategories').mockResolvedValue(mockCategories);
    vi.spyOn(shipmentService, 'getAdminRoutePointsByRoute').mockResolvedValue(mockPoints);
    vi.spyOn(shipmentService, 'quoteAdminShipment').mockResolvedValue(mockQuoteResult);
    vi.spyOn(shipmentService, 'createAdminShipment').mockResolvedValue(mockCreateResult);
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders initial loading then form controls, 2-point route selection and sticky pricing card', async () => {
    render(<ShipmentCreateView />);

    expect(screen.getByText('Tạo đơn gửi hàng tại quầy')).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByText('1. Tuyến vận chuyển & Điểm giao nhận')).not.toBeNull();
      expect(screen.getByText('2. Thông tin khách hàng')).not.toBeNull();
      expect(screen.getByText('3. Danh sách kiện hàng & Cân đo tại quầy')).not.toBeNull();
      expect(screen.getByText('Tóm tắt cước & Thanh toán')).not.toBeNull();
    });

    // Verify surcharges display explicit VND amounts matching backend & customer web
    expect(screen.getByText(/Hàng dễ vỡ \(\+20\.000\s*[đ₫]\)/i)).not.toBeNull();
    expect(screen.getByText(/Hàng có giá trị cao \(\+50\.000\s*[đ₫]\)/i)).not.toBeNull();

    // Verify freight payer shows human-readable Vietnamese, NEVER raw enum NGUOI_GUI
    expect(screen.getByText('Người gửi thanh toán tại quầy')).not.toBeNull();
    expect(screen.queryByText('NGUOI_GUI')).toBeNull();

    // Verify origin and destination are split into 2 separate points with swap button
    const originCombobox = screen.getByRole('combobox', { name: /Nơi gửi/i }) as HTMLInputElement;
    expect(originCombobox.value).toBe('Hồ Chí Minh');

    const destCombobox = screen.getByRole('combobox', { name: /Nơi nhận/i }) as HTMLInputElement;
    expect(destCombobox.value).toBe('Đà Lạt');

    const swapBtn = screen.getByRole('button', { name: /Đổi chiều tuyến/i });
    expect(swapBtn).not.toBeNull();

    // Verify matched route badge displays human-readable route information
    await waitFor(() => {
      expect(screen.getByText(/Tuyến (vận chuyển|xe áp dụng):/)).not.toBeNull();
      expect(screen.getByText(/Cước tối thiểu: 50\.000\s*[đ₫]/)).not.toBeNull();
    });

    // Verify station comboboxes display human-readable names, NEVER raw IDs
    await waitFor(() => {
      const senderPointCombobox = screen.getByRole('combobox', { name: /Điểm.*gửi/i }) as HTMLInputElement;
      expect(senderPointCombobox.value).toBe('Bến xe Miền Đông');

      const receiverPointCombobox = screen.getByRole('combobox', { name: /Điểm.*(trả|nhận)/i }) as HTMLInputElement;
      expect(receiverPointCombobox.value).toBe('Bến xe Đà Lạt');
    });

    const backLink = screen.getByRole('link', { name: /^Quay lại danh sách$/i });
    expect(backLink.getAttribute('href')).toBe('/shipments');
  });

  it('swaps origin and destination when clicking swap button', async () => {
    render(<ShipmentCreateView />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Đổi chiều tuyến/i })).not.toBeNull();
    });

    const originCombobox = screen.getByRole('combobox', { name: /Nơi gửi/i }) as HTMLInputElement;
    const destCombobox = screen.getByRole('combobox', { name: /Nơi nhận/i }) as HTMLInputElement;
    const swapBtn = screen.getByRole('button', { name: /Đổi chiều tuyến/i });

    expect(originCombobox.value).toBe('Hồ Chí Minh');
    expect(destCombobox.value).toBe('Đà Lạt');

    // Click swap button
    fireEvent.click(swapBtn);

    await waitFor(() => {
      expect(originCombobox.value).toBe('Đà Lạt');
      expect(destCombobox.value).toBe('Hồ Chí Minh');
    });
  });

  it('validates empty inputs on submit', async () => {
    render(<ShipmentCreateView />);

    await waitFor(() => {
      expect(screen.getByText('Xác nhận tạo đơn tại quầy')).not.toBeNull();
    });

    const submitBtn = screen.getByText('Xác nhận tạo đơn tại quầy');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Vui lòng kiểm tra và sửa.*trường thông tin chưa hợp lệ/),
      ).not.toBeNull();
      expect(screen.getByText('Họ tên người gửi không được để trống.')).not.toBeNull();
      expect(screen.getByText('Họ tên người nhận không được để trống.')).not.toBeNull();
    });
  });

  it('submits valid data with counter acceptance and payment flags, displays success dialog with print tools', async () => {
    render(<ShipmentCreateView />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Nguyễn Văn A')).not.toBeNull();
    });

    // Fill sender
    fireEvent.change(screen.getByPlaceholderText('Nguyễn Văn A'), {
      target: { value: 'Nguyễn Văn Gửi' },
    });
    fireEvent.change(screen.getByPlaceholderText('0901234567'), {
      target: { value: '0901234567' },
    });

    // Fill receiver
    fireEvent.change(screen.getByPlaceholderText('Trần Thị B'), {
      target: { value: 'Trần Thị Nhận' },
    });
    fireEvent.change(screen.getByPlaceholderText('0987654321'), {
      target: { value: '0987654321' },
    });

    // Fill cargo item
    fireEvent.change(screen.getByPlaceholderText(/Thùng trái cây/), {
      target: { value: 'Thùng bơ sáp' },
    });
    fireEvent.change(screen.getByPlaceholderText('5.0'), {
      target: { value: '5' },
    });

    const submitBtn = screen.getByText('Xác nhận tạo đơn tại quầy');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(shipmentService.createAdminShipment).toHaveBeenCalledWith(
        expect.objectContaining({
          routeId: 101,
          senderPointId: 1,
          receiverPointId: 2,
          acceptAtCounter: true,
          collectPaymentAtCounter: true,
          freightPayer: 'NGUOI_GUI',
          paymentMethod: 'TAI_BEN',
          sender: expect.objectContaining({
            fullName: 'Nguyễn Văn Gửi',
            phoneNumber: '0901234567',
          }),
          receiver: expect.objectContaining({
            fullName: 'Trần Thị Nhận',
            phoneNumber: '0987654321',
          }),
          items: [
            expect.objectContaining({
              name: 'Thùng bơ sáp',
              weight: 5,
              quantity: 1,
            }),
          ],
        }),
        expect.stringMatching(/^counter-/),
      );
    });

    // Verify Success Dialog is open
    await waitFor(() => {
      expect(screen.getByText('Tạo đơn gửi hàng thành công!')).not.toBeNull();
      expect(screen.getByText('0123456789abcdef0123456789abcdef')).not.toBeNull();
      expect(screen.getByText('In tem kiện (100×150)')).not.toBeNull();
      expect(screen.getByText('In biên nhận (K80)')).not.toBeNull();
      expect(screen.getByText('Tạo tiếp đơn mới')).not.toBeNull();
    });

    // Click "Tạo tiếp đơn mới"
    const createNextBtn = screen.getByText('Tạo tiếp đơn mới');
    fireEvent.click(createNextBtn);

    // Dialog should close and inputs should be cleared
    await waitFor(() => {
      expect(screen.queryByText('Tạo đơn gửi hàng thành công!')).toBeNull();
      expect((screen.getByPlaceholderText('Nguyễn Văn A') as HTMLInputElement).value).toBe('');
      expect((screen.getByPlaceholderText('Trần Thị B') as HTMLInputElement).value).toBe('');
    });
  });
});
