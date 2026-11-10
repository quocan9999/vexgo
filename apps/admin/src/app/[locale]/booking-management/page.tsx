import { Suspense } from 'react';
import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { BookingManagement } from '@/features/booking-management/components/booking-management';
import { getTranslations } from 'next-intl/server';

export default async function BookingManagementPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tBookings = await getTranslations({ locale, namespace: 'bookings' });

  return (
    <AdminSessionGuard>
      <Suspense fallback={<p role="status">{tBookings('loadingBookings')}</p>}>
        <BookingManagement />
      </Suspense>
    </AdminSessionGuard>
  );
}
