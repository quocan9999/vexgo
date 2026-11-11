import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import CancelTicketPage from '../../../src/features/tickets/components/cancel-ticket-page';
import { ticketsApi } from '../../../src/features/account/services/tickets.api';

const mockMultiTickets = {
  ticketId: 101,
  ticketCode: 'VE-001',
  bookingCode: 'PDV-999',
  origin: 'TP.HCM',
  destination: 'Đà Lạt',
  busCompanyName: 'Phương Trang',
  status: 'CON_HAN',
  price: 250000,
  departureTime: '2099-10-25T08:00:00Z',
  seatNumber: 'A01',
  passengerName: 'Nguyễn Văn A',
  passengerPhone: '0901234567',
  cargoWaybillCode: 'VD-999',
  cargoStatus: 'MOI_TAO',
  cargoFee: 180000,
  cargoItems: [
    { id: 101, name: 'Vali', quantity: 1, weight: 5 },
    { id: 102, name: 'Vali', quantity: 1, weight: 20 },
  ],
  cancellation: {
    eligible: true,
    cancelFeeRate: 0.1,
    cancelFee: 25000,
    refundAmount: 225000,
  },
  bookingTickets: [
    {
      ticketId: 101,
      ticketCode: 'VE-001',
      bookingCode: 'PDV-999',
      seatNumber: 'A01',
      price: 250000,
      status: 'CON_HAN',
      passengerName: 'Nguyễn Văn A',
      departureTime: '2099-10-25T08:00:00Z',
    },
    {
      ticketId: 102,
      ticketCode: 'VE-002',
      bookingCode: 'PDV-999',
      seatNumber: 'A02',
      price: 250000,
      status: 'CON_HAN',
      passengerName: 'Trần Thị B',
      departureTime: '2099-10-25T08:00:00Z',
    },
    {
      ticketId: 103,
      ticketCode: 'VE-003',
      bookingCode: 'PDV-999',
      seatNumber: 'A03',
      price: 250000,
      status: 'HUY',
      passengerName: 'Lê Văn C',
      departureTime: '2099-10-25T08:00:00Z',
    },
  ],
};

vi.mock('@/features/tickets/services/cancel-session', () => ({
  getCancelSession: () => ({
    ticketCode: 'PDV-999',
    phoneNumber: '0901234567',
    ticket: mockMultiTickets,
  }),
  clearCancelSession: vi.fn(),
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Multi-ticket cancellation flow', () => {
  it('renders multi-ticket list with selectable checkboxes and calculates fees based on selection', async () => {
    const cancelSpy = vi.spyOn(ticketsApi, 'cancelTicket').mockResolvedValue({
      data: {
        ticketId: 101,
        ticketCode: 'VE-001',
        cancelledTicketCodes: ['VE-001', 'VE-002'],
        cancelledSeatNumbers: ['A01', 'A02'],
        status: 'HUY',
        cancelFee: 50000,
        refundAmount: 450000,
      },
    });

    render(<CancelTicketPage />);

    // Kiểm tra hiển thị danh sách vé trong đơn
    expect(screen.getByText(/Chọn vé muốn hủy trong đơn/i)).toBeTruthy();
    expect(screen.getByText('Ghế A01')).toBeTruthy();
    expect(screen.getByText('Ghế A02')).toBeTruthy();
    expect(screen.getByText('Ghế A03')).toBeTruthy();

    // Vé A03 đã hủy trước đó -> hiển thị badge Đã hủy
    expect(screen.getByText('Đã hủy')).toBeTruthy();

    // Mặc định chọn 2 vé còn hiệu lực (VE-001, VE-002): Tổng tiền 500.000đ, Hoàn lại 450.000đ (phí 10% = 50.000đ)
    expect(screen.getByText('Xác nhận hủy 2 vé đã chọn')).toBeTruthy();
    expect(
      screen.getByText(
        'Đã chọn 2 vé để hủy. Bạn có thể đổi lựa chọn trước khi xác nhận.',
      ),
    ).toBeTruthy();

    // Bỏ tick 1 vé (click vào checkbox hoặc hàng vé A02)
    const checkboxes = screen.getAllByRole('checkbox');
    // checkbox[0] là checkbox của vé A01, checkbox[1] là vé A02, checkbox[2] là checkbox chính sách
    fireEvent.click(checkboxes[1]);

    // Nút cập nhật thành "Xác nhận hủy vé" (chỉ còn 1 vé được chọn)
    await waitFor(() => {
      expect(screen.getByText('Xác nhận hủy vé')).toBeTruthy();
      expect(
        screen.getByText(
          'Đã chọn 1 vé để hủy. Bạn có thể đổi lựa chọn trước khi xác nhận.',
        ),
      ).toBeTruthy();
    });

    // Chọn lại tất cả
    fireEvent.click(screen.getByText('Chọn tất cả'));
    await waitFor(() => {
      expect(screen.getByText('Xác nhận hủy 2 vé đã chọn')).toBeTruthy();
    });

    // Tick checkbox đồng ý chính sách (checkbox cuối cùng)
    const policyCheckbox = screen.getByLabelText(/Tôi đã đọc, hiểu và đồng ý/i);
    fireEvent.click(policyCheckbox);

    // Bấm xác nhận hủy
    fireEvent.click(screen.getByText('Xác nhận hủy 2 vé đã chọn'));

    // Xác nhận API cancelTicket được gọi với đúng danh sách ticketCodes
    await waitFor(() => {
      expect(cancelSpy).toHaveBeenCalledWith(
        'VE-001',
        '0901234567',
        undefined,
        0.1,
        ['VE-001', 'VE-002'],
        undefined,
      );
    });

    // Kiểm tra màn hình thành công hiển thị các vé đã hủy
    expect(await screen.findByText('Hủy vé thành công!')).toBeTruthy();
    expect(screen.getByText(/VE-001, VE-002/)).toBeTruthy();
  });

  it('only sends selected cargo IDs when ticket cancellation is confirmed', async () => {
    const cancelSpy = vi.spyOn(ticketsApi, 'cancelTicket').mockResolvedValue({
      data: {
        ticketId: 101,
        ticketCode: 'VE-001',
        cancelledTicketCodes: ['VE-001'],
        cancelledSeatNumbers: ['A01'],
        status: 'HUY',
        cancelFee: 25000,
        refundAmount: 225000,
        cargoCancellation: {
          status: 'MOI_TAO',
          cancelledItemIds: [101],
          remainingItemsCount: 1,
        },
      },
    });

    render(<CancelTicketPage />);
    fireEvent.click(screen.getAllByRole('checkbox')[1]);
    fireEvent.click(screen.getByRole('checkbox', { name: /mục 1: Vali/ }));
    expect(cancelSpy).not.toHaveBeenCalled();
    expect(screen.getByText(/Chưa có gì được hủy cho đến khi/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText(/Tôi đã đọc, hiểu và đồng ý/i));
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận hủy vé' }));

    await waitFor(() => expect(cancelSpy).toHaveBeenCalledWith(
      'VE-001',
      '0901234567',
      undefined,
      0.1,
      ['VE-001'],
      [101],
    ));
    expect(await screen.findByText('Hành lý đã chọn cũng được hủy cùng vé.')).toBeTruthy();
  });
});
