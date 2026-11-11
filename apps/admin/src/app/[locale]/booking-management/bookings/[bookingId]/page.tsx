import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { BookingManagementDetail } from '@/features/booking-management/components/booking-management-detail';

type BookingDetailPageProps = {
  params: Promise<{ bookingId: string }>;
};

export default async function BookingDetailPage({
  params,
}: BookingDetailPageProps) {
  const { bookingId: rawId } = await params;
  const resourceId = /^\d+$/.test(rawId) ? Number(rawId) : Number.NaN;

  return (
    <AdminSessionGuard>
      <BookingManagementDetail kind="bookings" resourceId={resourceId} />
    </AdminSessionGuard>
  );
}
