import { OneWayBooking } from '@/features/booking/components/one-way-booking';
import { RoundTripBooking } from '@/features/booking/components/round-trip-booking';
import { resolveRoundTripDepartureDate } from '@/features/booking/utils/round-trip-booking';
import { AlternativeTripsSection } from '@/features/trips/components/alternative-trips';
import { mapTripToBookingPost } from '@/features/trips/services/trip-booking-adapter';
import type { ApiTrip, ApiTripSeat } from '@/features/trips/services/trips.api';

function getApiBaseUrl() {
  return (
    process.env.VEXGO_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:4000/api/v1'
  );
}

async function getTrip(tripId: number): Promise<ApiTrip | null> {
  const response = await fetch(`${getApiBaseUrl()}/trips/${tripId}`, {
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Không thể tải chi tiết chuyến xe.');
  const body: { data: ApiTrip } = await response.json();
  return body.data;
}

async function getTripSeats(tripId: number): Promise<ApiTripSeat[]> {
  const response = await fetch(`${getApiBaseUrl()}/trips/${tripId}/seats`, {
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Không thể tải sơ đồ ghế.');
  const body: { data: ApiTripSeat[] } = await response.json();
  return body.data;
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tripId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { tripId } = await params;
  const sp = await searchParams;

  const tripType = sp?.tripType === 'round-trip' ? 'round-trip' : 'one-way';
  const routeTripId = Number(tripId);
  const requestedOutboundId =
    typeof sp?.outboundId === 'string' ? Number(sp.outboundId) : routeTripId;
  const outboundId =
    Number.isInteger(requestedOutboundId) && requestedOutboundId > 0
      ? requestedOutboundId
      : routeTripId;
  const requestedReturnId =
    typeof sp?.returnId === 'string' ? Number(sp.returnId) : outboundId;
  const returnId =
    Number.isInteger(requestedReturnId) && requestedReturnId > 0
      ? requestedReturnId
      : outboundId;

  if (!Number.isInteger(routeTripId) || routeTripId < 1) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center font-semibold text-red-600">
        Mã chuyến xe không hợp lệ.
      </div>
    );
  }

  let outboundTrip: ApiTrip | null = null;
  let inboundTrip: ApiTrip | null = null;
  let outboundSeats: ApiTripSeat[] = [];
  let inboundSeats: ApiTripSeat[] = [];
  let loadError: string | null = null;
  try {
    [outboundTrip, inboundTrip, outboundSeats, inboundSeats] =
      await Promise.all([
        getTrip(outboundId),
        tripType === 'round-trip' ? getTrip(returnId) : Promise.resolve(null),
        getTripSeats(outboundId),
        tripType === 'round-trip'
          ? getTripSeats(returnId)
          : Promise.resolve([]),
      ]);
  } catch (error) {
    loadError =
      error instanceof Error
        ? error.message
        : 'Không thể tải chi tiết chuyến xe.';
  }

  if (loadError) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center font-semibold text-red-600">
        {loadError}
      </div>
    );
  }

  if (!outboundTrip || (tripType === 'round-trip' && !inboundTrip)) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center font-semibold text-red-600">
        Không tìm thấy chuyến xe.
      </div>
    );
  }

  const outboundPost = mapTripToBookingPost(outboundTrip);
  return (
    <div className="space-y-6">
      {tripType === 'round-trip' && inboundTrip ? (
        <RoundTripBooking
          outboundPost={outboundPost}
          returnPost={mapTripToBookingPost(inboundTrip)}
          outboundTripSeats={outboundSeats}
          returnTripSeats={inboundSeats}
          departureDate={resolveRoundTripDepartureDate(sp)}
          returnDate={typeof sp?.returnDate === 'string' ? sp.returnDate : ''}
          outboundApiTrip={outboundTrip}
          returnApiTrip={inboundTrip}
        />
      ) : (
        <OneWayBooking post={outboundPost} tripSeats={outboundSeats} apiTrip={outboundTrip} />
      )}

      <div className="max-w-[1160px] mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        <AlternativeTripsSection
          tripId={outboundId}
          currentPrice={outboundTrip.price ?? undefined}
        />
      </div>
    </div>
  );
}
