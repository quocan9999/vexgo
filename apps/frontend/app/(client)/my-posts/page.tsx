// /app/(client)/my-posts/page.tsx
import { Metadata } from 'next';
import ClientLayout from '@/modules/client/common/layouts/ClientLayout';
import { MyPostsClientPage } from '@/modules/client/my-posts/MyPostsClientPage';

export const metadata: Metadata = {
  title: 'Vé Của Tôi | BusWay',
  description: 'Quản lý vé, vận đơn, trạng thái thanh toán và lịch sử chuyến đi cá nhân.',
};

export default function MyPostsPage() {
  return (
    <ClientLayout>
      <MyPostsClientPage />
    </ClientLayout>
  );
}
