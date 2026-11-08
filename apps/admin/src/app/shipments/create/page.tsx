import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { ShipmentCreateView } from '@/features/shipments/components/shipment-create-view';

export default function ShipmentCreatePage() {
  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="shipments"
        breadcrumbs={[
          { label: 'Danh sách phiếu gửi hàng', href: '/shipments' },
          { label: 'Tạo phiếu gửi hàng' },
        ]}
      >
        <ShipmentCreateView />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
