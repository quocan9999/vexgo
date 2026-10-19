import { describe, expect, it, vi } from 'vitest';
import { PaymentSettlementService } from '../../../src/payments/payment-settlement.service.js';

describe('PaymentSettlementService', () => {
  it('locks the payment order and reloads the payment before running settlement work', async () => {
    const sequence: string[] = [];
    const payment = {
      thanhToanId: 22,
      donGiaoDichId: 7,
      phuongThuc: 'SEPAY',
      trangThai: 'DANG_XU_LY',
      donGiaoDich: { donGiaoDichId: 7 },
    };
    const tx = {
      $queryRaw: vi.fn(async () => {
        sequence.push('lock-order');
        return [{ donGiaoDichId: 7 }];
      }),
      thanhToan: {
        findUnique: vi.fn(async () => {
          sequence.push('reload-payment');
          return payment;
        }),
      },
    };
    const prisma = {
      thanhToan: {
        findUnique: vi.fn().mockResolvedValue({ donGiaoDichId: 7 }),
      },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const service = new PaymentSettlementService(prisma as never);
    const work = vi.fn(async () => {
      sequence.push('settlement-work');
      return 'settled';
    });

    const result = await service.withLockedPayment(22, work);

    expect(result).toBe('settled');
    expect(sequence).toEqual([
      'lock-order',
      'reload-payment',
      'settlement-work',
    ]);
    expect(work).toHaveBeenCalledWith(tx, payment);
  });
});
