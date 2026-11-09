import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { VehicleCreateWorkspace } from '@/features/vehicles/components/vehicle-create-workspace';
import { getTranslations } from 'next-intl/server';

export default async function VehicleCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tVehicles = await getTranslations({ locale, namespace: 'vehicles' });

  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="vehicles"
        breadcrumbs={[
          { label: tVehicles('vehiclesTitle'), href: '/vehicles' },
          { label: tVehicles('createVehicle') },
        ]}
      >
        <VehicleCreateWorkspace />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
