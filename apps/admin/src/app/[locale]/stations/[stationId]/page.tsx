import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { StationWorkspace } from '@/features/stations/components/station-workspace';

type StationWorkspacePageProps = {
  params: Promise<{ stationId: string }>;
};

export default async function StationWorkspacePage({
  params,
}: StationWorkspacePageProps) {
  const { stationId: rawStationId } = await params;
  const stationId = /^\d+$/.test(rawStationId)
    ? Number(rawStationId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <StationWorkspace stationId={stationId} />
    </AdminSessionGuard>
  );
}
