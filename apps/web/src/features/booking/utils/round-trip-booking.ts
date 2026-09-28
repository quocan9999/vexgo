export interface RoundTripBookingInput {
  currentSearch: string;
  outboundId: string;
  returnId: string;
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
