import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { PlatformRbacManagement } from '@/features/platform-rbac/components/platform-rbac-management';

export default function PlatformRbacPage() {
  return (
    <AdminSessionGuard>
      <PlatformRbacManagement />
    </AdminSessionGuard>
  );
}
