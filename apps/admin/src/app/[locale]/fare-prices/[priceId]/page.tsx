import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { FarePriceWorkspace } from '@/features/fare-prices/components/fare-price-workspace';

type FarePriceWorkspacePageProps = {
  params: Promise<{ priceId: string }>;
};

export default async function FarePriceWorkspacePage({
  params,
}: FarePriceWorkspacePageProps) {
  const { priceId: rawPriceId } = await params;
  const farePriceId = /^\d+$/.test(rawPriceId)
    ? Number(rawPriceId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <FarePriceWorkspace farePriceId={farePriceId} />
    </AdminSessionGuard>
  );
}
