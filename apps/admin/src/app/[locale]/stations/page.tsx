import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { StationsManagement } from '@/features/stations/components/stations-management';

export default function StationsPage() {
  return (
    <AdminSessionGuard>
      <StationsManagement />
    </AdminSessionGuard>
  );
}
