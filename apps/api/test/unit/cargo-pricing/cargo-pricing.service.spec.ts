import { ConflictException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import { CargoPricingService } from '../../../src/cargo-pricing/cargo-pricing.service.js';

const trip = {
  chuyenXeId: 42,
  tuyenXeId: 7,
  nhaXeId: 3,
  ngayKhoiHanh: new Date('2026-12-01T00:00:00.000Z'),
};

const sender = {
  vaiTro: 'CA_HAI',
  diemGiaoNhanHangId: 11,
  diemGiaoNhanHang: { nhaXeId: 3, trangThai: 'HOAT_DONG' },
};
const receiver = {
  vaiTro: 'NHAN_HANG',
  diemGiaoNhanHangId: 12,
  diemGiaoNhanHang: { nhaXeId: 3, trangThai: 'HOAT_DONG' },
};
const cargoType = {
  loaiHangHoaId: 21,
  tenLoai: 'Điện tử',
  nhomSucChua: 'HANG_NHE',
  trangThai: 'HOAT_DONG',
};

function makeTransaction(options: {
  points?: unknown[];
  types?: unknown[];
  rates?: unknown[];
} = {}) {
  return {
    diemGiaoNhanTuyenXe: {
      findMany: vi.fn().mockResolvedValue(options.points ?? [sender, receiver]),
    },
    loaiHangHoa: {
      findMany: vi.fn().mockResolvedValue(options.types ?? [cargoType]),
    },
    bangCuocGuiHang: {
      findMany: vi.fn().mockResolvedValue(options.rates ?? [
        {
          bangCuocGuiHangId: 31,
          loaiHangHoaId: 21,
          khoiLuongTu: new Prisma.Decimal(0),
          khoiLuongDen: new Prisma.Decimal(7),
          mucCuoc: new Prisma.Decimal(60000),
          trangThai: 'HOAT_DONG',
          tuNgay: new Date('2020-01-01T00:00:00.000Z'),
          denNgay: null,
        },
      ]),
    },
  } as unknown as Prisma.TransactionClient;
}

describe('CargoPricingService', () => {
  it('shares bracket pricing, aggregates quantity, and charges each selected service fee once', async () => {
    const tx = makeTransaction();
    const service = new CargoPricingService();

    const result = await service.calculate(tx, trip, {
      senderPointId: 11,
      receiverPointId: 12,
      items: [
        {
          name: 'Máy ảnh',
          quantity: 2,
          weight: 2,
          loaiHangHoaId: 21,
          serviceType: 'FRAGILE',
        },
        {
          name: 'Máy tính bảng',
          quantity: 1,
          weight: 3,
          loaiHangHoaId: 21,
          serviceType: 'VALUABLE',
        },
      ],
    });

    expect(result.senderPointId).toBe(11);
    expect(result.receiverPointId).toBe(12);
    expect(result.rates).toHaveLength(1);
    expect(result.rates[0]).toMatchObject({
      loaiHangHoaId: 21,
      bangCuocGuiHangId: 31,
      totalWeight: expect.objectContaining({ d: [7] }),
      fee: expect.objectContaining({ d: [60000] }),
    });
    expect(result.baseFee.toNumber()).toBe(60000);
    expect(result.serviceFee.toNumber()).toBe(70000);
    expect(result.totalFee.toNumber()).toBe(130000);
    expect(tx.bangCuocGuiHang.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          diemGuiId: 11,
          diemNhanId: 12,
          trangThai: 'HOAT_DONG',
          tuNgay: { lte: trip.ngayKhoiHanh },
        }),
      }),
    );
  });

  it('requires an explicit type when the capacity group is ambiguous', async () => {
    const tx = makeTransaction({
      types: [
        cargoType,
        { ...cargoType, loaiHangHoaId: 22, tenLoai: 'Quần áo' },
      ],
    });
    const service = new CargoPricingService();

    await expect(
      service.calculate(tx, trip, {
        senderPointId: 11,
        receiverPointId: 12,
        items: [{ name: 'Vali', physicalType: 'Vali', quantity: 1, weight: 2 }],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'CARGO_TYPE_REQUIRED' }),
    });
    expect(tx.bangCuocGuiHang.findMany).not.toHaveBeenCalled();
  });

  it('rejects inactive or off-route points before reading rates', async () => {
    const tx = makeTransaction({ points: [
      sender,
      { ...receiver, diemGiaoNhanHang: { nhaXeId: 999, trangThai: 'HOAT_DONG' } },
    ] });
    const service = new CargoPricingService();

    await expect(
      service.calculate(tx, trip, {
        senderPointId: 11,
        receiverPointId: 12,
        items: [{ name: 'Máy ảnh', quantity: 1, weight: 2, loaiHangHoaId: 21 }],
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.bangCuocGuiHang.findMany).not.toHaveBeenCalled();
  });

  it('rejects a missing weight bracket without falling back to another rate', async () => {
    const tx = makeTransaction();
    const service = new CargoPricingService();

    await expect(
      service.calculate(tx, trip, {
        senderPointId: 11,
        receiverPointId: 12,
        items: [
          { name: 'Thùng hàng', quantity: 1, weight: 8, loaiHangHoaId: 21 },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'CARGO_RATE_NOT_FOUND' }),
    });
    expect(tx.bangCuocGuiHang.findMany).toHaveBeenCalledTimes(1);
  });

  it('fails closed when overlapping rates both include the same boundary weight', async () => {
    const tx = makeTransaction({
      rates: [
        {
          bangCuocGuiHangId: 31,
          loaiHangHoaId: 21,
          khoiLuongTu: new Prisma.Decimal(0),
          khoiLuongDen: new Prisma.Decimal(2),
          mucCuoc: new Prisma.Decimal(20000),
        },
        {
          bangCuocGuiHangId: 32,
          loaiHangHoaId: 21,
          khoiLuongTu: new Prisma.Decimal(2),
          khoiLuongDen: new Prisma.Decimal(5),
          mucCuoc: new Prisma.Decimal(40000),
        },
      ],
    });
    const service = new CargoPricingService();

    await expect(
      service.calculate(tx, trip, {
        senderPointId: 11,
        receiverPointId: 12,
        items: [{ name: 'Máy ảnh', quantity: 1, weight: 2, loaiHangHoaId: 21 }],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'CARGO_RATE_AMBIGUOUS' }),
    });
  });

  it('applies booking-only dimension and per-package weight limits before looking up rates', async () => {
    const service = new CargoPricingService();
    const limits = {
      maxNonVehiclePackageWeightKg: 40,
      maxNonVehicleDimensionsCm: { length: 150, width: 80, height: 80 },
    };
    const oversizedDimensionsTx = makeTransaction();

    await expect(
      service.calculate(oversizedDimensionsTx, trip, {
        senderPointId: 11,
        receiverPointId: 12,
        bookingLimits: limits,
        items: [
          {
            name: 'Thùng hàng',
            physicalType: 'Vali',
            loaiHangHoaId: 21,
            quantity: 1,
            weight: 2,
            length: 151,
            width: 20,
            height: 20,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'CARGO_DIMENSIONS_EXCEEDED' }),
    });
    expect(oversizedDimensionsTx.bangCuocGuiHang.findMany).not.toHaveBeenCalled();

    const oversizedWeightTx = makeTransaction();
    await expect(
      service.calculate(oversizedWeightTx, trip, {
        senderPointId: 11,
        receiverPointId: 12,
        bookingLimits: limits,
        items: [
          {
            name: 'Thùng hàng nặng',
            physicalType: 'Vali',
            loaiHangHoaId: 21,
            quantity: 2,
            weight: 21,
          },
        ],
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ error: 'CARGO_WEIGHT_EXCEEDED' }),
    });
    expect(oversizedWeightTx.bangCuocGuiHang.findMany).not.toHaveBeenCalled();
  });
});
