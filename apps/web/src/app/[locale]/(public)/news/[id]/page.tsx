import { NewsDetailPage } from '@/features/news/components/news-detail-page';
import { getNewsById } from '@/features/news/data/news.data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = getNewsById(id);
  return {
    title: article ? `${article.title} | VexGo Tin Tức` : 'Chi tiết tin tức | VexGo',
    description: article ? article.summary : 'Chi tiết tin tức và thông báo từ VexGo.',
  };
}

export default async function NewsDetailPageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = getNewsById(id);
  return <NewsDetailPage article={article} />;
}
