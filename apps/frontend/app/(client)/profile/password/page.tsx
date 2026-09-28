import { Metadata } from 'next';
import ClientLayout from '@/modules/client/common/layouts/ClientLayout';
import { ProfilePasswordClientPage } from '@/modules/client/profile/pages/ProfilePasswordClientPage';

export const metadata: Metadata = {
  title: 'Đặt lại mật khẩu - BUSWAY',
  description: 'Quản lý thông tin bảo mật và mật khẩu của bạn',
};

export default function ProfilePasswordPage() {
  return (
    <ClientLayout>
      <ProfilePasswordClientPage />
    </ClientLayout>
  );
}
