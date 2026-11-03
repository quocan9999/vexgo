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
  it('does not cancel an accepted recipient-pays shipment after drop-off deadline', async () => {
    const { tx, expire } = fixture({ status: 'DA_TIEP_NHAN', counter: true });
    expect(await expire(new Date(deadline.getTime() + 1))).toBe(false);
    expect(tx.phieuGuiHang.updateMany).not.toHaveBeenCalled();
    expect(tx.donGiaoDich.updateMany).not.toHaveBeenCalled();
  });

  it('cancels an unreceived waybill at the exact deadline cleanly', async () => {
    const { tx, expire } = fixture();
    expect(await expire(deadline)).toBe(true);
    expect(tx.phieuGuiHang.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ trangThai: 'MOI_TAO' }),
        data: { trangThai: 'DA_HUY' },
      }),
    );
  });

  it('does not cancel waybills before their drop-off deadline', async () => {
    const { tx, expire } = fixture();
    expect(await expire(new Date(deadline.getTime() - 1))).toBe(false);
    expect(tx.phieuGuiHang.updateMany).not.toHaveBeenCalled();
  });
});

