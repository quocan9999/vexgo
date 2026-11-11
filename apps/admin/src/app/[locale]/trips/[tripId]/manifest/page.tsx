import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { TripManifestView } from '@/features/trips/components/trip-manifest-view';
import { getTranslations } from 'next-intl/server';

type TripManifestPageProps = {
  params: Promise<{ locale: string; tripId: string }>;
};

export default async function TripManifestPage({ params }: TripManifestPageProps) {
  const { locale, tripId: rawTripId } = await params;
  const tTrips = await getTranslations({ locale, namespace: 'trips' });
  const tripId = /^\d+$/.test(rawTripId)
    ? Number(rawTripId)
    : Number.NaN;

  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="trips"
        breadcrumbs={[
          { label: tTrips('tripsTitle'), href: '/trips' },
          { label: tTrips('manifestTitle') },
        ]}
      >
        <TripManifestView tripId={tripId} />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
