import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SendFreightPage from '../../../src/features/shipments/components/send-freight-page';

const api = vi.hoisted(() => ({
  searchTrips: vi.fn(),
  getCargoCategories: vi.fn(),
  getRoutePoints: vi.fn(),
  createShipment: vi.fn(),
  lookupShipment: vi.fn(),
  searchParams: new URLSearchParams(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => api.searchParams,
}));

vi.mock('@/features/trips/services/trips.api', () => ({
  tripsApi: { searchTrips: api.searchTrips },
}));

vi.mock('@/features/shipments/services/shipments.api', () => ({
  shipmentsApi: {
    getCargoCategories: api.getCargoCategories,
    getRoutePoints: api.getRoutePoints,
    createShipment: api.createShipment,
    lookupShipment: api.lookupShipment,
  },
}));

const createdShipment = {
  shipmentId: 601,
  orderId: 701,
  waybillCode: 'VG-VD-TEST-601',
  orderCode: 'VG-DH-TEST-701',
  status: 'MOI_TAO',
  paymentStatus: 'CHO_THANH_TOAN',
  sentAt: '2026-10-15T10:00:00.000Z',
  pricing: { baseFee: 50_000, serviceFee: 0, discount: 0, totalFee: 50_000 },
  sender: { fullName: 'Nguyễn An', phoneNumber: '0900000001', email: null },
  receiver: { fullName: 'Trần Bình', phoneNumber: '0900000002' },
  pickupPoint: { id: 901, name: 'Điểm gửi', address: 'Địa chỉ gửi' },
  dropoffPoint: { id: 902, name: 'Điểm nhận', address: 'Địa chỉ nhận' },
  trip: {
    tripId: 42,
    code: 'TRIP-42',
    departureTime: '2026-10-20T08:00:00.000Z',
    route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
    busCompany: { id: 4, name: 'Nhà xe kiểm thử' },
    vehicle: { licensePlate: '51A-00000' },
  },
  items: [
    {
      id: 1,
      name: 'Hồ sơ',
      quantity: 1,
      weight: 1,
      category: 'Tài liệu',
      dimensions: null,
      note: null,
    },
  ],
  timeline: [],
};

beforeEach(() => {
  window.sessionStorage.clear();
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  api.searchTrips.mockReset().mockResolvedValue({
    data: [
      {
        id: 42,
        code: 'TRIP-42',
        status: 'DANG_MO_BAN',
        busCompany: { id: 4, name: 'Nhà xe kiểm thử' },
        route: { origin: 'Đà Lạt', destination: 'TP.HCM' },
        departureTime: '2026-10-20T08:00:00.000Z',
        arrivalTime: null,
        vehicle: { licensePlate: '51A-00000' },
        price: 100_000,
        availableSeats: 20,
      },
    ],
  });
  api.getCargoCategories.mockReset().mockResolvedValue({
    data: [
      {
        categoryId: 21,
        name: 'Tài liệu',
        description: 'Hàng nhẹ',
        capacityGroup: 'parcels',
      },
    ],
  });
  api.getRoutePoints.mockReset().mockResolvedValue({
    data: {
      tripId: 42,
      senderPoints: [{ id: 901, name: 'Điểm gửi', address: 'Địa chỉ gửi' }],
      receiverPoints: [{ id: 902, name: 'Điểm nhận', address: 'Địa chỉ nhận' }],
    },
  });
  api.createShipment.mockReset().mockResolvedValue({ data: createdShipment });
  api.lookupShipment.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('independent shipment flow', () => {
  it('does not store an independent shipment as a booking payment draft', async () => {
    render(<SendFreightPage />);
    expect(
      await screen.findByText('Theo bảng cước', { exact: true }),
    ).toBeTruthy();
    expect(screen.queryByText('50.000đ', { exact: true })).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Nguyễn Văn A'), {
      target: { value: 'Nguyễn An' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('09xxxxxxxx')[0], {
      target: { value: '0900000001' },
    });
    fireEvent.change(screen.getByPlaceholderText('Ví dụ: Lê Thị B'), {
      target: { value: 'Trần Bình' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('09xxxxxxxx')[1], {
      target: { value: '0900000002' },
    });
    fireEvent.change(
      screen.getByPlaceholderText('Ví dụ: Thùng hoa quả, tài liệu, quần áo...'),
      {
        target: { value: 'Hồ sơ' },
      },
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Tài liệu' }));

    await waitFor(() => expect(api.getRoutePoints).toHaveBeenCalledWith(42));
    fireEvent.click(screen.getByRole('button', { name: 'Tạo mã vận đơn' }));

    expect(
      await screen.findByText('Tạo mã vận đơn gửi hàng thành công!'),
    ).toBeTruthy();
    expect(api.createShipment).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(window.sessionStorage.length).toBe(0));
  });
});
