import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { TripsManagement } from '@/features/trips/components/trips-management';

export default function TripsPage() {
  return (
    <AdminSessionGuard>
      <TripsManagement />
    </AdminSessionGuard>
  );
}
