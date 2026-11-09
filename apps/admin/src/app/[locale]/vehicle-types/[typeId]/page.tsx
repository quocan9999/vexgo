import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { VehicleTypeWorkspace } from '@/features/vehicle-types/components/vehicle-type-workspace';

type VehicleTypeWorkspacePageProps = {
  params: Promise<{ typeId: string }>;
};

export default async function VehicleTypeWorkspacePage({
  params,
}: VehicleTypeWorkspacePageProps) {
  const { typeId: rawTypeId } = await params;
  const vehicleTypeId = /^\d+$/.test(rawTypeId)
    ? Number(rawTypeId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <VehicleTypeWorkspace vehicleTypeId={vehicleTypeId} />
    </AdminSessionGuard>
  );
}
