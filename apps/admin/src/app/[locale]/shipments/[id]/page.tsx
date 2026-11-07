import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { ShipmentWorkspace } from '@/features/shipments/components/shipment-workspace';

type ShipmentWorkspacePageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShipmentWorkspacePage({
  params,
}: ShipmentWorkspacePageProps) {
  const { id: rawId } = await params;
  const shipmentId = /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;

  return (
    <AdminSessionGuard>
      <ShipmentWorkspace shipmentId={shipmentId} />
    </AdminSessionGuard>
  );
}
