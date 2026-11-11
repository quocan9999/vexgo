import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { BookingCargoCancellation } from '../../../src/features/tickets/components/booking-cargo-cancellation';
import type { TicketItem } from '../../../src/features/account/services/tickets.api';

const ticket = {
  ticketCode: 'VE-A01',
  bookingCode: 'PDV-01',
  cargoWaybillCode: 'VD-01',
  cargoStatus: 'MOI_TAO',
  cargoFee: 180000,
  cargoItems: [
    { id: 101, name: 'Vali', quantity: 1, weight: 5 },
    { id: 102, name: 'Vali', quantity: 1, weight: 20 },
  ],
} as TicketItem;

afterEach(cleanup);

it('stages a luggage item for ticket cancellation without sending a request', () => {
  const onSelectionChange = vi.fn();
  render(
    <BookingCargoCancellation
      ticket={ticket}
      locale="vi"
      selectedIds={[]}
      onSelectionChange={onSelectionChange}
      willCancelAllTickets={false}
    />,
  );

  expect(screen.getByText(/không thuộc riêng ghế nào/)).toBeTruthy();
  fireEvent.click(screen.getByRole('checkbox', { name: /mục 1: Vali/ }));
  expect(onSelectionChange).toHaveBeenCalledWith([101]);
  expect(screen.queryByRole('button', { name: /hủy.*hành lý/i })).toBeNull();
  expect(screen.getByText(/Chưa có gì được hủy cho đến khi/)).toBeTruthy();
});

it('explains that cancelling all tickets will also cancel all new luggage', () => {
  render(
    <BookingCargoCancellation
      ticket={ticket}
      locale="vi"
      selectedIds={[]}
      onSelectionChange={vi.fn()}
      willCancelAllTickets
    />,
  );

  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(
    screen.getByText(/toàn bộ gói hành lý Mới tạo cũng sẽ được hủy/),
  ).toBeTruthy();
  expect(screen.getAllByText('Sẽ hủy')).toHaveLength(2);
});

it('does not allow selecting accepted luggage for online cancellation', () => {
  render(
    <BookingCargoCancellation
      ticket={{ ...ticket, cargoStatus: 'DA_TIEP_NHAN' }}
      locale="vi"
      selectedIds={[]}
      onSelectionChange={vi.fn()}
      willCancelAllTickets={false}
    />,
  );
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText(/vui lòng liên hệ nhà xe/)).toBeTruthy();
});

it('does not offer item selection when stable cargo IDs are unavailable', () => {
  render(
    <BookingCargoCancellation
      ticket={{
        ...ticket,
        cargoItems: [{ name: 'Vali', quantity: 1, weight: 5 }],
      }}
      locale="vi"
      selectedIds={[]}
      onSelectionChange={vi.fn()}
      willCancelAllTickets={false}
    />,
  );
  expect(screen.queryByRole('checkbox')).toBeNull();
  expect(screen.getByText(/Vui lòng tải lại trang/)).toBeTruthy();
});
