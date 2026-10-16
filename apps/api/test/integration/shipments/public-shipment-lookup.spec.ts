import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import { ShipmentsService } from '../../../src/shipments/shipments.service.js';

describe('Public shipment lookup HTTP contract (MySQL integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let routeId: number;
  let vehicleTypeId: number;
  let vehicleId: number;
  let tripId: number;
  let senderPointId: number;
  let receiverPointId: number;
  let cargoTypeId: number;
  let orderId: number;
  let orderCreatedAt: Date;
  let shipmentId: number;

  const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
  const waybillCode = `VD-PUBLIC-${suffix}`;
  const senderPhone = '0901234567';
  const receiverPhone = '0907654321';
  const privateSenderName = `PII_SENDER_${suffix}`;
  const privateReceiverName = `PII_RECEIVER_${suffix}`;
  const privateEmail = `pii-${suffix.toLowerCase()}@example.test`;
  const privateCargoName = `PRIVATE_CARGO_${suffix}`;
  const privateShipmentNote = `PRIVATE_SHIPMENT_NOTE_${suffix}`;
  const privateHistoryNote = `PRIVATE_HISTORY_NOTE_${suffix}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    configureApi(app);
    await app.init();
    prisma = app.get(PrismaService);

    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-PUBLIC-${suffix}`,
        tenNhaXe: `Nhà xe công khai ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;

    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `TX-PUBLIC-${suffix}`,
        diemDi: `Điểm đi ${suffix}`,
        diemDen: `Điểm đến ${suffix}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { tuyenXeId: true },
    });
    routeId = route.tuyenXeId;

    const vehicleType = await prisma.loaiXe.create({
      data: { nhaXeId: busCompanyId, tenLoai: `Loại xe ${suffix}` },
      select: { loaiXeId: true },
    });
    vehicleTypeId = vehicleType.loaiXeId;

    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `59P${suffix.slice(0, 3)}${suffix.slice(3, 5)}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleTypeId,
      },
      select: { xeId: true },
    });
    vehicleId = vehicle.xeId;

    const trip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `CX-PUBLIC-${suffix}`,
        ngayKhoiHanh: new Date('2099-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        gioDen: new Date('1970-01-01T12:00:00.000Z'),
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: busCompanyId,
        tuyenXeId: routeId,
        xeId: vehicleId,
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
      },
      select: { chuyenXeId: true },
    });
    tripId = trip.chuyenXeId;

    const senderPoint = await prisma.diemGiaoNhanHang.create({
      data: {
        maDiem: `DP-S-${suffix}`,
        tenDiem: `Điểm gửi công khai ${suffix}`,
        diaChi: `Địa chỉ gửi công khai ${suffix}`,
        tinhThanh: 'TP.HCM',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { diemGiaoNhanHangId: true },
    });
    senderPointId = senderPoint.diemGiaoNhanHangId;

    const receiverPoint = await prisma.diemGiaoNhanHang.create({
      data: {
        maDiem: `DP-R-${suffix}`,
        tenDiem: `Điểm nhận công khai ${suffix}`,
        diaChi: `Địa chỉ nhận công khai ${suffix}`,
        tinhThanh: 'Lâm Đồng',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { diemGiaoNhanHangId: true },
    });
    receiverPointId = receiverPoint.diemGiaoNhanHangId;

    const cargoType = await prisma.loaiHangHoa.create({
      data: {
        tenLoai: `Loại hàng ${suffix}`,
        trangThai: 'HOAT_DONG',
        nhomSucChua: 'HANG_NHE',
      },
      select: { loaiHangHoaId: true },
    });
    cargoTypeId = cargoType.loaiHangHoaId;

    const order = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `ORDER-PUBLIC-${suffix}`,
        ngayTao: new Date(),
        tongTien: 120_000,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: privateSenderName,
        soDienThoaiKhachHang: senderPhone,
        emailKhachHang: privateEmail,
        khachHangId: null,
        nhaXeId: busCompanyId,
      },
      select: { donGiaoDichId: true, ngayTao: true },
    });
    orderId = order.donGiaoDichId;
    orderCreatedAt = order.ngayTao;
    await prisma.thanhToan.create({
      data: {
        soTien: 120_000,
        phuongThuc: 'SEPAY',
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: orderCreatedAt,
        trangThai: 'DANG_XU_LY',
        donGiaoDichId: orderId,
      },
    });

    const shipment = await prisma.phieuGuiHang.create({
      data: {
        maVanDon: waybillCode,
        tenNguoiNhan: privateReceiverName,
        soDienThoaiNguoiNhan: receiverPhone,
        ngayGui: new Date(),
        cuocChinh: 100_000,
        phiDichVu: 20_000,
        soTienGiam: 0,
        tongPhi: 120_000,
        nguoiTraCuoc: 'NGUOI_GUI',
        ghiChu: privateShipmentNote,
        trangThai: 'DANG_VAN_CHUYEN',
        chuyenXeId: tripId,
        diemGuiId: senderPointId,
        diemNhanId: receiverPointId,
        donGiaoDichId: orderId,
        hangHoas: {
          create: [
            {
              tenHang: privateCargoName,
              soLuong: 3,
              khoiLuong: 2,
              moTa: `PRIVATE_CARGO_DESCRIPTION_${suffix}`,
              loaiHangHoaId: cargoTypeId,
            },
          ],
        },
        lichSuTrangThais: {
          create: [
            {
              trangThai: 'DA_TIEP_NHAN',
              thoiGian: new Date('2099-11-30T10:00:00.000Z'),
              ghiChu: privateHistoryNote,
            },
          ],
        },
      },
      select: { phieuGuiHangId: true },
    });
    shipmentId = shipment.phieuGuiHangId;
  }, 30_000);

  afterAll(async () => {
    try {
      if (shipmentId) {
        await prisma.hangHoa.deleteMany({ where: { phieuGuiHangId: shipmentId } });
        await prisma.lichSuTrangThaiPhieuGuiHang.deleteMany({
          where: { phieuGuiHangId: shipmentId },
        });
        await prisma.phieuGuiHang.deleteMany({
          where: { phieuGuiHangId: shipmentId },
        });
      }
      if (orderId) {
        await prisma.thanhToan.deleteMany({
          where: { donGiaoDichId: orderId },
        });
        await prisma.donGiaoDich.deleteMany({
          where: { donGiaoDichId: orderId },
        });
      }
      if (cargoTypeId) {
        await prisma.loaiHangHoa.deleteMany({
          where: { loaiHangHoaId: cargoTypeId },
        });
      }
      if (senderPointId || receiverPointId) {
        await prisma.diemGiaoNhanHang.deleteMany({
          where: {
            diemGiaoNhanHangId: { in: [senderPointId, receiverPointId].filter(Boolean) },
          },
        });
      }
      if (tripId) {
        await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: tripId } });
      }
      if (vehicleId) {
        await prisma.xe.deleteMany({ where: { xeId: vehicleId } });
      }
      if (vehicleTypeId) {
        await prisma.loaiXe.deleteMany({ where: { loaiXeId: vehicleTypeId } });
      }
      if (routeId) {
        await prisma.tuyenXe.deleteMany({ where: { tuyenXeId: routeId } });
      }
      if (busCompanyId) {
        await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyId } });
      }
    } finally {
      await app?.close();
    }
  });

  it('reads the linked booking coupon without discounting cargo or mutating financial records', async () => {
    const promotion = await prisma.khuyenMai.create({ data: {
      nhaXeId: busCompanyId, tenChuongTrinh: `Public linked ${suffix}`, maKhuyenMai: `PUBLIC-${suffix}`,
      phamViApDung: 'DAT_VE', hinhThucApDung: 'NHAP_MA', loaiGiamGia: 'SO_TIEN', giaTriGiam: 30000,
      tuNgay: new Date('2020-01-01T00:00:00Z'), denNgay: new Date('2099-12-31T00:00:00Z'),
      trangThai: 'HOAT_DONG', soLuotToiDa: 5, soLuotDaSuDung: 0,
    } });
    let bookingId: number | undefined;
    try {
      const booking = await prisma.phieuDatVe.create({ data: {
        maPhieuDatVe: `PUBLIC-PDV-${suffix}`, ngayDat: new Date(), soLuongVeBanDau: 1,
        tongTienBanDau: 30000, soTienGiamKhuyenMai: 30000, trangThai: 'CHO_THANH_TOAN',
        khuyenMaiId: promotion.khuyenMaiId, donGiaoDichId: orderId,
      } });
      bookingId = booking.phieuDatVeId;
      const service = app.get(ShipmentsService);
      for (const phoneNumber of [senderPhone, receiverPhone]) {
        const result = await service.lookupShipment({ waybillCode, phoneNumber });
        expect(result).toMatchObject({ bookingPromotionCode: promotion.maKhuyenMai, amount: 120000, paymentStatus: 'DANG_XU_LY' });
        expect(result).not.toHaveProperty('shipmentPromotionCode');
        expect(result).not.toHaveProperty('discountAmount');
      }
      await expect(service.lookupShipment({ waybillCode, phoneNumber: '0900000000' })).rejects.toMatchObject({ response: { error: 'SHIPMENT_NOT_FOUND' } });
      const cargo = await prisma.phieuGuiHang.findUniqueOrThrow({ where: { phieuGuiHangId: shipmentId } });
      expect(cargo.khuyenMaiId).toBeNull();
      expect(Number(cargo.soTienGiam)).toBe(0);
      expect(Number(cargo.tongPhi)).toBe(120000);
      expect(await prisma.thanhToan.count({ where: { donGiaoDichId: orderId } })).toBe(1);
      expect((await prisma.khuyenMai.findUniqueOrThrow({ where: { khuyenMaiId: promotion.khuyenMaiId } })).soLuotDaSuDung).toBe(0);
      expect(await prisma.suDungKhuyenMai.count({ where: { khuyenMaiId: promotion.khuyenMaiId } })).toBe(0);
    } finally {
      if (bookingId) await prisma.phieuDatVe.delete({ where: { phieuDatVeId: bookingId } });
      await prisma.khuyenMai.delete({ where: { khuyenMaiId: promotion.khuyenMaiId } });
    }
  });

  it('returns minimal payment details only to a matched contact while keeping private shipment data hidden', async () => {
    const sendLookup = (code: string, phone: string) =>
      request(app.getHttpServer())
        .post('/api/v1/shipments/lookup')
        .send({ waybillCode: code, phoneNumber: phone });

    const senderResponse = await sendLookup(waybillCode, senderPhone).expect(200);
    const receiverResponse = await sendLookup(waybillCode, receiverPhone).expect(200);

    expect(senderResponse.body.data).toEqual({
      bookingPromotionCode: null,
      waybillCode,
      status: 'DANG_VAN_CHUYEN',
      carrier: { name: `Nhà xe công khai ${suffix}` },
      route: { origin: `Điểm đi ${suffix}`, destination: `Điểm đến ${suffix}` },
      pickupPoint: {
        name: `Điểm gửi công khai ${suffix}`,
        address: `Địa chỉ gửi công khai ${suffix}`,
      },
      dropoffPoint: {
        name: `Điểm nhận công khai ${suffix}`,
        address: `Địa chỉ nhận công khai ${suffix}`,
      },
      scheduledDepartureAt: expect.any(String),
      estimatedArrivalAt: expect.any(String),
      packageCount: 3,
      orderCode: `ORDER-PUBLIC-${suffix}`,
      orderStatus: 'CHO_THANH_TOAN',
      amount: 120_000,
      paymentStatus: 'DANG_XU_LY',
      requiresReconciliation: false,
      paymentMethod: 'SEPAY',
      paymentExpiresAt: new Date(orderCreatedAt.getTime() + 10 * 60_000).toISOString(),
      serverTime: expect.any(String),
      timeline: [
        {
          status: 'DA_TIEP_NHAN',
          time: '2099-11-30T10:00:00.000Z',
        },
      ],
    });
    expect(receiverResponse.body.data).toEqual({
      ...senderResponse.body.data,
      serverTime: expect.any(String),
    });

    const serializedResponse = JSON.stringify(senderResponse.body);
    for (const privateValue of [
      privateSenderName,
      privateReceiverName,
      senderPhone,
      receiverPhone,
      privateEmail,
      privateCargoName,
      privateShipmentNote,
      privateHistoryNote,
      `PRIVATE_CARGO_DESCRIPTION_${suffix}`,
    ]) {
      expect(serializedResponse).not.toContain(privateValue);
    }

    const wrongCode = await sendLookup(`MISSING-${suffix}`, senderPhone).expect(404);
    const wrongPhone = await sendLookup(waybillCode, '0900000000').expect(404);
    expect(JSON.stringify(wrongCode.body)).not.toContain(privateSenderName);
    expect(JSON.stringify(wrongPhone.body)).not.toContain(privateReceiverName);
    expect(JSON.stringify(wrongCode.body)).not.toContain(`ORDER-PUBLIC-${suffix}`);
    expect(JSON.stringify(wrongPhone.body)).not.toContain(`ORDER-PUBLIC-${suffix}`);
    expect(JSON.stringify(wrongCode.body)).not.toContain('120000');
    expect(JSON.stringify(wrongPhone.body)).not.toContain('120000');

    // Ticket lookup policy is 10 requests/minute. Four requests above have used this client bucket.
    for (let index = 4; index < 10; index += 1) {
      await sendLookup(waybillCode, senderPhone).expect(200);
    }
    const rateLimited = await sendLookup(waybillCode, senderPhone).expect(429);
    expect(rateLimited.body.statusCode).toBe(429);
  }, 30_000);
});
