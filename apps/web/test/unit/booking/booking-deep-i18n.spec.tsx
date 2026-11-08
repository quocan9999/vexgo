// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import enMessages from '@/messages/en.json';
import viMessages from '@/messages/vi.json';

const { state, replace } = vi.hoisted(() => ({
  state: {
    pathname: '/',
  },
  replace: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ replace, push: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({ bookingId: 'test-booking-1' }),
}));

vi.mock('@/features/auth/auth-session', () => ({
  useAuthSession: () => ({
    user: null,
    isAuthenticated: false,
    isHydrated: true,
    executeWithAuth: vi.fn(),
  }),
}));

import { TripCard } from '@/features/trips/components/trip-card';
import { SeatPicker } from '@/features/booking/components/seat-picker';
import { TicketCard } from '@/features/tickets/components/ticket-card';
import { TicketLookupForm } from '@/features/tickets/components/ticket-lookup-form';
import type { Trip, Ticket } from '@/types/customer';

const mockTrip: Trip = {
  id: '101',
  operator: 'Phương Trang',
  origin: 'Hà Nội',
  destination: 'Đà Nẵng',
  departureTime: '08:00',
  arrivalTime: '20:00',
  duration: '12 giờ',
  vehicleType: 'Giường nằm',
  price: 350000,
  availableSeats: 12,
  totalSeats: 40,
  rating: 4.8,
  busCompanyId: 1,
  departureDate: '2026-11-15T08:00:00Z',
  image: '/images/route1.jpg',
  amenities: ['Wifi', 'Nước uống'],
  status: 'open',
};

const mockTicket: Ticket = {
  id: 'ticket-1',
  code: 'VX-123456',
  passenger: 'Nguyễn Văn A',
  phone: '0912345678',
  route: 'Hà Nội → Đà Nẵng',
  departure: '08:00, 15/11/2026',
  amount: 350000,
  seats: ['A01'],
  pickup: 'Bến xe Nước Ngầm',
  dropoff: 'Bến xe Trung tâm Đà Nẵng',
  status: 'confirmed',
  vehicleType: 'Giường nằm',
};

describe('Phase C1: Core Search & Booking Flow i18n Verification', () => {
  beforeEach(() => {
    cleanup();
    state.pathname = '/';
    replace.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  describe('Dictionary Parity for Phase C1 Namespaces', () => {
    const namespaces = ['trips', 'booking', 'tickets', 'payments', 'lookup'] as const;

    namespaces.forEach((ns) => {
      it(`has matching keys in "${ns}" namespace for both vi and en`, () => {
        const viKeys = Object.keys(viMessages[ns]).sort();
        const enKeys = Object.keys(enMessages[ns]).sort();
        expect(viKeys).toEqual(enKeys);
      });
    });
  });

  describe('TripCard component i18n', () => {
    it('renders TripCard in Vietnamese', () => {
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <TripCard trip={mockTrip} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Nhà xe')).toBeTruthy();
      expect(screen.getAllByText(/ghế trống/)[0]).toBeTruthy();
      expect(screen.getAllByText('Lịch trình')[0]).toBeTruthy();
      expect(screen.getByText('Xem đánh giá')).toBeTruthy();
      expect(screen.getByText('Gợi ý chuyến thay thế')).toBeTruthy();
      expect(screen.getByText('Chọn chuyến')).toBeTruthy();
    });

    it('renders TripCard in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <TripCard trip={mockTrip} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Operator')).toBeTruthy();
      expect(screen.getAllByText(/seats left/)[0]).toBeTruthy();
      expect(screen.getAllByText('Schedule')[0]).toBeTruthy();
      expect(screen.getByText('Reviews')).toBeTruthy();
      expect(screen.getByText('Alternative trips')).toBeTruthy();
      expect(screen.getByText('Select trip')).toBeTruthy();
    });
  });

  describe('SeatPicker component i18n', () => {
    it('renders SeatPicker in Vietnamese', () => {
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <SeatPicker trip={mockTrip} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Chọn ghế')).toBeTruthy();
      expect(screen.getByText('Bảo mật')).toBeTruthy();
      expect(screen.getByText('Còn trống')).toBeTruthy();
      expect(screen.getByText('Đang chọn')).toBeTruthy();
      expect(screen.getByText('Không khả dụng')).toBeTruthy();
      expect(screen.getByText('Tạm tính')).toBeTruthy();
      expect(screen.getByText(/Tiếp tục/)).toBeTruthy();
    });

    it('renders SeatPicker in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <SeatPicker trip={mockTrip} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Select Seats')).toBeTruthy();
      expect(screen.getByText('Secured')).toBeTruthy();
      expect(screen.getByText('Available')).toBeTruthy();
      expect(screen.getByText('Selecting')).toBeTruthy();
      expect(screen.getByText('Unavailable')).toBeTruthy();
      expect(screen.getByText('Subtotal')).toBeTruthy();
      expect(screen.getByText(/Continue/)).toBeTruthy();
    });
  });

  describe('TicketCard component i18n', () => {
    it('renders TicketCard in Vietnamese', () => {
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <TicketCard ticket={mockTicket} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Đã xác nhận')).toBeTruthy();
      expect(screen.getByText('Tổng tiền')).toBeTruthy();
      expect(screen.getByText(/Số ghế/)).toBeTruthy();
      expect(screen.getByText(/Điểm đón:/)).toBeTruthy();
      expect(screen.getByText(/Điểm trả:/)).toBeTruthy();
      expect(screen.getByText(/In vé/)).toBeTruthy();
    });

    it('renders TicketCard in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <TicketCard ticket={mockTicket} />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Confirmed')).toBeTruthy();
      expect(screen.getByText('Total Amount')).toBeTruthy();
      expect(screen.getByText(/Seat Number/)).toBeTruthy();
      expect(screen.getByText(/Pickup Point:/)).toBeTruthy();
      expect(screen.getByText(/Dropoff Point:/)).toBeTruthy();
      expect(screen.getByText(/Print Ticket/)).toBeTruthy();
    });
  });

  describe('TicketLookupForm component i18n', () => {
    it('renders TicketLookupForm in Vietnamese', () => {
      render(
        <NextIntlClientProvider locale="vi" messages={viMessages}>
          <TicketLookupForm />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Tra cứu thông tin đặt vé')).toBeTruthy();
      expect(screen.getByText('Số điện thoại')).toBeTruthy();
      expect(screen.getByText('Mã vé')).toBeTruthy();
      expect(screen.getByText('Tra cứu vé')).toBeTruthy();
    });

    it('renders TicketLookupForm in English', () => {
      render(
        <NextIntlClientProvider locale="en" messages={enMessages}>
          <TicketLookupForm />
        </NextIntlClientProvider>,
      );

      expect(screen.getByText('Look Up Ticket Information')).toBeTruthy();
      expect(screen.getByText('Phone Number')).toBeTruthy();
      expect(screen.getByText('Ticket Code')).toBeTruthy();
      expect(screen.getByText('Search Ticket')).toBeTruthy();
    });
  });
});
