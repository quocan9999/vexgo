// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

const { push, back } = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, back, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ tripId: '1' }),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => ({
    user: { id: 1, fullName: 'John Doe', phoneNumber: '0900000001', email: 'john@example.com' },
    accessToken: 'test-token',
    isAuthenticated: true,
    isHydrated: true,
    executeWithAuth: vi.fn(async (cb) => cb('test-token')),
  }),
}));

vi.mock('@/features/account/services/customer.api', () => ({
  customerApi: {
    getMe: vi.fn(async () => ({
      data: {
        id: 1,
        fullName: 'John Doe',
        phoneNumber: '0900000001',
        email: 'john@example.com',
        phoneVerified: true,
      },
    })),
  },
}));

vi.mock('@/features/trips/services/trips.api', () => ({
  tripsApi: {
    getCargoCapacity: vi.fn(async () => ({
      acceptsShipments: true,
      capacities: {
        motorcycles: { total: 5, used: 2, remaining: 3 },
        bulkyGoods: { total: 10, used: 4, remaining: 6 },
        parcels: { total: 20, used: 5, remaining: 15 },
      },
    })),
    getTripSeats: vi.fn(async () => []),
    getTripLuggagePackages: vi.fn(async () => ({
      packages: [],
      vehicles: {},
      surcharges: {},
    })),
  },
  busCompaniesApi: {
    getTripLuggagePackages: vi.fn(async () => ({
      packages: [],
      vehicles: {},
      surcharges: {},
    })),
  },
}));

vi.mock('@/features/promotions/services/promotions.api', () => ({
  promotionsApi: {
    getAvailablePromotions: vi.fn(async () => ({ data: [] })),
  },
}));

vi.mock('@/features/shipments/services/shipments.api', () => ({
  shipmentsApi: {
    getCargoCategories: vi.fn(async () => ({ data: [] })),
    getRoutePoints: vi.fn(async () => ({ senderPoints: [], receiverPoints: [] })),
  },
}));

import { BookingGuideModal } from '@/features/booking/components/booking-guide-modal';
import { FeaturePlaceholderModal } from '@/features/booking/components/feature-placeholder-modal';
import { LuggageSummary } from '@/features/booking/components/luggage/luggage-summary';
import { LuggageStep } from '@/features/booking/components/luggage/luggage-step';
import { OneWayBooking } from '@/features/booking/components/one-way-booking';
import { RoundTripBooking } from '@/features/booking/components/round-trip-booking';
import type { Post } from '@/features/posts/types/post';

const mockPost: Post = {
  id: '1',
  needType: 'BUY',
  province: 'Hồ Chí Minh',
  district: 'Đà Lạt',
  price: '250.000 đ',
  propertyType: 'Giường nằm 40 chỗ',
  description: '- Khởi hành đúng giờ\n- Nước suối khăn lạnh miễn phí',
  timeAgo: '08:00',
  createdAt: '2026-11-20T08:00:00.000Z',
  area: '',
  location: '',
  authorName: 'Nhà xe VexGo',
  authorCode: 'VG',
  authorPhone: '0901234567',
  title: 'Vé xe Sài Gòn - Đà Lạt',
};

const mockTripSeats = [
  { tripSeatId: 101, seatNumber: 'A01', status: 'TRONG', floor: 1, row: 1, col: 1, position: 'Tầng dưới' },
  { tripSeatId: 102, seatNumber: 'A02', status: 'DA_BAN', floor: 1, row: 1, col: 2, position: 'Tầng dưới' },
  { tripSeatId: 103, seatNumber: 'B01', status: 'TRONG', floor: 2, row: 1, col: 1, position: 'Tầng trên' },
];

describe('Booking & Trips Deep i18n & Zero-Hardcoded-Vi (Phase R2)', () => {
  beforeEach(() => {
    cleanup();
  });

  afterEach(() => {
    cleanup();
  });

  it('guarantees 100% key parity for booking namespace between vi and en dictionaries', () => {
    const viKeys = Object.keys(viMessages.booking || {}).sort();
    const enKeys = Object.keys(enMessages.booking || {}).sort();

    expect(viKeys.length).toBeGreaterThan(60);
    expect(enKeys.length).toBeGreaterThan(60);

    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInVi).toEqual([]);
  });

  it('guarantees 100% key parity for trips namespace between vi and en dictionaries', () => {
    const viKeys = Object.keys(viMessages.trips || {}).sort();
    const enKeys = Object.keys(enMessages.trips || {}).sort();

    expect(viKeys.length).toBeGreaterThan(50);
    expect(enKeys.length).toBeGreaterThan(50);

    const missingInEn = viKeys.filter((k) => !enKeys.includes(k));
    const missingInVi = enKeys.filter((k) => !viKeys.includes(k));

    expect(missingInEn).toEqual([]);
    expect(missingInVi).toEqual([]);
  });

  it('renders BookingGuideModal in Vietnamese when locale=vi', () => {
    render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <BookingGuideModal isOpen={true} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Hướng dẫn đặt vé trực tuyến')).toBeTruthy();
    expect(screen.getByText('4 bước đơn giản để sở hữu vé xe khách nhanh chóng trên VexGo')).toBeTruthy();
    expect(screen.getByText('Tìm chuyến xe')).toBeTruthy();
    expect(screen.getByText('Chọn chỗ ngồi ưng ý')).toBeTruthy();
    expect(screen.getByText('Thông tin & Mã ưu đãi')).toBeTruthy();
    expect(screen.getByText('Quét VietQR & Nhận vé ngay')).toBeTruthy();
    expect(screen.getByText('Lưu ý quan trọng khi đi xe')).toBeTruthy();
    expect(screen.getByText('Đã hiểu')).toBeTruthy();
  });

  it('renders BookingGuideModal with Zero-Hardcoded-Vi when locale=en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <BookingGuideModal isOpen={true} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Online Booking Guide')).toBeTruthy();
    expect(screen.getByText('4 simple steps to secure your bus ticket quickly on VexGo')).toBeTruthy();
    expect(screen.getByText('Search for trips')).toBeTruthy();
    expect(screen.getByText('Select preferred seat')).toBeTruthy();
    expect(screen.getByText('Details & Promo codes')).toBeTruthy();
    expect(screen.getByText('Scan VietQR & Get tickets')).toBeTruthy();
    expect(screen.getByText('Important travel notes')).toBeTruthy();
    expect(screen.getByText('Understood')).toBeTruthy();

    const dialogContent = document.querySelector('[role="dialog"]')?.textContent || '';
    expect(dialogContent).not.toContain('Hướng dẫn đặt vé');
    expect(dialogContent).not.toContain('4 bước đơn giản');
    expect(dialogContent).not.toContain('Đã hiểu');
  });

  it('renders FeaturePlaceholderModal with localized texts', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <FeaturePlaceholderModal isOpen={true} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Tính năng sắp có')).toBeTruthy();
    expect(screen.getByText('Đã hiểu')).toBeTruthy();
    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <FeaturePlaceholderModal isOpen={true} onClose={vi.fn()} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText('Coming soon')).toBeTruthy();
    expect(screen.getByText('Understood')).toBeTruthy();
  });

  it('renders LuggageSummary with locale-aware format and zero hardcoded Vietnamese when locale=en', () => {
    const { unmount } = render(
      <NextIntlClientProvider locale="vi" messages={viMessages}>
        <LuggageSummary totalWeight={15} fee={80000} hasCargo={true} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Hàng gửi hầm xe/)).toBeTruthy();
    expect(screen.getByText(/80.000đ/)).toBeTruthy();
    unmount();

    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LuggageSummary totalWeight={15} fee={80000} hasCargo={true} />
      </NextIntlClientProvider>,
    );
    expect(screen.getByText(/Cargo hold items/)).toBeTruthy();
    expect(screen.getByText(/80,000 VND/)).toBeTruthy();
    expect(screen.getByText(/Pay at station upon shipment/)).toBeTruthy();

    const textContent = document.body.textContent || '';
    expect(textContent).not.toContain('Hàng gửi hầm xe');
    expect(textContent).not.toContain('Thanh toán tại bến');
  });

  it('renders LuggageStep in English with zero hardcoded Vietnamese when locale=en', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <LuggageStep
          route="Ho Chi Minh - Da Lat"
          time="08:00 20/11/2026"
          seat="A01"
          passenger="John Doe"
          onFeeChange={vi.fn()}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('TRIP LUGGAGE & CARGO')).toBeTruthy();
    expect(screen.getByText('Do you need to check cargo in the luggage hold?')).toBeTruthy();
    expect(screen.getByText('Hand luggage only')).toBeTruthy();
    expect(screen.getByText('(Light carry-on baggage kept with you)')).toBeTruthy();
    expect(screen.getByText('Checked cargo in luggage hold')).toBeTruthy();
    expect(screen.getByText('Notice regarding baggage & cargo accompanied with trip:')).toBeTruthy();

    const containerText = document.body.textContent || '';
    expect(containerText).not.toContain('Bạn có hàng hóa');
    expect(containerText).not.toContain('Chỉ có hành lý xách tay');
    expect(containerText).not.toContain('Có hàng gửi dưới hầm xe');
    expect(containerText).not.toContain('Lưu ý về hành lý');
  });

  it('renders OneWayBooking UI shell in English with Zero-Hardcoded-Vi', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <OneWayBooking post={mockPost} tripSeats={mockTripSeats} />
      </NextIntlClientProvider>,
    );

    // Navigation & Seat picker header
    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getByText('Select seats')).toBeTruthy();
    expect(screen.getByText('3 seats')).toBeTruthy();
    expect(screen.getByText('Up to 5 seats')).toBeTruthy();
    expect(screen.getByText('Vehicle info')).toBeTruthy();

    // Legends
    expect(screen.getByText('Sold')).toBeTruthy();
    expect(screen.getByText('Available')).toBeTruthy();
    expect(screen.getByText('Selected')).toBeTruthy();

    // Passenger info section
    expect(screen.getByText('Customer information')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter full name')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter phone number')).toBeTruthy();
    expect(screen.getByPlaceholderText('Enter email address')).toBeTruthy();

    // Terms section
    expect(screen.getByText('Terms & Notes')).toBeTruthy();
    expect(screen.getByText('I agree to the terms')).toBeTruthy();
    expect(screen.getByText('of booking & VexGo privacy policy')).toBeTruthy();

    // Promo code section
    expect(screen.getByText('Promotion code')).toBeTruthy();
    expect(screen.getByText('Enter a promo code for this booking')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g. VEXGO50')).toBeTruthy();
    expect(screen.getByText('Apply')).toBeTruthy();

    // Action buttons
    expect(screen.getByText('Cancel')).toBeTruthy();
    expect(screen.getByText('Pay now')).toBeTruthy();

    // Sidebar
    expect(screen.getByText('Trip details')).toBeTruthy();
    expect(screen.getByText('Route')).toBeTruthy();
    expect(screen.getByText('Departure time')).toBeTruthy();
    expect(screen.getByText('Seat type')).toBeTruthy();
    expect(screen.getByText('Number of seats')).toBeTruthy();
    expect(screen.getByText('Seat numbers')).toBeTruthy();
    expect(screen.getByText('Price breakdown')).toBeTruthy();

    // ZERO-HARDCODED-VI ASSERTION on UI shell
    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('Chọn ghế');
    expect(bodyText).not.toContain('Thông tin khách hàng');
    expect(bodyText).not.toContain('Thông tin chuyến đi');
    expect(bodyText).not.toContain('Chi tiết giá');
    expect(bodyText).not.toContain('Chấp nhận điều khoản');
    expect(bodyText).not.toContain('Thanh toán');
  });

  it('renders RoundTripBooking UI shell in English with Zero-Hardcoded-Vi', () => {
    render(
      <NextIntlClientProvider locale="en" messages={enMessages}>
        <RoundTripBooking
          outboundPost={mockPost}
          returnPost={mockPost}
          departureDate="2026-11-20"
          returnDate="2026-11-25"
          outboundTripSeats={mockTripSeats}
          returnTripSeats={mockTripSeats}
        />
      </NextIntlClientProvider>,
    );

    expect(screen.getByText('Back')).toBeTruthy();
    expect(screen.getAllByText('Select seats').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Up to 5 seats/trip')).toBeTruthy();
    expect(screen.getByText('Customer information')).toBeTruthy();
    expect(screen.getByText('Terms & Notes')).toBeTruthy();
    expect(screen.getByText('Promotion code')).toBeTruthy();
    expect(screen.getByText('Trip details (Outbound trip)')).toBeTruthy();
    expect(screen.getByText('Trip details (Return trip)')).toBeTruthy();

    const bodyText = document.body.textContent || '';
    expect(bodyText).not.toContain('Thông tin khách hàng');
    expect(bodyText).not.toContain('Điều khoản & Lưu ý');
    expect(bodyText).not.toContain('Tối đa 5 ghế/chuyến');
  });
});
