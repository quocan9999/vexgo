import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { ShipmentCreateView } from '@/features/shipments/components/shipment-create-view';
import { getTranslations } from 'next-intl/server';

export default async function ShipmentCreatePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const tShipments = await getTranslations({ locale, namespace: 'shipments' });

  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="shipments"
        breadcrumbs={[
          { label: tShipments('shipmentsTitle'), href: '/shipments' },
          { label: tShipments('createShipment') },
        ]}
      >
        <ShipmentCreateView />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
