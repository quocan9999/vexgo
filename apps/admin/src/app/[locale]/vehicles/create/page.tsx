import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { VehicleCreateWorkspace } from '@/features/vehicles/components/vehicle-create-workspace';

export default function VehicleCreatePage() {
  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="vehicles"
        breadcrumbs={[
          { label: 'Danh sách xe', href: '/vehicles' },
          { label: 'Thêm xe mới' },
        ]}
      >
        <VehicleCreateWorkspace />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
