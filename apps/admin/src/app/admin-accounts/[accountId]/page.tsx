import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { AdminAccountWorkspace } from '@/features/admin-accounts/components/admin-account-workspace';

type AdminAccountWorkspacePageProps = {
  params: Promise<{ accountId: string }>;
};

export default async function AdminAccountWorkspacePage({
  params,
}: AdminAccountWorkspacePageProps) {
  const { accountId: rawAccountId } = await params;
  const accountId = /^\d+$/.test(rawAccountId)
    ? Number(rawAccountId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <AdminAccountWorkspace accountId={accountId} />
    </AdminSessionGuard>
  );
}
