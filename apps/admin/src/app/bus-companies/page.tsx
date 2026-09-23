import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { BusCompaniesManagement } from '@/features/bus-companies/components/bus-companies-management';

export default function BusCompaniesPage() {
  return (
    <AdminSessionGuard>
      <BusCompaniesManagement />
    </AdminSessionGuard>
  );
}
