import type { Post } from '@/features/posts/types/post';
import type { ApiTrip } from './trips.api';

function formatDeparture(iso: string): string {
  const value = new Date(iso);
  const day = String(value.getUTCDate()).padStart(2, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const year = value.getUTCFullYear();
  const hour = String(value.getUTCHours()).padStart(2, '0');
  const minute = String(value.getUTCMinutes()).padStart(2, '0');
  return `${day}/${month}/${year}, ${hour}:${minute}`;
}

export function mapTripToBookingPost(trip: ApiTrip): Post {
  const fare =
    trip.price === null
      ? undefined
      : new Intl.NumberFormat('vi-VN').format(trip.price);

  return {
    id: String(trip.id),
    title: `${trip.route.origin} - ${trip.route.destination}`,
    needType: 'BUY',
    propertyType: trip.vehicle.type,
    price: fare ? `${fare} đ` : 'Liên hệ',
    minPriceNum: trip.price ?? undefined,
    maxPriceNum: trip.price ?? undefined,
    area: '',
    location: `${trip.route.origin} - ${trip.route.destination}`,
    province: trip.route.origin,
    district: trip.route.destination,
    description: '',
    timeAgo: formatDeparture(trip.departureTime),
    createdAt: trip.departureTime,
    authorName: trip.busCompany.name,
    authorCode: trip.code,
    authorPhone: '',
    isVerified: true,
  };
}
