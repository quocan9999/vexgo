import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { VehiclesManagement } from '@/features/vehicles/components/vehicles-management';

export default function VehiclesPage() {
  return (
    <AdminSessionGuard>
      <VehiclesManagement />
    </AdminSessionGuard>
  );
}
