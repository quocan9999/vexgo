import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { ShipmentsService } from '../../../src/shipments/shipments.service.js';
import { CargoPricingService } from '../../../src/cargo-pricing/cargo-pricing.service.js';
import { CargoCapacityService } from '../../../src/cargo-capacity/cargo-capacity.service.js';
import { ShipmentPersistenceService } from '../../../src/shipments/shipment-persistence.service.js';

const principal: AuthPrincipal = {
  taiKhoanId: 11,
  sessionId: 'test',
  nhaXeId: 2,
  nhanVienId: 3,
  roles: ['NHA_XE_ADMIN'],
  permissions: ['shipment:read', 'shipment:update'],
};
const decimal = (n: number) => new Prisma.Decimal(n);
function setup() {
  const shipment = {
    phieuGuiHangId: 7,
    donGiaoDichId: 9,
    trangThai: 'DA_TIEP_NHAN',
    chuyenXeId: null as number | null,
    chuyenXe: null,
    tuyenXeId: 4,
    tuyenXe: { tuyenXeId: 4, nhaXeId: 2 },
    diemGuiId: 1,
    diemNhanId: 2,
    diemGui: { nhaXeId: 2 },
    diemNhan: { nhaXeId: 2 },
    hanMangHangDen: new Date(Date.now() + 86400000),
    phiDichVu: decimal(0),
    soTienGiam: decimal(0),
    tongPhi: decimal(50000),
    donGiaoDich: {
      donGiaoDichId: 9,
      nhaXeId: 2,
      tongTien: decimal(50000),
      trangThai: 'CHO_THANH_TOAN',
      phieuDatVe: null,
      thanhToans: [],
    },
    hangHoas: [
      {
        hangHoaId: 8,
        tenHang: 'Sách',
        soLuong: 1,
        loaiHangHoaId: 5,
        loaiHangHoa: { nhomSucChua: 'HANG_NHE' },
      },
    ],
    chiTietCuocGuiHangs: [],
  };
  const trip = {
    chuyenXeId: 12,
    nhaXeId: 2,
    tuyenXeId: 4,
    trangThai: 'CHUA_KHOI_HANH',
    nhanGuiHang: true,
    ngayKhoiHanh: new Date('2099-01-01'),
    gioKhoiHanh: new Date('1970-01-01T12:00:00Z'),
  };
  const moneyCase = {
    xuLyTienGuiHangId: 1,
    phieuGuiHangId: 7,
    lyDo: 'HUY_DA_THANH_TOAN',
    soTien: decimal(50000),
    trangThai: 'CHO_XU_LY',
    thanhToanId: 21,
  };
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([{ donGiaoDichId: 9 }]),
    phieuGuiHang: {
      findUnique: vi.fn().mockResolvedValue(shipment),
      update: vi.fn(),
    },
    chuyenXe: { findUnique: vi.fn().mockResolvedValue(trip) },
    thanhToan: {
      create: vi.fn().mockResolvedValue({ thanhToanId: 22 }),
      updateMany: vi.fn(),
      aggregate: vi
        .fn()
        .mockResolvedValue({ _sum: { soTien: decimal(50000) } }),
    },
    donGiaoDich: { update: vi.fn() },
    hangHoa: { update: vi.fn() },
    chiTietCuocGuiHang: { deleteMany: vi.fn(), create: vi.fn() },
    lichSuTrangThaiPhieuGuiHang: { create: vi.fn() },
    lichSuPhanChuyenGuiHang: { create: vi.fn() },
    lichSuDieuChinhCuocGuiHang: { create: vi.fn() },
    xuLyTienGuiHang: {
      findUnique: vi.fn().mockResolvedValue(moneyCase),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) =>
      cb(db),
    ),
  };
  const capacity = new CargoCapacityService();
  vi.spyOn(capacity, 'lockTrip').mockResolvedValue();
  vi.spyOn(capacity, 'getSnapshot').mockResolvedValue({
    trip: {
      ...trip,
      sucChuaHangNhe: 10,
      sucChuaXeMay: 0,
      sucChuaHangCongKenh: 0,
    },
    capacities: {
      HANG_NHE: { total: 10, used: 0, remaining: 10 },
      XE_MAY: { total: 0, used: 0, remaining: 0 },
      HANG_CONG_KENH: { total: 0, used: 0, remaining: 0 },
    },
  });
  const service = new ShipmentsService(
    db as unknown as PrismaService,
    new ConfigService(),
    new CargoPricingService(),
    capacity,
    new ShipmentPersistenceService(),
  );
  // The operation's write/guard behavior is exercised; the read-only final projection is covered separately.
  vi.spyOn(service, 'findOne').mockResolvedValue({ data: {} } as Awaited<
    ReturnType<ShipmentsService['findOne']>
  >);
  return { db, service, shipment, trip, moneyCase, capacity };
}

describe('shipment operational invariants', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('assigns an accepted standalone shipment and records the actor', async () => {
    const { db, service } = setup();
    await service.assignShipment(7, { tripId: 12 }, principal);
    expect(db.phieuGuiHang.update).toHaveBeenCalledWith({
      where: { phieuGuiHangId: 7 },
      data: { chuyenXeId: 12 },
    });
    expect(db.lichSuPhanChuyenGuiHang.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          chuyenXeTruocId: null,
          chuyenXeSauId: 12,
          taiKhoanId: 11,
        }),
      }),
    );
  });

  it('rejects a trip that was closed to cargo between selection and assignment', async () => {
    const { db, service, trip } = setup();
    trip.nhanGuiHang = false;
    await expect(
      service.assignShipment(7, { tripId: 12 }, principal),
    ).rejects.toMatchObject({
      response: { error: 'SHIPMENT_ASSIGNMENT_INVALID' },
    });
    expect(db.phieuGuiHang.update).not.toHaveBeenCalled();
  });

  it('rejects a cross-tenant waybill even when it has no trip', async () => {
    const { db, service, shipment } = setup();
    shipment.donGiaoDich.nhaXeId = 99;
    await expect(
      service.collectPayment(7, { amount: 50000 }, principal),
    ).rejects.toMatchObject({ response: { error: 'SHIPMENT_NOT_FOUND' } });
    expect(db.thanhToan.create).not.toHaveBeenCalled();
  });

  it('records an explicit cash payment with actor and completion time', async () => {
    const { db, service } = setup();
    await service.collectPayment(
      7,
      { amount: 50000, note: 'Thu tại quầy' },
      principal,
    );
    expect(db.thanhToan.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        soTien: decimal(50000),
        phuongThuc: 'TAI_BEN',
        trangThai: 'THANH_CONG',
        nhanVienXacNhanId: 3,
        thoiDiemHoanTat: expect.any(Date),
      }),
    });
  });

  it('does not collect against unconfirmed measurements for a new waybill', async () => {
    const { db, service, shipment } = setup();
    shipment.trangThai = 'MOI_TAO';
    await expect(
      service.collectPayment(7, { amount: 50000 }, principal),
    ).rejects.toMatchObject({
      response: { error: 'SHIPMENT_ACCEPTANCE_REQUIRED' },
    });
    expect(db.thanhToan.create).not.toHaveBeenCalled();
  });

  it('returns the winning order when two identical create requests race on the idempotency key', async () => {
    const { service, db } = setup();
    const payload = {
      routeId: 4,
      sendDate: '03-11-2026',
      sender: { fullName: 'A', phoneNumber: '0900000001' },
      receiver: { fullName: 'B', phoneNumber: '0900000002' },
      items: [{ name: 'Sách', quantity: 1, weight: 1 }],
    };
    const { createHash } = await import('node:crypto');
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const result = { shipmentId: 7, waybillCode: 'VD7' };
    Object.assign(db, {
      yeuCauTaoPhieuGuiHang: {
        findUnique: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue({ payloadHash: hash, ketQua: result }),
      },
      tuyenXe: {
        findUnique: vi
          .fn()
          .mockResolvedValue({
            tuyenXeId: 4,
            nhaXeId: 2,
            trangThai: 'HOAT_DONG',
            nhaXe: { maNhaXe: 'NX' },
          }),
      },
    });
    Object.assign(db.chuyenXe, {
      findMany: vi
        .fn()
        .mockResolvedValue([
          {
            ngayKhoiHanh: new Date('2099-01-01'),
            gioKhoiHanh: new Date('1970-01-01T12:00:00Z'),
          },
        ]),
    });
    vi.spyOn(
      service as unknown as { validateSendDate: () => Date },
      'validateSendDate',
    ).mockReturnValue(new Date('2026-11-03'));
    db.$transaction.mockRejectedValueOnce(
      Object.assign(new Error('Unique constraint'), { code: 'P2002' }),
    );
    expect(
      await service.createShipment(payload, undefined, 'stable-key'),
    ).toEqual(result);
  });
});
