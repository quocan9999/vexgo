import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { ShipmentRateWorkspace } from '@/features/shipments/components/shipment-rate-workspace';

type ShipmentRateWorkspacePageProps = {
  params: Promise<{ rateId: string }>;
};

export default async function ShipmentRateWorkspacePage({
  params,
}: ShipmentRateWorkspacePageProps) {
  const { rateId: rawRateId } = await params;
  const rateId = /^\d+$/.test(rawRateId) ? Number(rawRateId) : Number.NaN;

  return (
    <AdminSessionGuard>
      <ShipmentRateWorkspace rateId={rateId} />
    </AdminSessionGuard>
  );
}
