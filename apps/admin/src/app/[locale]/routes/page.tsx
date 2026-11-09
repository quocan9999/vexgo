import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { RoutesManagement } from '@/features/routes/components/routes-management';

export default function RoutesPage() {
  return <AdminSessionGuard><RoutesManagement /></AdminSessionGuard>;
}
