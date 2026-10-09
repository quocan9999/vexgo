import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BOOKING_MANAGEMENT_STATE,
  parseBookingManagementUrlState,
  safeBookingManagementReturnPath,
  serializeBookingManagementUrlState,
  updateBookingManagementTab,
  type BookingManagementUrlState,
} from '@/features/booking-management/services/booking-management-query';

describe('booking management URL query state', () => {
  it('keeps each tab filters, sort and page independent across tab changes', () => {
    const initial: BookingManagementUrlState = {
      tab: 'bookings',
      bookings: {
        ...DEFAULT_BOOKING_MANAGEMENT_STATE,
        search: 'PD-100',
        status: 'DA_HUY',
        page: 3,
      },
      tickets: {
        ...DEFAULT_BOOKING_MANAGEMENT_STATE,
        search: 'VE-200',
        status: 'HUY',
        page: 2,
        sortBy: 'ticketPrice',
      },
    };

    const tickets = updateBookingManagementTab(initial, 'tickets');
    const restored = updateBookingManagementTab(tickets, 'bookings');
    const parsed = parseBookingManagementUrlState(
      serializeBookingManagementUrlState(restored),
    );

    expect(parsed.state).toEqual(initial);
    expect(parsed.needsCanonicalization).toBe(false);
  });

  it('resets only the active tab page when a filter changes', () => {
    const params = new URLSearchParams(
      'tab=tickets&bPage=3&bSearch=ABC&tPage=2&tStatus=HUY',
    );
    const parsed = parseBookingManagementUrlState(params);
    const next = {
      ...parsed.state,
      tickets: { ...parsed.state.tickets, status: undefined, page: 1 },
    };

    const serialized = serializeBookingManagementUrlState(next);
    const restored = parseBookingManagementUrlState(serialized).state;
    expect(restored.bookings.page).toBe(3);
    expect(restored.tickets.page).toBe(1);
    expect(restored.tickets.status).toBeUndefined();
  });

  it('sanitizes invalid tabs, status, dates, page and unknown URL keys', () => {
    const result = parseBookingManagementUrlState(
      new URLSearchParams(
        'tab=not-a-tab&bPage=0&bPageSize=999&bStatus=HOAN_TIEN&bBookedFrom=2026-02-31&tSortBy=paymentStatus&debug=1',
      ),
    );

    expect(result.state.tab).toBe('bookings');
    expect(result.state.bookings.page).toBe(1);
    expect(result.state.bookings.pageSize).toBe(10);
    expect(result.state.bookings.status).toBeUndefined();
    expect(result.state.bookings.bookedFrom).toBeUndefined();
    expect(result.state.tickets.sortBy).toBe('bookedAt');
    expect(result.needsCanonicalization).toBe(true);
    expect(serializeBookingManagementUrlState(result.state).has('debug')).toBe(
      false,
    );
  });

  it('canonicalizes inverted booked and departure ranges from an external URL safely', () => {
    const result = parseBookingManagementUrlState(
      new URLSearchParams(
        'bBookedFrom=2026-10-15&bBookedTo=2026-10-10&bDepartureFrom=2026-11-15&bDepartureTo=2026-11-10',
      ),
    );

    expect(result.state.bookings.bookedFrom).toBe('2026-10-15');
    expect(result.state.bookings.bookedTo).toBeUndefined();
    expect(result.state.bookings.departureFrom).toBe('2026-11-15');
    expect(result.state.bookings.departureTo).toBeUndefined();
    expect(result.needsCanonicalization).toBe(true);

    const safeUrlState = serializeBookingManagementUrlState(result.state);
    expect(safeUrlState.get('bBookedFrom')).toBe('2026-10-15');
    expect(safeUrlState.has('bBookedTo')).toBe(false);
    expect(safeUrlState.get('bDepartureFrom')).toBe('2026-11-15');
    expect(safeUrlState.has('bDepartureTo')).toBe(false);
  });

  it('maps filter edits without altering the other tab state', () => {
    const initial = parseBookingManagementUrlState(
      new URLSearchParams('tab=bookings&bPage=5&tPage=4&tSearch=VE'),
    ).state;
    const tickets = updateBookingManagementTab(initial, 'tickets');

    expect(tickets.tab).toBe('tickets');
    expect(tickets.bookings.page).toBe(5);
    expect(tickets.tickets.page).toBe(4);
    expect(tickets.tickets.search).toBe('VE');
  });

  it('allows only a sanitized same-origin list path as a detail return target', () => {
    expect(
      safeBookingManagementReturnPath(
        '/booking-management?bSearch=PD-22&tab=tickets&debug=1',
        'bookings',
      ),
    ).toBe('/booking-management?bSearch=PD-22');
    expect(
      safeBookingManagementReturnPath('//evil.example/path', 'tickets'),
    ).toBe('/booking-management?tab=tickets');
    expect(
      safeBookingManagementReturnPath('https://evil.example', 'bookings'),
    ).toBe('/booking-management');
    expect(safeBookingManagementReturnPath('/customers', 'bookings')).toBe(
      '/booking-management',
    );
  });
});
