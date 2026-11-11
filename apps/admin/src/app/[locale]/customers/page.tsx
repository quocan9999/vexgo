import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { CustomersManagement } from '@/features/customers/components/customers-management';

export default function CustomersPage() {
  return (
    <AdminSessionGuard>
      <CustomersManagement />
    </AdminSessionGuard>
  );
}
