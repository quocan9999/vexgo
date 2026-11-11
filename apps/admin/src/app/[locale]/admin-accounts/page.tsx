import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { AdminAccountsManagement } from '@/features/admin-accounts/components/admin-accounts-management';

export default function AdminAccountsPage() {
  return (
    <AdminSessionGuard>
      <AdminAccountsManagement />
    </AdminSessionGuard>
  );
}
