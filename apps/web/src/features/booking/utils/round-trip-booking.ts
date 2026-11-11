/* eslint-disable */
import { validatePassengerInfo, type PassengerInfo } from './passenger-validation.ts';

export interface RoundTripBookingInput {
  currentSearch: string;
  outboundId: string;
  returnId: string;
}

export function resolveRoundTripDepartureDate(searchParams: {
  departureDate?: string | string[];
  date?: string | string[];
  price?: string | string[];
}): string {
  if (typeof searchParams.departureDate === 'string') {
    return searchParams.departureDate;
  }

  if (typeof searchParams.date === 'string') {
    return searchParams.date;
  }

  return typeof searchParams.price === 'string' ? searchParams.price : '';
}

export function canPayForRoundTripBooking(
  outboundSeats: readonly string[],
  returnSeats: readonly string[],
  acceptedTerms: boolean,
  passengerInfo?: PassengerInfo,
) {
  if (outboundSeats.length === 0 || returnSeats.length === 0 || !acceptedTerms) {
    return false;
  }
  if (!passengerInfo) return true;
  return validatePassengerInfo(passengerInfo).isValid;
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
