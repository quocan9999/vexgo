export const BOOKING_MANAGEMENT_TABS = ['bookings', 'tickets'] as const;
export type BookingManagementTab = (typeof BOOKING_MANAGEMENT_TABS)[number];

export const BOOKING_STATUS_OPTIONS = [
  { value: 'CHO_THANH_TOAN', label: 'Chờ thanh toán' },
  { value: 'DA_THANH_TOAN', label: 'Đã thanh toán' },
  { value: 'HOAN_THANH', label: 'Hoàn thành' },
  { value: 'DA_HUY', label: 'Đã hủy' },
] as const;

export const TICKET_STATUS_OPTIONS = [
  { value: 'DA_DAT', label: 'Đã đặt' },
  { value: 'HUY', label: 'Đã hủy' },
] as const;

export type BookingSortKey = 'bookedAt' | 'departureTime' | 'totalTicketAmount';
export type TicketSortKey = 'bookedAt' | 'departureTime' | 'ticketPrice';
export type BookingManagementSortKey = BookingSortKey | TicketSortKey;

export type BookingManagementListState = {
  search: string;
  status?: string;
  bookedFrom?: string;
  bookedTo?: string;
  departureFrom?: string;
  departureTo?: string;
  page: number;
  pageSize: number;
  sortBy: BookingManagementSortKey;
  sortDirection: 'asc' | 'desc';
};

export type BookingManagementUrlState = {
  tab: BookingManagementTab;
  bookings: BookingManagementListState;
  tickets: BookingManagementListState;
};

export const DEFAULT_BOOKING_MANAGEMENT_STATE: BookingManagementListState = {
  search: '',
  page: 1,
  pageSize: 10,
  sortBy: 'bookedAt',
  sortDirection: 'desc',
};

const BOOKING_SORT_KEYS: readonly BookingSortKey[] = [
  'bookedAt',
  'departureTime',
  'totalTicketAmount',
];
const TICKET_SORT_KEYS: readonly TicketSortKey[] = [
  'bookedAt',
  'departureTime',
  'ticketPrice',
];

function isDateOnly(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function parsePositiveInteger(
  value: string | null,
  fallback: number,
  max: number,
): number {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= max
    ? parsed
    : fallback;
}

function parseListState(
  params: URLSearchParams,
  prefix: 'b' | 't',
): BookingManagementListState {
  const isBooking = prefix === 'b';
  const sortKeys: readonly string[] = isBooking
    ? BOOKING_SORT_KEYS
    : TICKET_SORT_KEYS;
  const statusValues: readonly string[] = isBooking
    ? BOOKING_STATUS_OPTIONS.map(({ value }) => value)
    : TICKET_STATUS_OPTIONS.map(({ value }) => value);
  const rawSort = params.get(`${prefix}SortBy`);
  const rawStatus = params.get(`${prefix}Status`);
  const rawBookedFrom = params.get(`${prefix}BookedFrom`);
  const rawBookedTo = params.get(`${prefix}BookedTo`);
  const rawDepartureFrom = params.get(`${prefix}DepartureFrom`);
  const rawDepartureTo = params.get(`${prefix}DepartureTo`);
  const bookedFrom = isDateOnly(rawBookedFrom) ? rawBookedFrom : undefined;
  const bookedTo = isDateOnly(rawBookedTo) ? rawBookedTo : undefined;
  const departureFrom = isDateOnly(rawDepartureFrom)
    ? rawDepartureFrom
    : undefined;
  const departureTo = isDateOnly(rawDepartureTo) ? rawDepartureTo : undefined;

  return {
    ...DEFAULT_BOOKING_MANAGEMENT_STATE,
    search: (params.get(`${prefix}Search`) ?? '').slice(0, 100),
    status:
      rawStatus && statusValues.includes(rawStatus) ? rawStatus : undefined,
    bookedFrom,
    bookedTo:
      bookedFrom && bookedTo && bookedFrom > bookedTo ? undefined : bookedTo,
    departureFrom,
    departureTo:
      departureFrom && departureTo && departureFrom > departureTo
        ? undefined
        : departureTo,
    page: parsePositiveInteger(params.get(`${prefix}Page`), 1, 10_000),
    pageSize: parsePositiveInteger(params.get(`${prefix}PageSize`), 10, 100),
    sortBy: sortKeys.some((key) => key === rawSort)
      ? (rawSort as BookingManagementSortKey)
      : 'bookedAt',
    sortDirection:
      params.get(`${prefix}SortDirection`) === 'asc' ? 'asc' : 'desc',
  };
}

export function serializeBookingManagementUrlState(
  state: BookingManagementUrlState,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.tab !== 'bookings') params.set('tab', state.tab);

  for (const [prefix, listState] of [
    ['b', state.bookings],
    ['t', state.tickets],
  ] as const) {
    if (listState.search) params.set(`${prefix}Search`, listState.search);
    if (listState.status) params.set(`${prefix}Status`, listState.status);
    if (listState.bookedFrom) {
      params.set(`${prefix}BookedFrom`, listState.bookedFrom);
    }
    if (listState.bookedTo) params.set(`${prefix}BookedTo`, listState.bookedTo);
    if (listState.departureFrom) {
      params.set(`${prefix}DepartureFrom`, listState.departureFrom);
    }
    if (listState.departureTo) {
      params.set(`${prefix}DepartureTo`, listState.departureTo);
    }
    if (listState.page !== 1)
      params.set(`${prefix}Page`, String(listState.page));
    if (listState.pageSize !== 10) {
      params.set(`${prefix}PageSize`, String(listState.pageSize));
    }
    const defaultSort = 'bookedAt';
    if (listState.sortBy !== defaultSort) {
      params.set(`${prefix}SortBy`, listState.sortBy);
    }
    if (listState.sortDirection !== 'desc') {
      params.set(`${prefix}SortDirection`, listState.sortDirection);
    }
  }

  return params;
}

export function parseBookingManagementUrlState(params: URLSearchParams): {
  state: BookingManagementUrlState;
  needsCanonicalization: boolean;
} {
  const rawTab = params.get('tab');
  const tab: BookingManagementTab =
    rawTab === 'tickets' ? 'tickets' : 'bookings';
  const state: BookingManagementUrlState = {
    tab,
    bookings: parseListState(params, 'b'),
    tickets: parseListState(params, 't'),
  };
  const allowedKeys = new Set([
    'tab',
    ...['b', 't'].flatMap((prefix) => [
      `${prefix}Search`,
      `${prefix}Status`,
      `${prefix}BookedFrom`,
      `${prefix}BookedTo`,
      `${prefix}DepartureFrom`,
      `${prefix}DepartureTo`,
      `${prefix}Page`,
      `${prefix}PageSize`,
      `${prefix}SortBy`,
      `${prefix}SortDirection`,
    ]),
  ]);
  const hasUnknownKey = [...params.keys()].some((key) => !allowedKeys.has(key));
  const invalidTab =
    rawTab !== null && rawTab !== 'bookings' && rawTab !== 'tickets';
  const canonical = serializeBookingManagementUrlState(state);

  return {
    state,
    needsCanonicalization:
      hasUnknownKey || invalidTab || params.toString() !== canonical.toString(),
  };
}

export function updateBookingManagementTab(
  state: BookingManagementUrlState,
  tab: BookingManagementTab,
): BookingManagementUrlState {
  return { ...state, tab };
}

export function safeBookingManagementReturnPath(
  candidate: string | null,
  defaultTab: BookingManagementTab,
): string {
  const fallback =
    defaultTab === 'tickets'
      ? '/booking-management?tab=tickets'
      : '/booking-management';
  if (!candidate || candidate.includes('\\') || candidate.startsWith('//')) {
    return fallback;
  }

  try {
    const baseOrigin = 'http://vexgo-feature07.invalid';
    const url = new URL(candidate, baseOrigin);
    if (url.origin !== baseOrigin || url.pathname !== '/booking-management') {
      return fallback;
    }
    const parsed = parseBookingManagementUrlState(url.searchParams);
    const state = { ...parsed.state, tab: defaultTab };
    const query = serializeBookingManagementUrlState(state).toString();
    return query ? `/booking-management?${query}` : '/booking-management';
  } catch {
    return fallback;
  }
}
