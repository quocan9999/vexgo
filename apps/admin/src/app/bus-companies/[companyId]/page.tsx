import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { BusCompanyWorkspace } from '@/features/bus-companies/components/bus-company-workspace';

type BusCompanyWorkspacePageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function BusCompanyWorkspacePage({
  params,
}: BusCompanyWorkspacePageProps) {
  const { companyId: rawCompanyId } = await params;
  const companyId = /^\d+$/.test(rawCompanyId)
    ? Number(rawCompanyId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <BusCompanyWorkspace companyId={companyId} />
    </AdminSessionGuard>
  );
}
