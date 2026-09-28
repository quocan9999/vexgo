import { Metadata } from 'next';
import { ProfileClientPage } from '@/modules/client/profile/pages/ProfileClientPage';

import ClientLayout from '@/modules/client/common/layouts/ClientLayout';

export const metadata: Metadata = {
  title: 'Thông tin tài khoản - BUSWAY',
  description: 'Quản lý thông tin hồ sơ để bảo mật tài khoản',
};

export default function ProfilePage() {
  return (
    <ClientLayout>
      <ProfileClientPage />
    </ClientLayout>
  );
}
