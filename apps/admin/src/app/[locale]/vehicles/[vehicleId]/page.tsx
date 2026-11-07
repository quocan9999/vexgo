import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { VehicleWorkspace } from '@/features/vehicles/components/vehicle-workspace';

type VehicleWorkspacePageProps = {
  params: Promise<{ vehicleId: string }>;
};

export default async function VehicleWorkspacePage({
  params,
}: VehicleWorkspacePageProps) {
  const { vehicleId: rawVehicleId } = await params;
  const vehicleId = /^\d+$/.test(rawVehicleId)
    ? Number(rawVehicleId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <VehicleWorkspace vehicleId={vehicleId} />
    </AdminSessionGuard>
  );
}
