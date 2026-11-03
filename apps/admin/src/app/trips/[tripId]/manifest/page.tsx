import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { TripManifestView } from '@/features/trips/components/trip-manifest-view';

type TripManifestPageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function TripManifestPage({ params }: TripManifestPageProps) {
  const { tripId: rawTripId } = await params;
  const tripId = /^\d+$/.test(rawTripId)
    ? Number(rawTripId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <SuperAdminLayout activeSection="trips">
        <TripManifestView tripId={tripId} />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
