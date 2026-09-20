import { SuperAdminDashboard } from '@/features/super-admin-dashboard/components/super-admin-dashboard';
import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';

export default function Home() {
  return (
    <AdminSessionGuard>
      <SuperAdminDashboard />
    </AdminSessionGuard>
  );
}
