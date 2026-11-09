import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { PlatformTenantRbacManagement } from '@/features/platform-rbac/components/platform-tenant-rbac-management';

export default async function PlatformTenantRbacPage({
  params,
}: {
  params: Promise<{ nhaXeId: string }>;
}) {
  const { nhaXeId } = await params;

  return (
    <AdminSessionGuard>
      <PlatformTenantRbacManagement key={nhaXeId} nhaXeIdParam={nhaXeId} />
    </AdminSessionGuard>
  );
}
