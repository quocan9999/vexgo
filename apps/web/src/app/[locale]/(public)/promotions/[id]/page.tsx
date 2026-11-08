import { PromotionDetailPage } from '@/features/promotions/components/promotion-detail-page';
import { getPromotionById } from '@/features/promotions/data/promotions.data';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const promo = getPromotionById(id);
  return {
    title: promo ? `${promo.title} | VexGo Khuyến Mãi` : 'Chi tiết khuyến mãi | VexGo',
    description: promo ? promo.summary : 'Chi tiết chương trình ưu đãi đặt vé xe khách VexGo.',
  };
}

export default async function PromotionDetailPageWrapper({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const promo = getPromotionById(id);
  return <PromotionDetailPage promotion={promo} />;
}
