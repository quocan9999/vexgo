import { Suspense } from 'react';
import { AdminSessionGuard } from '@/features/admin-auth/components/admin-session-guard';
import { BookingManagement } from '@/features/booking-management/components/booking-management';

export default function BookingManagementPage() {
  return (
    <AdminSessionGuard>
      <Suspense fallback={<p role="status">Đang mở quản lý phiếu đặt vé…</p>}>
        <BookingManagement />
      </Suspense>
    </AdminSessionGuard>
  );
}
