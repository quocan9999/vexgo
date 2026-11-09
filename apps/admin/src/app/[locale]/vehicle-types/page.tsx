import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { VehicleTypesManagement } from '@/features/vehicle-types/components/vehicle-types-management';

export default function VehicleTypesPage() {
  return (
    <AdminSessionGuard>
      <VehicleTypesManagement />
    </AdminSessionGuard>
  );
}
