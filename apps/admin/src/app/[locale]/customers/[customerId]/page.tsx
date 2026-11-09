import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { CustomerWorkspace } from '@/features/customers/components/customer-workspace';

type CustomerWorkspacePageProps = {
  params: Promise<{ customerId: string }>;
};

export default async function CustomerWorkspacePage({
  params,
}: CustomerWorkspacePageProps) {
  const { customerId: rawCustomerId } = await params;
  const customerId = /^\d+$/.test(rawCustomerId)
    ? Number(rawCustomerId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <CustomerWorkspace customerId={customerId} />
    </AdminSessionGuard>
  );
}
