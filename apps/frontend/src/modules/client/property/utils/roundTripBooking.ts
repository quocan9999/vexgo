export interface RoundTripBookingHrefInput {
  currentSearch: string;
  outboundId: string;
  returnId: string;
}

export const buildRoundTripBookingHref = ({
  currentSearch,
  outboundId,
  returnId,
}: RoundTripBookingHrefInput) => {
  const params = new URLSearchParams(currentSearch);
  params.set('tripType', 'round-trip');
  params.set('outboundId', outboundId);
  params.set('returnId', returnId);

  return `/posts/${encodeURIComponent(outboundId)}?${params.toString()}`;
};
