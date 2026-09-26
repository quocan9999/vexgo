import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { VehicleSeatsManagement } from '@/features/vehicles/components/vehicle-seats-management';

type VehicleSeatsPageProps = {
  params: Promise<{ vehicleId: string }>;
};

export default async function VehicleSeatsPage({ params }: VehicleSeatsPageProps) {
  const { vehicleId: rawVehicleId } = await params;
  const vehicleId = /^\d+$/.test(rawVehicleId)
    ? Number(rawVehicleId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <VehicleSeatsManagement vehicleId={vehicleId} />
    </AdminSessionGuard>
  );
}
