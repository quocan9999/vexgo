import type { SearchTripsParams } from './trips.api';

export const TRIPS_PAGE_SIZE = 10;

export type TripLeg = 'outbound' | 'return';

export function getTripSummaryCardStates(activeLeg: TripLeg): {
  outbound: 'active' | 'muted';
  return: 'active' | 'muted';
} {
  return {
    outbound: activeLeg === 'outbound' ? 'active' : 'muted',
    return: activeLeg === 'return' ? 'active' : 'muted',
  };
}

export function buildTripListSearchParams({
  origin,
  destination,
  date,
  page,
  sort,
  search = '',
  vehicleType = 'all',
  timeRange = 'all',
  operator = 'all',
}: {
  origin: string;
  destination: string;
  date: string;
  page: number;
  sort: string;
  search?: string;
  vehicleType?: string;
  timeRange?: string;
  operator?: string;
}): SearchTripsParams {
  return {
    from: origin,
    to: destination,
    departureDate: date || undefined,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(vehicleType !== 'all' ? { vehicleType } : {}),
    ...(timeRange !== 'all' ? { timeRange } : {}),
    ...(operator !== 'all' ? { operator } : {}),
    page,
    pageSize: TRIPS_PAGE_SIZE,
    sortBy: sort === 'price' ? 'price' : 'departureTime',
    sortDirection: 'asc',
  };
}

export function buildTripBookingHref({
  currentSearch,
  outboundId,
  returnId,
}: {
  currentSearch: string;
  outboundId: string;
  returnId?: string;
}): string {
  const params = new URLSearchParams(currentSearch);
  params.set('tripType', returnId ? 'round-trip' : 'one-way');
  params.set('outboundId', outboundId);

  if (returnId) {
    params.set('returnId', returnId);
  } else {
    params.delete('returnId');
    params.delete('returnDate');
  }

  return `/trips/${encodeURIComponent(outboundId)}?${params.toString()}`;
}

export function buildRoundTripBookingHrefAfterSelection({
  currentSearch,
  activeLeg,
  chosenTripId,
  selectedOutboundId,
  selectedReturnId,
}: {
  currentSearch: string;
  activeLeg: TripLeg;
  chosenTripId: string;
  selectedOutboundId: string | null;
  selectedReturnId: string | null;
}): string | null {
  const outboundId =
    activeLeg === 'outbound' ? chosenTripId : selectedOutboundId;
  const returnId = activeLeg === 'return' ? chosenTripId : selectedReturnId;

  if (!outboundId || !returnId) return null;

  return buildTripBookingHref({
    currentSearch,
    outboundId,
    returnId,
  });
}
