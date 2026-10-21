import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { ShipmentsManagement } from '@/features/shipments/components/shipments-management';

export default function ShipmentsPage() {
  return (
    <AdminSessionGuard>
      <ShipmentsManagement />
    </AdminSessionGuard>
  );
}
