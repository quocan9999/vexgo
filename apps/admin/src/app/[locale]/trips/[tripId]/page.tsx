import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { TripWorkspace } from '@/features/trips/components/trip-workspace';

type TripWorkspacePageProps = {
  params: Promise<{ tripId: string }>;
};

export default async function TripWorkspacePage({
  params,
}: TripWorkspacePageProps) {
  const { tripId: rawTripId } = await params;
  const tripId = /^\d+$/.test(rawTripId)
    ? Number(rawTripId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <TripWorkspace tripId={tripId} />
    </AdminSessionGuard>
  );
}
