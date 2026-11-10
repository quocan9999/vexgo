'use client';

import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { useAdminSession } from '@/features/admin-auth/hooks/use-admin-session';
import { getAdminAccessScope } from '@/features/admin-auth/services/admin-scope';
import { SuperAdminDashboard } from '@/features/super-admin-dashboard/components/super-admin-dashboard';
import { TenantDashboard } from '@/features/tenant-dashboard';

function AdminDashboardView() {
  const authState = useAdminSession();
  const session = authState.status === 'authenticated' ? authState.session : null;
  const scope = session ? getAdminAccessScope(session) : null;

  if (scope === 'tenant') {
    return <TenantDashboard />;
  }

  return <SuperAdminDashboard />;
}

export default function Home() {
  return (
    <AdminSessionGuard>
      <AdminDashboardView />
    </AdminSessionGuard>
  );
}
