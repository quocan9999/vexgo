import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { PlatformTenantRbacPicker } from '@/features/platform-rbac/components/platform-tenant-rbac-picker';

export default function PlatformTenantRbacPickerPage() {
  return (
    <AdminSessionGuard>
      <PlatformTenantRbacPicker />
    </AdminSessionGuard>
  );
}
