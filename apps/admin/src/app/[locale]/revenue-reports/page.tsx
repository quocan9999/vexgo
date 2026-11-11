import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { RevenueReportsDashboard } from '@/features/revenue-reports/components/revenue-reports-dashboard';

export default function RevenueReportsPage() {
  return (
    <AdminSessionGuard>
      <RevenueReportsDashboard />
    </AdminSessionGuard>
  );
}
