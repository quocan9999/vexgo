/* eslint-disable */
export interface RoundTripBookingInput {
  currentSearch: string;
  outboundId: string;
  returnId: string;
}

export function calculateRoundTripFare({
  outboundUnitFare,
  outboundSeatCount,
  returnUnitFare,
  returnSeatCount,
}: {
  outboundUnitFare: number;
  outboundSeatCount: number;
  returnUnitFare: number;
  returnSeatCount: number;
}): number {
  return (
    outboundUnitFare * outboundSeatCount + returnUnitFare * returnSeatCount
  );
}

export function buildRoundTripBookingHref({
  currentSearch,
  outboundId,
  returnId,
}: RoundTripBookingInput): string {
  const params = new URLSearchParams(currentSearch);
  params.set('tripType', 'round-trip');
  params.set('outboundId', outboundId);
  params.set('returnId', returnId);

  return `/posts/${encodeURIComponent(outboundId)}?${params.toString()}`;
}

export function getReturnTripLocations(returnPost: {
  province: string;
  district: string;
}): { pickup: string; dropoff: string } {
  return {
    pickup: returnPost.province,
    dropoff: returnPost.district,
  };
}
