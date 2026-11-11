export const BOOKING_PAYMENT_TTL_MS = 10 * 60 * 1000;

export function getBookingPaymentDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + BOOKING_PAYMENT_TTL_MS);
}
