import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { TenantRbacManagement } from '@/features/tenant-rbac/components/tenant-rbac-management';

export default function TenantRbacPage() {
  return (
    <AdminSessionGuard>
      <TenantRbacManagement />
    </AdminSessionGuard>
  );
}
