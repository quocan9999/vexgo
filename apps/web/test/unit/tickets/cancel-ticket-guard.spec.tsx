import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import CancelTicketPage from '../../../src/features/tickets/components/cancel-ticket-page';
import {
  ticketsApi,
  ApiError,
} from '../../../src/features/account/services/tickets.api';

vi.mock('@/features/tickets/services/cancel-session', () => ({
  getCancelSession: () => ({
    ticketCode: 'VE-1',
    phoneNumber: '0901234567',
    ticket: {
      ticketId: 1,
      ticketCode: 'VE-1',
      status: 'DA_THANH_TOAN',
      price: 100000,
      departureTime: '2099-12-01T08:00:00Z',
      passengerPhone: '0901234567',
      cancellation: {
        eligible: true,
        cancelFeeRate: 0.1,
        cancelFee: 10000,
        refundAmount: 90000,
      },
    },
  }),
  clearCancelSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('displays the server cargo restriction and disables confirmation after a stale eligible page receives 409', async () => {
  vi.spyOn(ticketsApi, 'cancelTicket').mockRejectedValue(
    new ApiError(
      'Đơn có hàng gửi kèm còn hiệu lực. Vui lòng liên hệ nhà xe để được hỗ trợ hủy vé.',
      409,
      'TICKET_CANCELLATION_ACTIVE_SHIPMENT',
    ),
  );
  render(<CancelTicketPage />);
  fireEvent.click(screen.getByRole('checkbox'));
  fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy vé' }));
  expect(
    await screen.findByText(/Đơn có hàng gửi kèm còn hiệu lực.*liên hệ nhà xe/),
  ).toBeTruthy();
  await waitFor(() =>
    expect(
      (
        screen.getByRole('button', {
          name: 'Xác nhận hủy vé',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true),
  );
  expect(ticketsApi.cancelTicket).toHaveBeenCalledOnce();
});
