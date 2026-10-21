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

  it('accepts page 10000 and canonicalizes unsafe pages on either tab without losing filters', () => {
    const scenarios = [
      {
        tab: 'bookings' as const,
        prefix: 'b' as const,
        otherPrefix: 't' as const,
        otherTab: 'tickets' as const,
        otherPage: 4,
        activeSearch: 'PD-KEEP',
        otherSearch: 'VE-KEEP',
        query:
          'bPage=10000&bSearch=PD-KEEP&bStatus=DA_HUY&bBookedFrom=2026-10-05&bBookedTo=2026-10-10&tPage=4&tSearch=VE-KEEP&tStatus=HUY',
      },
      {
        tab: 'tickets' as const,
        prefix: 't' as const,
        otherPrefix: 'b' as const,
        otherTab: 'bookings' as const,
        otherPage: 3,
        activeSearch: 'VE-KEEP',
        otherSearch: 'PD-KEEP',
        query:
          'tab=tickets&tPage=10000&tSearch=VE-KEEP&tStatus=HUY&tDepartureFrom=2026-11-01&tDepartureTo=2026-11-05&bPage=3&bSearch=PD-KEEP&bStatus=DA_HUY',
      },
    ];
    const invalidPages = [
      '10001',
      '999999999999999999999999999999999999',
      '-1',
      'not-a-page',
      '1.5',
    ];

    for (const scenario of scenarios) {
      const accepted = parseBookingManagementUrlState(
        new URLSearchParams(scenario.query),
      );
      expect(accepted.state[scenario.tab].page).toBe(10_000);
      expect(
        serializeBookingManagementUrlState(accepted.state).get(
          `${scenario.prefix}Page`,
        ),
      ).toBe('10000');
      expect(accepted.state[scenario.otherTab].page).toBe(scenario.otherPage);

      for (const invalidPage of invalidPages) {
        const params = new URLSearchParams(scenario.query);
        params.set(`${scenario.prefix}Page`, invalidPage);
        const parsed = parseBookingManagementUrlState(params);
        const canonical = serializeBookingManagementUrlState(parsed.state);

        expect(parsed.state.tab).toBe(scenario.tab);
        expect(parsed.state[scenario.tab].page).toBe(1);
        expect(parsed.state[scenario.tab].search).toBe(scenario.activeSearch);
        expect(parsed.state[scenario.otherTab].page).toBe(scenario.otherPage);
        expect(parsed.state[scenario.otherTab].search).toBe(scenario.otherSearch);
        expect(parsed.needsCanonicalization).toBe(true);
        expect(canonical.has(`${scenario.prefix}Page`)).toBe(false);
        expect(canonical.get(`${scenario.otherPrefix}Page`)).toBe(
          String(scenario.otherPage),
        );
        expect(canonical.get(`${scenario.prefix}Search`)).toBe(
          scenario.activeSearch,
        );
        expect(canonical.get(`${scenario.otherPrefix}Search`)).toBe(
          scenario.otherSearch,
        );
        expect(
          parseBookingManagementUrlState(canonical).needsCanonicalization,
        ).toBe(false);

        if (scenario.tab === 'bookings') {
          expect(parsed.state.bookings.bookedFrom).toBe('2026-10-05');
          expect(parsed.state.bookings.bookedTo).toBe('2026-10-10');
          expect(canonical.get('bBookedFrom')).toBe('2026-10-05');
          expect(canonical.get('bBookedTo')).toBe('2026-10-10');
        } else {
          expect(parsed.state.tickets.departureFrom).toBe('2026-11-01');
          expect(parsed.state.tickets.departureTo).toBe('2026-11-05');
          expect(canonical.get('tDepartureFrom')).toBe('2026-11-01');
          expect(canonical.get('tDepartureTo')).toBe('2026-11-05');
        }
      }
    }
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
