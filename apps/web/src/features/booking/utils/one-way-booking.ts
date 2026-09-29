export function canPayForOneWayBooking(selectedSeats: readonly string[], acceptedTerms: boolean) {
  return selectedSeats.length > 0 && acceptedTerms;
}
