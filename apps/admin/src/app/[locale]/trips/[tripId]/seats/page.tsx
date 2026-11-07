import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { TripSeatsManagement } from '@/features/trips/components/trip-seats-management';

type TripSeatsPageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function TripSeatsPage({ params }: TripSeatsPageProps) {
  const { tripId: rawTripId } = await params;
  const tripId = /^\d+$/.test(rawTripId)
    ? Number(rawTripId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <TripSeatsManagement tripId={tripId} />
    </AdminSessionGuard>
  );
}
