import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { ShipmentPrintView } from '@/features/shipments/components/print/shipment-print-view';

type ShipmentPrintPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ShipmentPrintPage({
  params,
}: ShipmentPrintPageProps) {
  const { id: rawId } = await params;
  const shipmentId = /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;

  return (
    <AdminSessionGuard>
      <ShipmentPrintView shipmentId={shipmentId} />
    </AdminSessionGuard>
  );
}
