import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPromotions, createPromotion, updatePromotionStatus } from '@/features/promotions/services/promotion-service';

const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/lib/admin-api-client', () => ({ adminApiFetch: state.fetch }));
vi.mock('@/lib/api-url', () => ({ getApiBaseUrl: () => 'http://localhost:4010/' }));

const promotion = {
  id: 5, name: 'Mùa hè', code: 'SUMMER10', discountType: 'PHAN_TRAM',
  discountValue: '10.00', maxDiscount: '50000.00', minimumTicketAmount: null,
  startsOn: '2026-01-01', endsOn: '2026-12-31', status: 'HOAT_DONG',
  usageCount: 1, usageLimit: 20, remainingUses: 19, effectiveState: 'ACTIVE',
};
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => state.fetch.mockReset());

describe('promotion API service', () => {
  it('sends tenant list filters and validates the data/meta envelope', async () => {
    state.fetch.mockResolvedValue(response({ data: [promotion], meta: { page: 2, pageSize: 10, totalItems: 11, totalPages: 2 } }));
    const result = await getPromotions({ page: 2, pageSize: 10, search: 'summer', sortBy: 'createdAt', sortDirection: 'desc', status: 'HOAT_DONG' });
    expect(state.fetch.mock.calls[0]?.[0]).toBe('http://localhost:4010/api/v1/promotions?page=2&pageSize=10&search=summer&sortBy=createdAt&sortDirection=desc&status=HOAT_DONG');
    expect(result.data[0]?.code).toBe('SUMMER10');
  });

  it('posts the frozen create contract without a status field', async () => {
    state.fetch.mockResolvedValue(response({ data: promotion }));
    await createPromotion({ name: 'Mùa hè', code: 'SUMMER10', discountType: 'PHAN_TRAM', discountValue: '10', maxDiscount: '50000', startsOn: '2026-01-01', endsOn: '2026-12-31', usageLimit: 20 });
    const [url, init] = state.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:4010/api/v1/promotions');
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Mùa hè', code: 'SUMMER10', discountType: 'PHAN_TRAM', discountValue: '10', maxDiscount: '50000', startsOn: '2026-01-01', endsOn: '2026-12-31', usageLimit: 20 });
  });

  it('patches only the status and preserves structured API errors', async () => {
    state.fetch.mockResolvedValue(response({ error: 'PROMOTION_CONCURRENT_MODIFICATION', message: 'Vừa thay đổi.', details: [{ field: 'status', message: 'Tải lại.' }] }, 409));
    await expect(updatePromotionStatus(5, 'TAM_NGUNG')).rejects.toMatchObject({ code: 'PROMOTION_CONCURRENT_MODIFICATION', status: 409, details: [{ field: 'status', message: 'Tải lại.' }] });
  });

  it('rejects an invalid success envelope instead of passing untrusted data through', async () => {
    state.fetch.mockResolvedValue(response({ data: [{ ...promotion, remainingUses: -1 }], meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } }));
    await expect(getPromotions({ page: 1, pageSize: 10, search: '', sortBy: 'createdAt', sortDirection: 'desc' })).rejects.toThrow('API trả về danh sách khuyến mãi không hợp lệ.');
  });
});
