import { validatePassengerInfo, type PassengerInfo } from './passenger-validation.ts';

export function canPayForOneWayBooking(
  selectedSeats: readonly string[],
  acceptedTerms: boolean,
  passengerInfo?: PassengerInfo,
) {
  if (selectedSeats.length === 0 || !acceptedTerms) return false;
  if (!passengerInfo) return true;
  return validatePassengerInfo(passengerInfo).isValid;
}

export function formatTripDateTime(
  dateStr?: string,
  fallback?: string,
): string {
  if (!dateStr) return fallback || 'Chưa cập nhật';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback || 'Chưa cập nhật';
  try {
    const formatter = new Intl.DateTimeFormat('vi-VN', {
      timeZone: 'Asia/Ho_Chi_Minh',
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const getPart = (type: string) =>
      parts.find((p) => p.type === type)?.value || '';
    const hour = getPart('hour').padStart(2, '0');
    const minute = getPart('minute').padStart(2, '0');
    const day = getPart('day').padStart(2, '0');
    const month = getPart('month').padStart(2, '0');
    const year = getPart('year');
    return `${hour}:${minute} ${day}/${month}/${year}`;
  } catch {
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${hours}:${minutes} ${day}/${month}/${year}`;
  }
}


export function buildOneWayPaymentQuery({
  post,
  selectedSeats,
  baseFare,
  totalFare,
  customerName,
  customerPhone,
  customerEmail,
  pickup,
  dropoff,
  luggageFee,
  luggageWeight,
  luggageInfo,
}: {
  post: {
    title?: string;
    province: string;
    district: string;
    createdAt?: string;
    timeAgo?: string;
  };
  selectedSeats: string[];
  baseFare: number;
  totalFare: number;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  pickup?: string;
  dropoff?: string;
  luggageFee?: number;
  luggageWeight?: number;
  luggageInfo?: string | null;
}): URLSearchParams {
  const query = new URLSearchParams({
    totalFare: totalFare.toString(),
    baseFare: baseFare.toString(),
    seats: selectedSeats.join(', '),
    count: selectedSeats.length.toString(),
    route: post.title || `${post.province} - ${post.district}`,
    departureTime: formatTripDateTime(post.createdAt, post.timeAgo),
    pickup: pickup || post.province,
    dropoff: dropoff || post.district,
    customerName,
    customerPhone,
    customerEmail,
    luggageFee: (luggageFee ?? 0).toString(),
    luggageWeight: (luggageWeight ?? 0).toString(),
  });
  if (luggageInfo) {
    query.set('luggageInfo', luggageInfo);
  }
  return query;
}
