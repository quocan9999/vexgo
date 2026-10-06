import type { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RefundProcessorService } from '../../../src/payments/refund-processor.service.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const refund = {
  thanhToanId: 77,
  soTien: new Prisma.Decimal('225000'),
  phuongThuc: 'MOMO',
  loaiGiaoDich: 'HOAN_TIEN',
  thoiGian: new Date('2026-10-04T09:00:00.000Z'),
  trangThai: 'DANG_XU_LY',
  donGiaoDichId: 201,
  veId: 1,
  createdAt: new Date('2026-10-04T09:00:00.000Z'),
  updatedAt: new Date('2026-10-04T09:00:00.000Z'),
};

function createService(configValues: Record<string, string | undefined> = {}) {
  const prisma = {
    thanhToan: {
      findUnique: vi.fn().mockResolvedValue(refund),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = {
    get: vi.fn((key: string) => configValues[key]),
  };
  return {
    prisma,
    service: new RefundProcessorService(
      prisma as unknown as PrismaService,
      config as unknown as ConfigService,
    ),
  };
}

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('RefundProcessorService', () => {
  it('dispatches a pending refund after commit with a stable idempotency key', async () => {
    const { prisma, service } = createService({
      REFUND_PROVIDER_URL: 'https://payments.example/refunds',
      REFUND_PROVIDER_TOKEN: 'provider-secret',
    });
    const providerFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: 'SUCCEEDED' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', providerFetch);

    await service.processRefund(77);

    expect(providerFetch).toHaveBeenCalledWith(
      'https://payments.example/refunds',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer provider-secret',
          'Idempotency-Key': 'refund-77',
        }),
        body: JSON.stringify({
          refundId: 77,
          transactionId: 201,
          ticketId: 1,
          amount: '225000',
          paymentMethod: 'MOMO',
        }),
      }),
    );
    expect(prisma.thanhToan.updateMany).toHaveBeenLastCalledWith({
      where: { thanhToanId: 77, trangThai: 'DANG_GUI' },
      data: { trangThai: 'THANH_CONG' },
    });
  });

  it('returns a failed provider request to the durable pending queue for retry', async () => {
    const { prisma, service } = createService({
      REFUND_PROVIDER_URL: 'https://payments.example/refunds',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down')),
    );

    await service.processRefund(77);

    expect(prisma.thanhToan.updateMany).toHaveBeenLastCalledWith({
      where: { thanhToanId: 77, trangThai: 'DANG_GUI' },
      data: { trangThai: 'DANG_XU_LY' },
    });
  });
});
