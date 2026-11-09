import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { RouteWorkspace } from '@/features/routes/components/route-workspace';

type RouteWorkspacePageProps = {
  params: Promise<{ routeId: string }>;
};

export default async function RouteWorkspacePage({
  params,
}: RouteWorkspacePageProps) {
  const { routeId: rawRouteId } = await params;
  const routeId = /^\d+$/.test(rawRouteId) ? Number(rawRouteId) : Number.NaN;

  return (
    <AdminSessionGuard>
      <RouteWorkspace routeId={routeId} />
    </AdminSessionGuard>
  );
}
