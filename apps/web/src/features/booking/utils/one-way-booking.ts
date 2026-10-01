export function canPayForOneWayBooking(
  selectedSeats: readonly string[],
  acceptedTerms: boolean,
) {
  return selectedSeats.length > 0 && acceptedTerms;
}

export function formatTripDateTime(
  dateStr?: string,
  fallback?: string,
): string {
  if (!dateStr) return fallback || '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback || dateStr;
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${hours}:${minutes} ${day}/${month}/${year}`;
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
