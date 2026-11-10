import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { ReviewsManagement } from '@/features/reviews/components/reviews-management';

export default function ReviewsPage() {
  return (
    <AdminSessionGuard>
      <ReviewsManagement />
    </AdminSessionGuard>
  );
}
