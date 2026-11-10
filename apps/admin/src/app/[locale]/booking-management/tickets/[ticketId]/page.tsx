import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { BookingManagementDetail } from '@/features/booking-management/components/booking-management-detail';

type TicketDetailPageProps = {
  params: Promise<{ ticketId: string }>;
};

export default async function TicketDetailPage({
  params,
}: TicketDetailPageProps) {
  const { ticketId: rawId } = await params;
  const resourceId = /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;

  return (
    <AdminSessionGuard>
      <BookingManagementDetail kind="tickets" resourceId={resourceId} />
    </AdminSessionGuard>
  );
}
