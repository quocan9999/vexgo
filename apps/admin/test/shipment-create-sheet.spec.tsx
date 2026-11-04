// @vitest-environment jsdom
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ShipmentCreateSheet } from '@/features/shipments/components/shipment-create-sheet';
import * as shipmentService from '@/features/shipments/services/shipment-service';

const mockRoutes: shipmentService.AdminShipmentRouteOption[] = [
  {
    routeId: 101,
    busCompany: { id: 1, name: 'Phương Trang' },
    route: { origin: 'Hồ Chí Minh', destination: 'Đà Lạt' },
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

describe('ShipmentCreateSheet', () => {
  beforeEach(() => {
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

  it('renders initial loading then form controls', async () => {
    render(<ShipmentCreateSheet onClose={vi.fn()} onCreated={vi.fn()} />);

    expect(screen.getByText('Tạo đơn gửi hàng tại quầy')).not.toBeNull();
    await waitFor(() => {
      expect(screen.getByText('1. Tuyến vận chuyển & Điểm giao nhận')).not.toBeNull();
      expect(screen.getByText('2. Thông tin khách hàng')).not.toBeNull();
      expect(screen.getByText('3. Danh sách kiện hàng & Cân đo tại quầy')).not.toBeNull();
    });
  });

  it('validates empty inputs on submit', async () => {
    render(<ShipmentCreateSheet onClose={vi.fn()} onCreated={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Tạo phiếu gửi hàng')).not.toBeNull();
    });

    const submitBtn = screen.getByText('Tạo phiếu gửi hàng');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/Vui lòng kiểm tra và sửa.*trường thông tin chưa hợp lệ/),
      ).not.toBeNull();
      expect(screen.getByText('Họ tên người gửi không được để trống.')).not.toBeNull();
      expect(screen.getByText('Họ tên người nhận không được để trống.')).not.toBeNull();
    });
  });

  it('submits valid data with counter acceptance and payment flags', async () => {
    const onCreated = vi.fn();
    render(<ShipmentCreateSheet onClose={vi.fn()} onCreated={onCreated} />);

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

    const submitBtn = screen.getByText('Tạo phiếu gửi hàng');
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
      expect(onCreated).toHaveBeenCalledWith(mockCreateResult);
    });
  });
});
