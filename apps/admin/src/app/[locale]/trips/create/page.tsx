import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { TripCreateWorkspace } from '@/features/trips/components/trip-create-workspace';
import { getTranslations } from 'next-intl/server';

export default async function TripCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tTrips = await getTranslations({ locale, namespace: 'trips' });

  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="trips"
        breadcrumbs={[
          { label: tTrips('tripsTitle'), href: '/trips' },
          { label: tTrips('createNewTrip') },
        ]}
      >
        <TripCreateWorkspace />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
