import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketSearchPage } from '../../../src/features/tickets/components/ticket-search-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        ticketId: 501,
        ticketCode: 'VE-501',
        bookingId: 41,
        bookingCode: 'PDV-41',
        promotionCode: 'SAVE50',
        originalTicketSubtotal: 300000,
        discountAmount: 50000,
        ticketSubtotal: 250000,
        route: 'TP.HCM - Đà Lạt',
        origin: 'TP.HCM',
        destination: 'Đà Lạt',
        busCompanyName: 'Nhà xe kiểm thử',
        vehicleType: 'Ghế ngồi',
        departureTime: '2026-10-20T08:00:00.000Z',
        arrivalTime: '2026-10-20T12:00:00.000Z',
        seatNumber: 'A01',
        seatPosition: 'Ghế thường',
        price: 125000,
        status: 'DA_DAT',
        bookingStatus: 'DA_THANH_TOAN',
        paymentStatus: 'DA_THANH_TOAN',
        paymentMethod: 'MOMO',
        pickup: 'Bến xe Miền Đông',
        dropoff: 'Bến xe Đà Lạt',
        passengerName: 'Nguyễn Văn An',
        passengerPhone: '0901234567',
        createdAt: '2026-10-14T10:00:00.000Z',
        updatedAt: '2026-10-14T10:05:00.000Z',
        cancellation: {
          eligible: false,
          cancelFeeRate: 0,
          cancelFee: 0,
          refundAmount: 0,
        },
      },
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ticket lookup promotion snapshot', () => {
  it('shows the linked code and booking-level discount once as a reference on ticket detail', async () => {
    render(<TicketSearchPage />);
    fireEvent.change(screen.getByPlaceholderText('Vui lòng nhập số điện thoại'), {
      target: { value: '0901234567' },
    });
    fireEvent.change(screen.getByPlaceholderText('Vui lòng nhập mã vé'), {
      target: { value: 'VE-501' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Tra cứu vé' }));

    expect(await screen.findByText('SAVE50')).toBeTruthy();
    expect(screen.getByText('Giảm giá của toàn đơn').parentElement?.textContent).toContain('50.000');
    expect(screen.getByText(/không lặp lại mức giảm trên từng vé/i)).toBeTruthy();
  });
});
