import { getTrip } from '@/mocks/trips';
import { TripDetail } from '@/features/trips/components/trip-detail';

export default async function TripDetailPage({ params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  return <TripDetail trip={getTrip(tripId)} />;
}
