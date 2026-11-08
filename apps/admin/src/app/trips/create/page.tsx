import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { SuperAdminLayout } from '@/features/super-admin-layout/components/super-admin-layout';
import { TripCreateWorkspace } from '@/features/trips/components/trip-create-workspace';

export default function TripCreatePage() {
  return (
    <AdminSessionGuard>
      <SuperAdminLayout
        activeSection="trips"
        breadcrumbs={[
          { label: 'Danh sách chuyến xe', href: '/trips' },
          { label: 'Thêm chuyến xe mới' },
        ]}
      >
        <TripCreateWorkspace />
      </SuperAdminLayout>
    </AdminSessionGuard>
  );
}
