import { NewsListPage } from '@/features/news/components/news-list-page';

export const metadata = {
  title: 'Tin tức & Cẩm nang xe khách | VexGo',
  description: 'Cập nhật tin tức vận tải, lịch trình tuyến xe mới và hướng dẫn đặt vé xe khách trực tuyến VexGo.',
};

export default function NewsPage() {
  return <NewsListPage />;
}
