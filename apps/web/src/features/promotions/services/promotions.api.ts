import { ApiError } from '@/features/account/services/bookings.api';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

export interface AvailablePromotion {
  id: number;
  name: string;
  code: string;
  discountType: 'PHAN_TRAM' | 'SO_TIEN';
  discountValue: string;
  maxDiscount: string | null;
  minimumTicketAmount: string | null;
  startsOn: string;
  endsOn: string;
  remainingUses: number;
}

export const promotionsApi = {
  async getAvailablePromotions(params: {
    tripId?: number;
    nhaXeId?: number;
  }): Promise<{ data: AvailablePromotion[] }> {
    const query = new URLSearchParams();
    if (params.tripId) query.set('tripId', String(params.tripId));
    if (params.nhaXeId) query.set('nhaXeId', String(params.nhaXeId));

    const res = await fetch(`${API_BASE_URL}/promotions/available?${query.toString()}`);
    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      throw new ApiError(
        error.message || 'Không thể tải danh sách mã khuyến mãi.',
        res.status,
        error.error,
      );
    }
    return res.json();
  },
};
