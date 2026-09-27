import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { FarePricesManagement } from '@/features/fare-prices/components/fare-prices-management';

export default function FarePricesPage() {
  return (
    <AdminSessionGuard>
      <FarePricesManagement />
    </AdminSessionGuard>
  );
}
