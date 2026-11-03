import { ConfigService } from '@nestjs/config';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { PaymentsService } from '../../../src/payments/payments.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';

const created = new Date('2026-11-03T01:00:00Z');
const deadline = new Date('2026-11-05T01:00:00Z');

function fixture(
  options: {
    status?: string;
    paid?: boolean;
    counter?: boolean;
    legacy?: boolean;
  } = {},
) {
  const shipment = {
    phieuGuiHangId: 7,
    donGiaoDichId: 9,
    trangThai: options.status ?? 'MOI_TAO',
    nguoiTraCuoc: options.counter ? 'NGUOI_NHAN' : 'NGUOI_GUI',
    hanMangHangDen: options.legacy ? null : deadline,
    donGiaoDich: {
      donGiaoDichId: 9,
      ngayTao: created,
      trangThai: options.paid ? 'DA_THANH_TOAN' : 'CHO_THANH_TOAN',
      phieuDatVe: null,
      thanhToans: [{ phuongThuc: options.counter ? 'TAI_BEN' : 'SEPAY' }],
    },
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ donGiaoDichId: 9 }]),
    phieuGuiHang: {
      findUnique: vi.fn().mockResolvedValue(shipment),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    donGiaoDich: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
    thanhToan: {
      findFirst: vi
        .fn()
        .mockResolvedValue(options.paid ? { thanhToanId: 12 } : null),
      aggregate: vi
        .fn()
        .mockImplementation((query: { where: { loaiGiaoDich: string } }) =>
          Promise.resolve({
            _sum: {
              soTien: new Prisma.Decimal(
                options.paid && query.where.loaiGiaoDich !== 'HOAN_TIEN'
                  ? 50000
                  : 0,
              ),
            },
          }),
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    lichSuTrangThaiPhieuGuiHang: { create: vi.fn() },
    xuLyTienGuiHang: { upsert: vi.fn() },
  };
  const service = new PaymentsService(
    tx as unknown as PrismaService,
    new ConfigService({ PAYMENT_DEMO_MODE: 'false' }),
  );
  const expire = (now: Date) =>
    service['expirePendingShipmentInTransaction'](
      tx as unknown as Prisma.TransactionClient,
      7,
      now,
    );
  return { tx, expire };
}

function paymentFixture(
  options: { due?: number; otherPayments?: unknown[] } = {},
) {
  const { tx } = fixture();
  const shipment = {
    phieuGuiHangId: 7,
    donGiaoDichId: 9,
    trangThai: 'MOI_TAO',
    hanMangHangDen: deadline,
  };
  const order = {
    donGiaoDichId: 9,
    trangThai: 'CHO_THANH_TOAN',
    tongTien: new Prisma.Decimal(options.due ?? 50000),
    ngayTao: created,
    phieuDatVe: null,
    phieuGuiHang: shipment,
  };
  const payment = {
    thanhToanId: 12,
    donGiaoDichId: 9,
    soTien: new Prisma.Decimal(50000),
    phuongThuc: 'SEPAY',
    loaiGiaoDich: 'THANH_TOAN',
    trangThai: 'DANG_XU_LY',
    maGiaoDichSePay: null,
    thoiDiemHoanTat: null,
    thoiGian: created,
    donGiaoDich: order,
  };
  const db = {
    ...tx,
    thanhToan: {
      ...tx.thanhToan,
      findUnique: vi.fn().mockResolvedValue(payment),
      findMany: vi.fn().mockResolvedValue(options.otherPayments ?? []),
      update: vi.fn(),
    },
    donGiaoDich: {
      ...tx.donGiaoDich,
      findUnique: vi.fn().mockResolvedValue(order),
    },
    $transaction: vi.fn(async (fn: (client: unknown) => Promise<unknown>) =>
      fn(db),
    ),
  };
  const service = new PaymentsService(db as unknown as PrismaService);
  return { db, service };
}

describe('standalone shipment drop-off deadline', () => {
  it('does not cancel an accepted recipient-pays shipment after 48 hours', async () => {
    const { tx, expire } = fixture({ status: 'DA_TIEP_NHAN', counter: true });
    expect(await expire(new Date(deadline.getTime() + 1))).toBe(false);
    expect(tx.phieuGuiHang.updateMany).not.toHaveBeenCalled();
    expect(tx.donGiaoDich.updateMany).not.toHaveBeenCalled();
  });

  it('expires an online payment attempt without cancelling the 48-hour waybill', async () => {
    const { tx, expire } = fixture();
    expect(await expire(new Date(created.getTime() + 11 * 60_000))).toBe(false);
    expect(tx.phieuGuiHang.updateMany).not.toHaveBeenCalled();
    expect(tx.donGiaoDich.updateMany).not.toHaveBeenCalled();
    expect(tx.thanhToan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { trangThai: 'THAT_BAI' } }),
    );
  });

  it('cancels a paid but unreceived waybill at the exact deadline and opens a manual case', async () => {
    const { tx, expire } = fixture({ paid: true });
    expect(await expire(deadline)).toBe(true);
    expect(tx.phieuGuiHang.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ trangThai: 'MOI_TAO' }),
        data: { trangThai: 'DA_HUY' },
      }),
    );
    expect(tx.xuLyTienGuiHang.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          phieuGuiHangId: 7,
          lyDo: 'HUY_DA_THANH_TOAN',
          soTien: new Prisma.Decimal(50000),
        }),
      }),
    );
    const changes = tx.thanhToan.updateMany.mock.calls;
    expect(changes.every(([arg]) => arg.where.trangThai !== 'THANH_CONG')).toBe(
      true,
    );
  });

  it('does not cancel paid waybills before their drop-off deadline', async () => {
    const { tx, expire } = fixture({ paid: true });
    expect(await expire(new Date(deadline.getTime() - 1))).toBe(false);
    expect(tx.phieuGuiHang.updateMany).not.toHaveBeenCalled();
    expect(tx.xuLyTienGuiHang.upsert).not.toHaveBeenCalled();
  });

  it('keeps legacy online payment cancellation semantics when no new deadline was stored', async () => {
    const { tx, expire } = fixture({ legacy: true });
    expect(await expire(new Date(created.getTime() + 11 * 60_000))).toBe(true);
    expect(tx.phieuGuiHang.updateMany).toHaveBeenCalled();
  });
});

describe('late online transfer for a new standalone shipment', () => {
  it('records incoming money for manual reconciliation without paying or cancelling the waybill', async () => {
    const { db, service } = paymentFixture();
    const result = await service.confirmPaymentSuccess({
      paymentId: 12,
      provider: 'SEPAY',
      amount: 50000,
      providerTransactionId: 'late-unique-1',
      providerTransactionAt: new Date(created.getTime() + 11 * 60_000),
    });
    expect(result).toMatchObject({
      success: true,
      requiresReconciliation: true,
    });
    expect(db.donGiaoDich.updateMany).not.toHaveBeenCalled();
    expect(db.phieuGuiHang.updateMany).not.toHaveBeenCalled();
    expect(db.thanhToan.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          trangThai: 'CAN_DOI_SOAT',
          laQuyetToanHopLe: false,
        }),
      }),
    );
    expect(db.xuLyTienGuiHang.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          phieuGuiHangId: 7,
          soTien: new Prisma.Decimal(50000),
        }),
      }),
    );
  });

  it('keeps the order unpaid when an on-time transfer is below the reweighed fee', async () => {
    const { db, service } = paymentFixture({ due: 60000 });

    const result = await service.confirmPaymentSuccess({
      paymentId: 12,
      provider: 'SEPAY',
      amount: 50000,
      providerTransactionId: 'on-time-partial-1',
      providerTransactionAt: new Date(created.getTime() + 5 * 60_000),
    });

    expect(result).toEqual({ success: true });
    expect(db.donGiaoDich.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { trangThai: 'CHO_THANH_TOAN' },
      }),
    );
    expect(db.thanhToan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { laQuyetToanHopLe: true } }),
    );
  });

  it('opens one reconciliation case for an on-time transfer above the final fee', async () => {
    const { db, service } = paymentFixture({ due: 40000 });

    await service.confirmPaymentSuccess({
      paymentId: 12,
      provider: 'SEPAY',
      amount: 50000,
      providerTransactionId: 'on-time-overpaid-1',
      providerTransactionAt: new Date(created.getTime() + 5 * 60_000),
    });

    expect(db.donGiaoDich.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { trangThai: 'DA_THANH_TOAN' } }),
    );
    expect(db.xuLyTienGuiHang.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          lyDo: 'CHENH_LECH_CUOC',
          soTien: new Prisma.Decimal(10000),
        }),
      }),
    );
  });
});
