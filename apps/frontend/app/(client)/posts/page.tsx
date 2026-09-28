import ClientLayout from '@/modules/client/common/layouts/ClientLayout';
import PostListClientPage from '@/modules/client/pages/PostListClientPage';

export default function PostsApp() {
  return (
    <ClientLayout>
      <PostListClientPage />
    </ClientLayout>
  );
}
