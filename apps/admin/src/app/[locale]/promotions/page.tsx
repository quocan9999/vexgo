import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { PromotionsManagement } from '@/features/promotions/components/promotions-management';

export default function PromotionsPage() {
  return (
    <AdminSessionGuard>
      <PromotionsManagement />
    </AdminSessionGuard>
  );
}
