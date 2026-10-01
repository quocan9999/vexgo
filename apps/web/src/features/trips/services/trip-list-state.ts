import type { SearchTripsParams } from './trips.api';

export const TRIPS_PAGE_SIZE = 10;

export function buildTripListSearchParams({
  origin,
  destination,
  date,
  page,
  sort,
  search = '',
  vehicleType = 'all',
}: {
  origin: string;
  destination: string;
  date: string;
  page: number;
  sort: string;
  search?: string;
  vehicleType?: string;
}): SearchTripsParams {
  return {
    from: origin,
    to: destination,
    departureDate: date || undefined,
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(vehicleType !== 'all' ? { vehicleType } : {}),
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
