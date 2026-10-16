import { createHmac, randomUUID } from 'node:crypto';
import { Test } from '@nestjs/testing';
import {
  ConflictException,
  type ExecutionContext,
  type INestApplication,
} from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { AppModule } from '../../../src/app.module.js';
import { AccessTokenGuard } from '../../../src/auth/guards/access-token.guard.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import { configureApi } from '../../../src/common/configure-api.js';
import { CargoCapacityService } from '../../../src/cargo-capacity/cargo-capacity.service.js';
import { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { MomoWebhookDto, VnpayWebhookDto } from '../../../src/payments/dto/webhook.dto.js';
import { PaymentsService } from '../../../src/payments/payments.service.js';

import { Reflector } from '@nestjs/core';
import { AUTH_MODE_KEY, type EndpointAuthMode } from '../../../src/auth/decorators/public.decorator.js';

describe('Payments Webhook & Status Security with MySQL (Integration)', () => {
  const sepayTestSecret = 'integration-sepay-hmac-secret';
  const sepayTestAccountNumber = '0012345678';
  let originalSepaySecret: string | undefined;
  let originalSepayAccountNumber: string | undefined;
  let originalNodeEnv: string | undefined;
  let app: INestApplication;
  let prisma: PrismaService;
  let busCompanyId: number;
  let customerAId: number;
  let customerBId: number;
  let customerAPrincipal: AuthPrincipal;
  let customerBPrincipal: AuthPrincipal;
  let currentPrincipal: AuthPrincipal | null = null;

  beforeAll(async () => {
    originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';
    process.env.PAYMENT_DEMO_MODE = 'true';
    originalSepaySecret = process.env.SEPAY_WEBHOOK_SECRET;
    process.env.SEPAY_WEBHOOK_SECRET = sepayTestSecret;
    originalSepayAccountNumber = process.env.SEPAY_ACCOUNT_NUMBER;
    process.env.SEPAY_ACCOUNT_NUMBER = sepayTestAccountNumber;
    let reflector: Reflector;
    const accessTokenGuard = {
      canActivate(context: ExecutionContext) {
        const authMode = reflector?.getAllAndOverride<EndpointAuthMode>(AUTH_MODE_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);
        if (authMode === 'public' || authMode === 'optional') {
          if (currentPrincipal) {
            context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
              currentPrincipal;
          }
          return true;
        }

        if (currentPrincipal) {
          context.switchToHttp().getRequest<{ user?: AuthPrincipal }>().user =
            currentPrincipal;
          return true;
        }
        return false;
      },
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AccessTokenGuard)
      .useValue(accessTokenGuard)
      .compile();

    app = moduleRef.createNestApplication({ rawBody: true });
    configureApi(app);
    await app.init();

    reflector = app.get(Reflector);

    prisma = app.get(PrismaService);
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();

    // Create Bus Company
    const company = await prisma.nhaXe.create({
      data: {
        maNhaXe: `NX-PAY-${suffix}`,
        tenNhaXe: `Payments Test Co ${suffix}`,
        trangThai: 'HOAT_DONG',
      },
      select: { nhaXeId: true },
    });
    busCompanyId = company.nhaXeId;

    // Create Customer A
    const accountA = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8495${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Payer A ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-PA-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerAId = accountA.khachHang!.khachHangId;
    customerAPrincipal = {
      taiKhoanId: accountA.taiKhoanId,
      sessionId: `sess-pa-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };

    // Create Customer B
    const accountB = await prisma.taiKhoan.create({
      data: {
        soDienThoai: `+8496${suffix.slice(0, 7)}`,
        matKhau: '$2b$10$hashedpasswordforexampletest',
        hoTen: `Payer B ${suffix}`,
        trangThai: 'HOAT_DONG',
        daXacThucSoDienThoai: true,
        khachHang: {
          create: {
            maKhachHang: `KH-PB-${suffix}`,
          },
        },
      },
      include: { khachHang: true },
    });
    customerBId = accountB.khachHang!.khachHangId;
    customerBPrincipal = {
      taiKhoanId: accountB.taiKhoanId,
      sessionId: `sess-pb-${suffix}`,
      roles: ['CUSTOMER'],
      permissions: [],
      nhanVienId: null,
      nhaXeId: null,
    };
  }, 30_000);

  afterAll(async () => {
    try {
      await prisma.lichSuTrangThaiVe.deleteMany({
        where: { ve: { is: { phieuDatVe: { is: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } } } } } },
      });
      await prisma.ve.deleteMany({
        where: { phieuDatVe: { is: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } } } },
      });
      await prisma.lichSuTrangThaiPhieuDatVe.deleteMany({
        where: { phieuDatVe: { is: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } } } },
      });
      await prisma.thanhToan.deleteMany({
        where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
      });
      await prisma.phieuDatVe.deleteMany({
        where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
      });
      await prisma.donGiaoDich.deleteMany({
        where: { khachHangId: { in: [customerAId, customerBId] } },
      });
      await prisma.gheChuyenXe.deleteMany({ where: { chuyenXe: { nhaXeId: busCompanyId } } });
      await prisma.chuyenXe.deleteMany({ where: { nhaXeId: busCompanyId } });
      await prisma.ghe.deleteMany({ where: { xe: { nhaXeId: busCompanyId } } });
      await prisma.bangGia.deleteMany({ where: { nhaXeId: busCompanyId } });
      await prisma.tuyenXe.deleteMany({ where: { nhaXeId: busCompanyId } });
      await prisma.xe.deleteMany({ where: { nhaXeId: busCompanyId } });
      await prisma.loaiXe.deleteMany({ where: { nhaXeId: busCompanyId } });
      await prisma.nhaXe.deleteMany({ where: { nhaXeId: busCompanyId } });

      await prisma.khachHang.deleteMany({ where: { khachHangId: { in: [customerAId, customerBId] } } });
      await prisma.taiKhoan.deleteMany({ where: { taiKhoanId: { in: [customerAPrincipal.taiKhoanId, customerBPrincipal.taiKhoanId] } } });
    } finally {
      delete process.env.PAYMENT_DEMO_MODE;
      if (originalNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = originalNodeEnv;
      }
      if (originalSepaySecret === undefined) {
        delete process.env.SEPAY_WEBHOOK_SECRET;
      } else {
        process.env.SEPAY_WEBHOOK_SECRET = originalSepaySecret;
      }
      if (originalSepayAccountNumber === undefined) {
        delete process.env.SEPAY_ACCOUNT_NUMBER;
      } else {
        process.env.SEPAY_ACCOUNT_NUMBER = originalSepayAccountNumber;
      }
      await app?.close();
    }
  }, 30_000);

  beforeEach(async () => {
    currentPrincipal = null;
    await prisma.lichSuTrangThaiVe.deleteMany({
      where: { ve: { is: { phieuDatVe: { is: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } } } } } },
    });
    await prisma.ve.deleteMany({
      where: { phieuDatVe: { is: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } } } },
    });
    await prisma.lichSuTrangThaiPhieuDatVe.deleteMany({
      where: { phieuDatVe: { is: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } } } },
    });
    await prisma.thanhToan.deleteMany({
      where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
    });
    await prisma.phieuDatVe.deleteMany({
      where: { donGiaoDich: { is: { khachHangId: { in: [customerAId, customerBId] } } } },
    });
    await prisma.donGiaoDich.deleteMany({
      where: { khachHangId: { in: [customerAId, customerBId] } },
    });
  });

  async function createTestPayment(customerId: number, provider = 'MOMO') {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const donGiaoDich = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `DGD-PAY-${suffix}`,
        ngayTao: new Date(),
        tongTien: 200000,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: 'Payer Customer',
        soDienThoaiKhachHang: '+84950000001',
        khachHangId: customerId,
        nhaXeId: busCompanyId,
        phieuDatVe: {
          create: {
            maPhieuDatVe: `PDV-PAY-${suffix}`,
            ngayDat: new Date(),
            soLuongVeBanDau: 1,
            tongTienBanDau: 200000,
            trangThai: 'CHO_THANH_TOAN',
          },
        },
      },
      include: { phieuDatVe: true },
    });

    const thanhToan = await prisma.thanhToan.create({
      data: {
        soTien: 200000,
        phuongThuc: provider,
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: new Date(),
        trangThai: 'DANG_XU_LY',
        donGiaoDichId: donGiaoDich.donGiaoDichId,
      },
    });

    return { donGiaoDich, phieuDatVe: donGiaoDich.phieuDatVe!, thanhToan };
  }

  async function createTestBooking(
    customerId: number,
    status: 'CHO_THANH_TOAN' | 'DA_HUY' | 'DA_THANH_TOAN' = 'CHO_THANH_TOAN',
    amount = 200000,
  ) {
    const suffix = randomUUID().slice(0, 8).toUpperCase();
    const donGiaoDich = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `DGD-BK-${suffix}`,
        ngayTao: new Date(),
        tongTien: amount,
        trangThai: status,
        tenKhachHang: 'Booking Customer',
        soDienThoaiKhachHang: '+84950000001',
        khachHangId: customerId,
        nhaXeId: busCompanyId,
        phieuDatVe: {
          create: {
            maPhieuDatVe: `PDV-BK-${suffix}`,
            ngayDat: new Date(),
            soLuongVeBanDau: 1,
            tongTienBanDau: amount,
            trangThai: status,
          },
        },
      },
      include: { phieuDatVe: true },
    });

    return { donGiaoDich, phieuDatVe: donGiaoDich.phieuDatVe! };
  }

  async function createMultiTicketPayment(customerId: number, ticketCount = 3, provider = 'MOMO') {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
    const totalAmount = 100000 * ticketCount;

    const loaiXe = await prisma.loaiXe.create({
      data: { nhaXeId: busCompanyId, tenLoai: `Multi-Ticket Coach ${suffix}` },
      select: { loaiXeId: true },
    });

    const xe = await prisma.xe.create({
      data: {
        bienSoXe: `51B-${suffix}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: loaiXe.loaiXeId,
      },
      select: { xeId: true },
    });

    const tuyenXe = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `TX-${suffix}`,
        diemDi: 'Sài Gòn',
        diemDen: 'Đà Lạt',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { tuyenXeId: true },
    });

    const bangGia = await prisma.bangGia.create({
      data: {
        giaNiemYet: 100000,
        tuNgay: new Date('2025-01-01'),
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        tuyenXeId: tuyenXe.tuyenXeId,
        loaiXeId: loaiXe.loaiXeId,
      },
      select: { bangGiaId: true },
    });

    const chuyenXe = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `CX-${suffix}`,
        ngayKhoiHanh: new Date('2026-12-01'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 0,
        sucChuaHangNhe: 0,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: busCompanyId,
        tuyenXeId: tuyenXe.tuyenXeId,
        xeId: xe.xeId,
      },
      select: { chuyenXeId: true },
    });

    const gheChuyenXeIds: number[] = [];
    for (let i = 1; i <= ticketCount; i++) {
      const ghe = await prisma.ghe.create({
        data: { soGhe: `M${i}`, xeId: xe.xeId },
        select: { gheId: true },
      });
      const gcx = await prisma.gheChuyenXe.create({
        data: {
          trangThai: 'DANG_GIU_CHO',
          chuyenXeId: chuyenXe.chuyenXeId,
          gheId: ghe.gheId,
        },
        select: { gheChuyenXeId: true },
      });
      gheChuyenXeIds.push(gcx.gheChuyenXeId);
    }

    const donGiaoDich = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `DGD-M-${suffix}`,
        ngayTao: new Date(),
        tongTien: totalAmount,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: 'Multi Ticket Customer',
        soDienThoaiKhachHang: '+84950000002',
        khachHangId: customerId,
        nhaXeId: busCompanyId,
        phieuDatVe: {
          create: {
            maPhieuDatVe: `PDV-M-${suffix}`,
            ngayDat: new Date(),
            soLuongVeBanDau: ticketCount,
            tongTienBanDau: totalAmount,
            trangThai: 'CHO_THANH_TOAN',
          },
        },
      },
      include: { phieuDatVe: true },
    });

    const phieuDatVe = donGiaoDich.phieuDatVe!;

    const veIds: number[] = [];
    for (let i = 0; i < ticketCount; i++) {
      const ve = await prisma.ve.create({
        data: {
          maVe: `VE-M-${suffix}-${i + 1}`,
          giaNiemYet: 100000,
          giaThucTe: 100000,
          trangThai: 'CHO_THANH_TOAN',
          phieuDatVeId: phieuDatVe.phieuDatVeId,
          gheChuyenXeId: gheChuyenXeIds[i],
          bangGiaApDungId: bangGia.bangGiaId,
        },
        select: { veId: true },
      });
      veIds.push(ve.veId);
    }

    const thanhToan = await prisma.thanhToan.create({
      data: {
        soTien: totalAmount,
        phuongThuc: provider,
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: new Date(),
        trangThai: 'DANG_XU_LY',
        donGiaoDichId: donGiaoDich.donGiaoDichId,
      },
    });

    return {
      donGiaoDich,
      phieuDatVe,
      thanhToan,
      veIds,
      chuyenXeId: chuyenXe.chuyenXeId,
      gheChuyenXeIds,
      totalAmount,
      cleanup: async () => {
        await prisma.lichSuTrangThaiVe.deleteMany({ where: { veId: { in: veIds } } });
        await prisma.lichSuTrangThaiPhieuDatVe.deleteMany({ where: { phieuDatVeId: phieuDatVe.phieuDatVeId } });
        await prisma.thanhToan.deleteMany({ where: { thanhToanId: thanhToan.thanhToanId } });
        await prisma.ve.deleteMany({ where: { veId: { in: veIds } } });
        await prisma.phieuDatVe.deleteMany({ where: { phieuDatVeId: phieuDatVe.phieuDatVeId } });
        await prisma.donGiaoDich.deleteMany({ where: { donGiaoDichId: donGiaoDich.donGiaoDichId } });
        await prisma.gheChuyenXe.deleteMany({ where: { gheChuyenXeId: { in: gheChuyenXeIds } } });
        await prisma.chuyenXe.deleteMany({ where: { chuyenXeId: chuyenXe.chuyenXeId } });
        await prisma.ghe.deleteMany({ where: { xeId: xe.xeId } });
        await prisma.bangGia.deleteMany({ where: { bangGiaId: bangGia.bangGiaId } });
        await prisma.tuyenXe.deleteMany({ where: { tuyenXeId: tuyenXe.tuyenXeId } });
        await prisma.xe.deleteMany({ where: { xeId: xe.xeId } });
        await prisma.loaiXe.deleteMany({ where: { loaiXeId: loaiXe.loaiXeId } });
      },
    };
  }

  async function createShipmentOnlyPayment(customerId: number, amount = 200000) {
    const suffix = randomUUID().replaceAll('-', '').slice(0, 10).toUpperCase();
    const vehicleType = await prisma.loaiXe.create({
      data: { nhaXeId: busCompanyId, tenLoai: `Shipment payment coach ${suffix}` },
      select: { loaiXeId: true },
    });
    const vehicle = await prisma.xe.create({
      data: {
        bienSoXe: `SP-${suffix}`,
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
        loaiXeId: vehicleType.loaiXeId,
      },
      select: { xeId: true },
    });
    const route = await prisma.tuyenXe.create({
      data: {
        maTuyenXe: `SP-TX-${suffix}`,
        diemDi: 'Sài Gòn',
        diemDen: 'Đà Lạt',
        trangThai: 'HOAT_DONG',
        nhaXeId: busCompanyId,
      },
      select: { tuyenXeId: true },
    });
    const trip = await prisma.chuyenXe.create({
      data: {
        maChuyenXe: `SP-CX-${suffix}`,
        ngayKhoiHanh: new Date('2030-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        sucChuaXeMay: 0,
        sucChuaHangCongKenh: 5,
        sucChuaHangNhe: 5,
        nhanGuiHang: true,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: busCompanyId,
        tuyenXeId: route.tuyenXeId,
        xeId: vehicle.xeId,
      },
      select: { chuyenXeId: true },
    });
    const [senderPoint, receiverPoint] = await Promise.all([
      prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `SP-G-${suffix}`,
          tenDiem: `Điểm gửi ${suffix}`,
          diaChi: '1 Đường thử',
          tinhThanh: 'Hồ Chí Minh',
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
        },
        select: { diemGiaoNhanHangId: true },
      }),
      prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `SP-N-${suffix}`,
          tenDiem: `Điểm nhận ${suffix}`,
          diaChi: '2 Đường thử',
          tinhThanh: 'Lâm Đồng',
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
        },
        select: { diemGiaoNhanHangId: true },
      }),
    ]);
    const createdAt = new Date();
    const order = await prisma.donGiaoDich.create({
      data: {
        maDonGiaoDich: `SP-GD-${suffix}`,
        ngayTao: createdAt,
        tongTien: amount,
        trangThai: 'CHO_THANH_TOAN',
        tenKhachHang: 'Shipment payment customer',
        soDienThoaiKhachHang: '+84950000001',
        khachHangId: customerId,
        nhaXeId: busCompanyId,
      },
      select: {
        donGiaoDichId: true,
        maDonGiaoDich: true,
        ngayTao: true,
        tongTien: true,
      },
    });
    const shipment = await prisma.phieuGuiHang.create({
      data: {
        maVanDon: `SP-VD-${suffix}`,
        ngayGui: createdAt,
        cuocChinh: amount,
        phiDichVu: 0,
        soTienGiam: 0,
        tongPhi: amount,
        nguoiTraCuoc: 'NGUOI_GUI',
        trangThai: 'MOI_TAO',
        tenNguoiNhan: 'Shipment payment receiver',
        soDienThoaiNguoiNhan: '+84950000002',
        donGiaoDichId: order.donGiaoDichId,
        chuyenXeId: trip.chuyenXeId,
        diemGuiId: senderPoint.diemGiaoNhanHangId,
        diemNhanId: receiverPoint.diemGiaoNhanHangId,
      },
      select: { phieuGuiHangId: true, maVanDon: true },
    });
    const cargoType = await prisma.loaiHangHoa.create({
      data: {
        tenLoai: `Shipment expiry cargo ${suffix}`,
        trangThai: 'HOAT_DONG',
        nhomSucChua: 'HANG_NHE',
      },
      select: { loaiHangHoaId: true },
    });
    const cargoItem = await prisma.hangHoa.create({
      data: {
        tenHang: `Kiện thử ${suffix}`,
        soLuong: 2,
        khoiLuong: 1,
        loaiHangHoaId: cargoType.loaiHangHoaId,
        phieuGuiHangId: shipment.phieuGuiHangId,
      },
      select: { hangHoaId: true },
    });
    const payment = await prisma.thanhToan.create({
      data: {
        soTien: amount,
        phuongThuc: 'SEPAY',
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: createdAt,
        trangThai: 'DANG_XU_LY',
        donGiaoDichId: order.donGiaoDichId,
      },
      select: { thanhToanId: true },
    });

    return {
      order,
      shipment,
      payment,
      amount,
      tripId: trip.chuyenXeId,
      senderPhone: '+84950000001',
      cleanup: async () => {
        await prisma.thanhToan.deleteMany({
          where: { thanhToanId: payment.thanhToanId },
        });
        await prisma.lichSuTrangThaiPhieuGuiHang.deleteMany({
          where: { phieuGuiHangId: shipment.phieuGuiHangId },
        });
        await prisma.hangHoa.deleteMany({
          where: { hangHoaId: cargoItem.hangHoaId },
        });
        await prisma.phieuGuiHang.deleteMany({
          where: { phieuGuiHangId: shipment.phieuGuiHangId },
        });
        await prisma.donGiaoDich.deleteMany({
          where: { donGiaoDichId: order.donGiaoDichId },
        });
        await prisma.diemGiaoNhanHang.deleteMany({
          where: {
            diemGiaoNhanHangId: {
              in: [senderPoint.diemGiaoNhanHangId, receiverPoint.diemGiaoNhanHangId],
            },
          },
        });
        await prisma.chuyenXe.deleteMany({
          where: { chuyenXeId: trip.chuyenXeId },
        });
        await prisma.tuyenXe.deleteMany({
          where: { tuyenXeId: route.tuyenXeId },
        });
        await prisma.xe.deleteMany({ where: { xeId: vehicle.xeId } });
        await prisma.loaiXe.deleteMany({
          where: { loaiXeId: vehicleType.loaiXeId },
        });
        await prisma.loaiHangHoa.deleteMany({
          where: { loaiHangHoaId: cargoType.loaiHangHoaId },
        });
      },
    };
  }

  function formatSepayVietnamTime(date: Date): string {
    const vietnamTime = new Date(date.getTime() + 7 * 60 * 60 * 1000);
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${vietnamTime.getUTCFullYear()}-${pad(vietnamTime.getUTCMonth() + 1)}-${pad(vietnamTime.getUTCDate())} ${pad(vietnamTime.getUTCHours())}:${pad(vietnamTime.getUTCMinutes())}:${pad(vietnamTime.getUTCSeconds())}`;
  }

  async function postSignedSepayEvent(
    payload: Record<string, unknown>,
    options: { includeTransactionDate?: boolean } = {},
  ) {
    const signedPayload =
      options.includeTransactionDate === false ||
      Object.prototype.hasOwnProperty.call(payload, 'transactionDate')
        ? payload
        : { ...payload, transactionDate: formatSepayVietnamTime(new Date()) };
    const rawBody = JSON.stringify(signedPayload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = `sha256=${createHmac('sha256', sepayTestSecret)
      .update(`${timestamp}.`)
      .update(rawBody)
      .digest('hex')}`;
    return request(app.getHttpServer())
      .post('/api/v1/payments/sepay-webhook')
      .set('Content-Type', 'application/json')
      .set('X-SePay-Timestamp', timestamp)
      .set('X-SePay-Signature', signature)
      .send(rawBody);
  }

  function buildMomoPayload(paymentId: number, options: Partial<MomoWebhookDto> = {}) {
    const secret = 'vexgo_momo_demo_secret';
    const base: MomoWebhookDto = {
      partnerCode: 'MOMO',
      orderId: String(paymentId),
      requestId: `REQ-${paymentId}`,
      amount: 200000,
      orderInfo: `Thanh toan ve #${paymentId}`,
      orderType: 'momo_wallet',
      transId: 987654321,
      resultCode: 0,
      message: 'Thành công',
      payType: 'qr',
      responseTime: Date.now(),
      extraData: String(paymentId),
      accessKey: 'DEMO_ACCESS_KEY',
      ...options,
    };

    const raw = `accessKey=${base.accessKey ?? ''}&amount=${base.amount ?? ''}&extraData=${base.extraData ?? ''}&message=${base.message ?? ''}&orderId=${base.orderId ?? ''}&orderInfo=${base.orderInfo ?? ''}&orderType=${base.orderType ?? ''}&partnerCode=${base.partnerCode ?? ''}&payType=${base.payType ?? ''}&requestId=${base.requestId ?? ''}&responseTime=${base.responseTime ?? ''}&resultCode=${base.resultCode ?? ''}&transId=${base.transId ?? ''}`;
    const signature = createHmac('sha256', secret).update(raw).digest('hex');

    return { ...base, signature };
  }

  function buildVnpayPayload(paymentId: number, options: Partial<VnpayWebhookDto> = {}) {
    const secret = 'vexgo_vnpay_demo_secret';
    const base: Record<string, any> = {
      vnp_Amount: '20000000',
      vnp_BankCode: 'NCB',
      vnp_BankTranNo: 'VNP123456',
      vnp_CardType: 'ATM',
      vnp_OrderInfo: `Thanh toan ve #${paymentId}`,
      vnp_PayDate: '20261008200000',
      vnp_ResponseCode: '00',
      vnp_TmnCode: 'DEMOTMN',
      vnp_TransactionNo: '14123456',
      vnp_TransactionStatus: '00',
      vnp_TxnRef: String(paymentId),
      ...options,
    };

    const entries = Object.entries(base)
      .filter(([k, v]) => k.startsWith('vnp_') && v !== undefined && v !== null && v !== '')
      .sort(([a], [b]) => a.localeCompare(b));

    const signData = entries
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`)
      .join('&');

    const vnp_SecureHash = createHmac('sha512', secret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    return { ...base, vnp_SecureHash } as VnpayWebhookDto;
  }

  it('valid MoMo webhook signature confirms payment, transaction, and booking to success atomically', async () => {
    const { thanhToan, donGiaoDich, phieuDatVe } = await createTestPayment(customerAId, 'MOMO');

    const payload = buildMomoPayload(thanhToan.thanhToanId);

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);

    expect(res.status).toBe(201); // Nest POST default
    const body = res.body.data ?? res.body;
    expect(body.resultCode).toBe(0);

    // Database verification: atomic transition to THANH_CONG / DA_THANH_TOAN
    const updatedPayment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(updatedPayment?.trangThai).toBe('THANH_CONG');

    const updatedTx = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(updatedTx?.trangThai).toBe('DA_THANH_TOAN');

    const updatedBooking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(updatedBooking?.trangThai).toBe('DA_THANH_TOAN');

    // Status history verification (PR #33 / discussion_r4220529096)
    const bookingHistory = await prisma.lichSuTrangThaiPhieuDatVe.findFirst({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(bookingHistory?.trangThaiMoi).toBe('DA_THANH_TOAN');
    expect(bookingHistory?.nguonThayDoi).toBe('SYSTEM');
    expect(bookingHistory?.taiKhoanId).toBeNull();
    expect(bookingHistory?.maThaoTac).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('rejects MoMo webhook with invalid or forged signature with 400 Bad Request without mutating DB', async () => {
    const { thanhToan, donGiaoDich, phieuDatVe } = await createTestPayment(customerAId, 'MOMO');

    const forgedPayload = {
      ...buildMomoPayload(thanhToan.thanhToanId),
      signature: 'bad_forged_signature_1234567890abcdef',
    };

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(forgedPayload);

    expect(res.status).toBe(400);

    // DB remains unchanged in MySQL
    const payment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(payment?.trangThai).toBe('DANG_XU_LY');

    const tx = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(tx?.trangThai).toBe('CHO_THANH_TOAN');

    const booking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(booking?.trangThai).toBe('CHO_THANH_TOAN');
  });

  it('valid VNPay webhook signature confirms payment atomically', async () => {
    const { thanhToan, donGiaoDich, phieuDatVe } = await createTestPayment(customerAId, 'VNPAY');

    const payload = buildVnpayPayload(thanhToan.thanhToanId);

    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/vnpay/webhook')
      .send(payload);

    expect(res.status).toBe(201);
    const body = res.body.data ?? res.body;
    expect(body.RspCode).toBe('00');

    // DB verification
    const updatedPayment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(updatedPayment?.trangThai).toBe('THANH_CONG');

    const updatedTx = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(updatedTx?.trangThai).toBe('DA_THANH_TOAN');

    const updatedBooking = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(updatedBooking?.trangThai).toBe('DA_THANH_TOAN');
  });

  it('duplicate webhook is idempotent and does not error', async () => {
    const { thanhToan } = await createTestPayment(customerAId, 'MOMO');
    const payload = buildMomoPayload(thanhToan.thanhToanId);

    // First webhook call
    const res1 = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);
    expect(res1.status).toBe(201);

    // Second webhook call (idempotent duplicate retry from gateway)
    const res2 = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);
    expect(res2.status).toBe(201);
    const body2 = res2.body.data ?? res2.body;
    expect(body2.resultCode).toBe(0);

    const payment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(payment?.trangThai).toBe('THANH_CONG');
  });

  it('concurrent webhooks are atomic and create exactly one history transition (discussion_r4222294112)', async () => {
    const { thanhToan, phieuDatVe } = await createTestPayment(customerAId, 'MOMO');
    const payload = buildMomoPayload(thanhToan.thanhToanId);

    // Fire 2 concurrent webhooks simultaneously
    const [res1, res2] = await Promise.all([
      request(app.getHttpServer())
        .post('/api/v1/payments/momo/webhook')
        .send(payload),
      request(app.getHttpServer())
        .post('/api/v1/payments/momo/webhook')
        .send(payload),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);

    const payment = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(payment?.trangThai).toBe('THANH_CONG');

    // Exactly 1 LichSuTrangThaiPhieuDatVe record must exist
    const bookingHistories = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(bookingHistories).toHaveLength(1);
    expect(bookingHistories[0].trangThaiMoi).toBe('DA_THANH_TOAN');
    expect(bookingHistories[0].nguonThayDoi).toBe('SYSTEM');
    expect(bookingHistories[0].maThaoTac).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('getPaymentStatus is read-only and enforces customer ownership', async () => {
    const { thanhToan } = await createTestPayment(customerAId, 'MOMO');

    // Customer A queries own payment status -> 200 OK, status PENDING
    currentPrincipal = customerAPrincipal;
    const resA = await request(app.getHttpServer())
      .get(`/api/v1/payments/${thanhToan.thanhToanId}/status`);
    expect(resA.status).toBe(200);
    const bodyA = resA.body.data ?? resA.body;
    expect(bodyA.status).toBe('PENDING');
    expect(bodyA.amount).toBe(200000);

    // Verify DB was NOT mutated by status polling
    const paymentUnchanged = await prisma.thanhToan.findUnique({
      where: { thanhToanId: thanhToan.thanhToanId },
    });
    expect(paymentUnchanged?.trangThai).toBe('DANG_XU_LY');

    // Customer B attempts to query Customer A's payment status -> 403 Forbidden
    currentPrincipal = customerBPrincipal;
    const resB = await request(app.getHttpServer())
      .get(`/api/v1/payments/${thanhToan.thanhToanId}/status`);
    expect(resB.status).toBe(403);
    expect(resB.body.error).toBe('FORBIDDEN');
  });

  it('rejects webhook when provider or amount mismatches (discussion_r4164957958 & r4164957969)', async () => {
    // 1. Create a payment for VNPAY
    const { thanhToan: vnpayPayment } = await createTestPayment(customerAId, 'VNPAY');

    // Attempt to confirm via MOMO webhook -> 400 Bad Request
    const forgedMomoPayload = buildMomoPayload(vnpayPayment.thanhToanId);
    const resProviderMismatch = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(forgedMomoPayload);
    expect(resProviderMismatch.status).toBe(400);

    // 2. Create a payment for MOMO with amount 200,000đ
    const { thanhToan: momoPayment } = await createTestPayment(customerAId, 'MOMO');

    // Attempt to confirm with mismatched amount (e.g. 50,000đ)
    const forgedAmountPayload = buildMomoPayload(momoPayment.thanhToanId, { amount: 50000 });
    const resAmountMismatch = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(forgedAmountPayload);
    expect(resAmountMismatch.status).toBe(400);

    // Ensure payment remains DANG_XU_LY without any status corruption
    const paymentCheck = await prisma.thanhToan.findUnique({
      where: { thanhToanId: momoPayment.thanhToanId },
    });
    expect(paymentCheck?.trangThai).toBe('DANG_XU_LY');
  });

  it('does not revive cancelled booking or tickets upon receiving late valid webhook (discussion_r4222294102)', async () => {
    const { thanhToan, phieuDatVe, donGiaoDich } = await createTestPayment(customerAId, 'MOMO');

    // Simulate booking and transaction cancellation before webhook arrives
    await prisma.phieuDatVe.update({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
      data: { trangThai: 'DA_HUY' },
    });
    await prisma.donGiaoDich.update({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
      data: { trangThai: 'DA_HUY' },
    });

    // Valid signed MoMo webhook arrives late
    const payload = buildMomoPayload(thanhToan.thanhToanId, { amount: 200000 });
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);

    expect(res.status).toBe(201);

    // Verify booking is NOT revived to DA_THANH_TOAN
    const bookingInDb = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(bookingInDb?.trangThai).toBe('DA_HUY');

    // Verify donGiaoDich is NOT revived
    const donInDb = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(donInDb?.trangThai).toBe('DA_HUY');

    // Verify no incorrect history transitions were created for cancelled booking
    const histories = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(histories).toHaveLength(0);
  });

  it('does not revive booking or tickets when donGiaoDich is DA_HUY but phieuDatVe is CHO_THANH_TOAN (Finding 1 / discussion_r4226248027)', async () => {
    const { thanhToan, phieuDatVe, donGiaoDich } = await createTestPayment(customerAId, 'MOMO');

    // Simulate scenario from Lead's review: donGiaoDich was cancelled, but phieuDatVe remained CHO_THANH_TOAN
    await prisma.donGiaoDich.update({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
      data: { trangThai: 'DA_HUY' },
    });

    // Valid signed MoMo webhook arrives late
    const payload = buildMomoPayload(thanhToan.thanhToanId, { amount: 200000 });
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments/momo/webhook')
      .send(payload);

    expect(res.status).toBe(201);
    const body = res.body.data ?? res.body;
    expect(body.resultCode).toBe(0);

    // Verify donGiaoDich is NOT revived
    const donInDb = await prisma.donGiaoDich.findUnique({
      where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
    });
    expect(donInDb?.trangThai).toBe('DA_HUY');

    // Verify booking is NOT transitioned to DA_THANH_TOAN
    const bookingInDb = await prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(bookingInDb?.trangThai).toBe('CHO_THANH_TOAN');

    // Verify no incorrect history transition to DA_THANH_TOAN was created
    const histories = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
      where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
    });
    expect(histories).toHaveLength(0);
  });

  it('creates synchronized status histories with identical operation UUID v1 and timestamp for multi-ticket bookings (discussion_r4222309384)', async () => {
    const multiTicket = await createMultiTicketPayment(customerAId, 3, 'MOMO');

    try {
      const payload = buildMomoPayload(multiTicket.thanhToan.thanhToanId, {
        amount: multiTicket.totalAmount,
      });

      const res = await request(app.getHttpServer())
        .post('/api/v1/payments/momo/webhook')
        .send(payload);

      expect(res.status).toBe(201);

      // Verify payment, transaction, and booking are DA_THANH_TOAN / THANH_CONG
      const updatedPayment = await prisma.thanhToan.findUnique({
        where: { thanhToanId: multiTicket.thanhToan.thanhToanId },
      });
      expect(updatedPayment?.trangThai).toBe('THANH_CONG');

      const updatedBooking = await prisma.phieuDatVe.findUnique({
        where: { phieuDatVeId: multiTicket.phieuDatVe.phieuDatVeId },
      });
      expect(updatedBooking?.trangThai).toBe('DA_THANH_TOAN');

      // Verify all 3 tickets transitioned to DA_THANH_TOAN
      const updatedTickets = await prisma.ve.findMany({
        where: { veId: { in: multiTicket.veIds } },
      });
      expect(updatedTickets).toHaveLength(3);
      for (const ticket of updatedTickets) {
        expect(ticket.trangThai).toBe('DA_THANH_TOAN');
      }

      // Verify exactly 1 booking status history
      const bookingHistories = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
        where: { phieuDatVeId: multiTicket.phieuDatVe.phieuDatVeId },
      });
      expect(bookingHistories).toHaveLength(1);
      const bookingHistory = bookingHistories[0];
      expect(bookingHistory.trangThaiCu).toBe('CHO_THANH_TOAN');
      expect(bookingHistory.trangThaiMoi).toBe('DA_THANH_TOAN');
      expect(bookingHistory.nguonThayDoi).toBe('SYSTEM');
      expect(bookingHistory.taiKhoanId).toBeNull();
      expect(bookingHistory.maThaoTac).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-1[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );

      // Verify exactly 3 ticket status histories (1 for each ticket)
      const ticketHistories = await prisma.lichSuTrangThaiVe.findMany({
        where: { veId: { in: multiTicket.veIds } },
      });
      expect(ticketHistories).toHaveLength(3);
      for (const th of ticketHistories) {
        expect(th.trangThaiCu).toBe('DA_DAT');
        expect(th.trangThaiMoi).toBe('DA_THANH_TOAN');
        expect(th.nguonThayDoi).toBe('SYSTEM');
        expect(th.taiKhoanId).toBeNull();
        // Invariant: Must share the exact same maThaoTac UUID v1
        expect(th.maThaoTac).toBe(bookingHistory.maThaoTac);
        // Invariant: Must share the exact same timestamp
        expect(th.thoiDiem.getTime()).toBe(bookingHistory.thoiDiem.getTime());
      }
    } finally {
      await multiTicket.cleanup();
    }
  });

  describe('POST /api/v1/payments (Payment Creation & Idempotency)', () => {
    it('creates payment successfully for CHO_THANH_TOAN booking', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 250000);

      currentPrincipal = customerAPrincipal;
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });

      expect(res.status).toBe(201);
      const data = res.body.data ?? res.body;
      expect(data.paymentId).toBeDefined();
      expect(data.amount).toBe(250000);
      expect(data.provider).toBe('MOMO');
      expect(data.status).toBe('PENDING');

      const paymentInDb = await prisma.thanhToan.findUnique({
        where: { thanhToanId: data.paymentId },
      });
      expect(paymentInDb).not.toBeNull();
      expect(paymentInDb?.trangThai).toBe('DANG_XU_LY');
      expect(Number(paymentInDb?.soTien)).toBe(250000);
    });

    it('returns existing pending payment for idempotent duplicate call without creating duplicate record', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 300000);

      currentPrincipal = customerAPrincipal;
      const firstRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });
      expect(firstRes.status).toBe(201);
      const firstData = firstRes.body.data ?? firstRes.body;

      const secondRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });
      expect(secondRes.status).toBe(201);
      const secondData = secondRes.body.data ?? secondRes.body;

      expect(secondData.paymentId).toBe(firstData.paymentId);

      const paymentsCount = await prisma.thanhToan.count({
        where: { donGiaoDichId: phieuDatVe.donGiaoDichId },
      });
      expect(paymentsCount).toBe(1);
    });

    it('rejects payment creation with 409 Conflict when booking is DA_HUY (discussion_r4226248027)', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'DA_HUY', 200000);

      currentPrincipal = customerAPrincipal;
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('BOOKING_CANCELLED');

      const paymentsCount = await prisma.thanhToan.count({
        where: { donGiaoDichId: phieuDatVe.donGiaoDichId },
      });
      expect(paymentsCount).toBe(0);
    });

    it('rejects DANG_XU_LY booking/order states because only CHO_THANH_TOAN is a pending lifecycle state', async () => {
      const { donGiaoDich, phieuDatVe } = await createTestBooking(
        customerAId,
        'CHO_THANH_TOAN',
        200000,
      );
      await prisma.$transaction([
        prisma.donGiaoDich.update({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
          data: { trangThai: 'DANG_XU_LY' },
        }),
        prisma.phieuDatVe.update({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
          data: { trangThai: 'DANG_XU_LY' },
        }),
      ]);

      currentPrincipal = customerAPrincipal;
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('INVALID_BOOKING_STATUS');
      await expect(
        prisma.thanhToan.count({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
        }),
      ).resolves.toBe(0);
    });

    it('rejects payment creation with 409 Conflict when booking is DA_THANH_TOAN', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'DA_THANH_TOAN', 200000);

      currentPrincipal = customerAPrincipal;
      const res = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });

      expect(res.status).toBe(409);
      expect(res.body.error).toBe('BOOKING_ALREADY_PAID');

      const paymentsCount = await prisma.thanhToan.count({
        where: { donGiaoDichId: phieuDatVe.donGiaoDichId },
      });
      expect(paymentsCount).toBe(0);
    });

    it('two concurrent requests for same booking and provider return identical paymentId and create exactly one record (Finding B concurrency)', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 400000);

      currentPrincipal = customerAPrincipal;
      const [res1, res2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' }),
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' }),
      ]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);

      const data1 = res1.body.data ?? res1.body;
      const data2 = res2.body.data ?? res2.body;

      expect(data1.paymentId).toBeDefined();
      expect(data2.paymentId).toBeDefined();
      expect(data1.paymentId).toBe(data2.paymentId);

      const allPayments = await prisma.thanhToan.findMany({
        where: { donGiaoDichId: phieuDatVe.donGiaoDichId },
      });
      expect(allPayments).toHaveLength(1);
      expect(allPayments[0].trangThai).toBe('DANG_XU_LY');
    });

    it('switching payment provider supersedes previous active payment to THAT_BAI and leaves exactly one active payment (Finding B provider switch)', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 500000);

      currentPrincipal = customerAPrincipal;
      // Step 1: Create MOMO payment
      const resMomo = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });
      expect(resMomo.status).toBe(201);
      const momoData = resMomo.body.data ?? resMomo.body;

      // Step 2: Switch to VNPAY
      const resVnpay = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'VNPAY' });
      expect(resVnpay.status).toBe(201);
      const vnpayData = resVnpay.body.data ?? resVnpay.body;

      expect(vnpayData.paymentId).not.toBe(momoData.paymentId);
      expect(vnpayData.provider).toBe('VNPAY');

      // Check DB: Momo is THAT_BAI, VNPAY is DANG_XU_LY
      const momoInDb = await prisma.thanhToan.findUnique({
        where: { thanhToanId: momoData.paymentId },
      });
      expect(momoInDb?.trangThai).toBe('THAT_BAI');

      const vnpayInDb = await prisma.thanhToan.findUnique({
        where: { thanhToanId: vnpayData.paymentId },
      });
      expect(vnpayInDb?.trangThai).toBe('DANG_XU_LY');

      // Exactly 1 active payment attempt exists
      const activeCount = await prisma.thanhToan.count({
        where: {
          donGiaoDichId: phieuDatVe.donGiaoDichId,
          trangThai: 'DANG_XU_LY',
        },
      });
      expect(activeCount).toBe(1);
    });

    it('two concurrent requests switching providers result in exactly one active payment (Finding B concurrent switch)', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 600000);

      currentPrincipal = customerAPrincipal;
      // Seed initial MOMO payment
      const initialRes = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });
      expect(initialRes.status).toBe(201);

      // Concurrent switches: one to VNPAY, one to ZALOPAY
      const [switchRes1, switchRes2] = await Promise.all([
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'VNPAY' }),
        request(app.getHttpServer())
          .post('/api/v1/payments')
          .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'ZALOPAY' }),
      ]);

      expect(switchRes1.status).toBe(201);
      expect(switchRes2.status).toBe(201);

      // Invariant: Exactly 1 active payment attempt (DANG_XU_LY) exists for this DonGiaoDich
      const activePayments = await prisma.thanhToan.findMany({
        where: {
          donGiaoDichId: phieuDatVe.donGiaoDichId,
          trangThai: 'DANG_XU_LY',
        },
      });
      expect(activePayments).toHaveLength(1);

      // All other payments for this DonGiaoDich must be THAT_BAI
      const supersededPayments = await prisma.thanhToan.findMany({
        where: {
          donGiaoDichId: phieuDatVe.donGiaoDichId,
          trangThai: { not: 'DANG_XU_LY' },
        },
      });
      expect(supersededPayments.length).toBeGreaterThanOrEqual(1);
      for (const p of supersededPayments) {
        expect(p.trangThai).toBe('THAT_BAI');
      }
    });

    it('superseded payment attempt receiving late webhook is marked THANH_CONG without duplicate settlement or duplicate history (Finding B double-charge protection)', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 700000);

      currentPrincipal = customerAPrincipal;
      // Step 1: Create MOMO payment
      const resMomo = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });
      const momoPaymentId = (resMomo.body.data ?? resMomo.body).paymentId;

      // Step 2: Switch to VNPAY (supersedes MOMO to THAT_BAI)
      const resVnpay = await request(app.getHttpServer())
        .post('/api/v1/payments')
        .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'VNPAY' });
      const vnpayPaymentId = (resVnpay.body.data ?? resVnpay.body).paymentId;

      // Step 3: VNPAY webhook arrives first and settles the booking
      const vnpayPayload = buildVnpayPayload(vnpayPaymentId, {
        vnp_Amount: '70000000', // 700,000 * 100
      });
      const vnpayWebhookRes = await request(app.getHttpServer())
        .post('/api/v1/payments/vnpay/webhook')
        .send(vnpayPayload);
      expect(vnpayWebhookRes.status).toBe(201);

      // Verify VNPAY settled the booking and created exactly 1 history
      const txAfterVnpay = await prisma.donGiaoDich.findUnique({
        where: { donGiaoDichId: phieuDatVe.donGiaoDichId },
      });
      expect(txAfterVnpay?.trangThai).toBe('DA_THANH_TOAN');

      const historiesAfterVnpay = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
        where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
      });
      expect(historiesAfterVnpay).toHaveLength(1);

      // Step 4: Late webhook arrives from MOMO for the superseded attempt
      const momoPayload = buildMomoPayload(momoPaymentId, {
        amount: 700000,
      });
      const momoWebhookRes = await request(app.getHttpServer())
        .post('/api/v1/payments/momo/webhook')
        .send(momoPayload);
      expect(momoWebhookRes.status).toBe(201);

      // Verify MOMO payment record is marked THANH_CONG (capturing financial reality)
      const momoInDb = await prisma.thanhToan.findUnique({
        where: { thanhToanId: momoPaymentId },
      });
      expect(momoInDb?.trangThai).toBe('THANH_CONG');

      // Crucial invariants:
      // 1. Transaction remains DA_THANH_TOAN (not modified again)
      const txAfterMomo = await prisma.donGiaoDich.findUnique({
        where: { donGiaoDichId: phieuDatVe.donGiaoDichId },
      });
      expect(txAfterMomo?.trangThai).toBe('DA_THANH_TOAN');

      // 2. Booking remains DA_THANH_TOAN
      const bookingAfterMomo = await prisma.phieuDatVe.findUnique({
        where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
      });
      expect(bookingAfterMomo?.trangThai).toBe('DA_THANH_TOAN');

      // 3. NO duplicate history created! Still exactly 1!
      const historiesAfterMomo = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
        where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
      });
      expect(historiesAfterMomo).toHaveLength(1);
    });

    it('rejects payment creation with 503 Service Unavailable when demo mode is disabled even if pending payment exists in DB (Finding A)', async () => {
      const { phieuDatVe } = await createTestBooking(customerAId, 'CHO_THANH_TOAN', 200000);
      // Pre-seed a pending payment in DB
      await prisma.thanhToan.create({
        data: {
          soTien: 200000,
          phuongThuc: 'MOMO',
          loaiGiaoDich: 'THANH_TOAN',
          thoiGian: new Date(),
          trangThai: 'DANG_XU_LY',
          donGiaoDichId: phieuDatVe.donGiaoDichId,
        },
      });

      const paymentsService = app.get(PaymentsService);
      const originalDemoMode = paymentsService.isDemoMode;
      (paymentsService as any).isDemoMode = false;

      try {
        currentPrincipal = customerAPrincipal;
        const res = await request(app.getHttpServer())
          .post('/api/v1/payments')
          .send({ bookingId: phieuDatVe.phieuDatVeId, provider: 'MOMO' });

        expect(res.status).toBe(503);
        expect(res.body.error).toBe('SERVICE_UNAVAILABLE');
      } finally {
        (paymentsService as any).isDemoMode = originalDemoMode;
      }
    });
  });

  describe('SePay webhook authentication, validation, settlement, and idempotency', () => {
    it('expires an overdue shipment-only order from the scheduler once and releases cargo capacity', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      try {
        await prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.order.donGiaoDichId },
          data: { ngayTao: new Date(Date.now() - 11 * 60 * 1000) },
        });

        const capacityService = app.get(CargoCapacityService);
        const capacityBefore = await capacityService.getSnapshot(
          prisma,
          fixture.tripId,
        );
        expect(capacityBefore?.capacities.HANG_NHE.used).toBe(2);

        const paymentsService = app.get(PaymentsService);
        await expect(paymentsService.expireExpiredBookings(new Date())).resolves.toBe(1);

        const [order, shipment, payment, history] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
          prisma.lichSuTrangThaiPhieuGuiHang.findMany({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_HUY');
        expect(shipment.trangThai).toBe('DA_HUY');
        expect(payment.trangThai).toBe('THAT_BAI');
        expect(history.map((entry) => entry.trangThai)).toEqual(['DA_HUY']);

        const capacityAfter = await capacityService.getSnapshot(
          prisma,
          fixture.tripId,
        );
        expect(capacityAfter?.capacities.HANG_NHE).toMatchObject({
          total: 5,
          used: 0,
          remaining: 5,
        });
        await expect(paymentsService.expireExpiredBookings(new Date())).resolves.toBe(0);
        await expect(
          prisma.lichSuTrangThaiPhieuGuiHang.count({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ).resolves.toBe(1);
      } finally {
        await fixture.cleanup();
      }
    });

    it.each([
      { label: 'before the deadline', offsetMs: -1000, paid: true },
      { label: 'exactly at the deadline', offsetMs: 0, paid: false },
      { label: 'after the deadline', offsetMs: 1000, paid: false },
    ])(
      'uses the signed SePay transaction time when it is $label',
      async ({ offsetMs, paid }) => {
        const fixture = await createShipmentOnlyPayment(customerAId);
        const transactionId = BigInt(
          `0x${randomUUID().replaceAll('-', '')}`,
        ).toString();
        const payload = {
          id: transactionId,
          gateway: 'STB',
          accountNumber: sepayTestAccountNumber,
          code: fixture.order.maDonGiaoDich,
          transferType: 'in',
          transferAmount: fixture.amount,
          currency: 'VND',
          content: fixture.order.maDonGiaoDich,
        };

        try {
          await prisma.donGiaoDich.update({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
            data: {
              ngayTao: new Date(
                Math.floor((Date.now() - 20 * 60 * 1000) / 1000) * 1000,
              ),
            },
          });
          const storedOrder = await prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
            select: { ngayTao: true },
          });
          const deadline = new Date(storedOrder.ngayTao.getTime() + 10 * 60 * 1000);
          const transactionDate = formatSepayVietnamTime(
            new Date(deadline.getTime() + offsetMs),
          );
          const response = await postSignedSepayEvent({
            ...payload,
            transactionDate,
          });
          expect(response.status).toBe(200);

          const [order, shipment, payment, history] = await Promise.all([
            prisma.donGiaoDich.findUniqueOrThrow({
              where: { donGiaoDichId: fixture.order.donGiaoDichId },
            }),
            prisma.phieuGuiHang.findUniqueOrThrow({
              where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
            }),
            prisma.thanhToan.findUniqueOrThrow({
              where: { thanhToanId: fixture.payment.thanhToanId },
            }),
            prisma.lichSuTrangThaiPhieuGuiHang.findMany({
              where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
            }),
          ]);
          expect(order.trangThai).toBe(paid ? 'DA_THANH_TOAN' : 'DA_HUY');
          expect(shipment.trangThai).toBe(paid ? 'MOI_TAO' : 'DA_HUY');
          expect(payment).toMatchObject({
            trangThai: 'THANH_CONG',
            maGiaoDichSePay: transactionId,
          });
          expect(history.map((entry) => entry.trangThai)).toEqual(
            paid ? [] : ['DA_HUY'],
          );

          const lookup = await request(app.getHttpServer())
            .post('/api/v1/shipments/lookup')
            .send({
              waybillCode: fixture.shipment.maVanDon,
              phoneNumber: fixture.senderPhone,
            });
          expect(lookup.body.data ?? lookup.body).toMatchObject({
            requiresReconciliation: !paid,
            orderStatus: paid ? 'DA_THANH_TOAN' : 'DA_HUY',
          });
        } finally {
          await fixture.cleanup();
        }
      },
    );

    it('rejects a signed SePay event with no transaction time without changing the order', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();

      try {
        const response = await postSignedSepayEvent(
          {
            id: transactionId,
            gateway: 'STB',
            accountNumber: sepayTestAccountNumber,
            code: fixture.order.maDonGiaoDich,
            transferType: 'in',
            transferAmount: fixture.amount,
            currency: 'VND',
            content: fixture.order.maDonGiaoDich,
          },
          { includeTransactionDate: false },
        );

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('SEPAY_TRANSACTION_DATE_INVALID');
        const [order, shipment, payment] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
        ]);
        expect(order.trangThai).toBe('CHO_THANH_TOAN');
        expect(shipment.trangThai).toBe('MOI_TAO');
        expect(payment).toMatchObject({
          trangThai: 'DANG_XU_LY',
          maGiaoDichSePay: null,
        });
      } finally {
        await fixture.cleanup();
      }
    });

    it('expires a booking when SePay transaction time is after the deadline even if the server clock is still before it', async () => {
      const fixture = await createMultiTicketPayment(customerAId, 1, 'SEPAY');
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();

      try {
        const createdAt = new Date(
          Math.floor((Date.now() - 60 * 1000) / 1000) * 1000,
        );
        await prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.donGiaoDich.donGiaoDichId },
          data: { ngayTao: createdAt },
        });
        await prisma.gheChuyenXe.updateMany({
          where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
          data: { trangThai: 'DA_DAT' },
        });

        const deadline = new Date(createdAt.getTime() + 10 * 60 * 1000);
        expect(Date.now()).toBeLessThan(deadline.getTime());
        const response = await postSignedSepayEvent({
          id: transactionId,
          gateway: 'STB',
          transactionDate: formatSepayVietnamTime(
            new Date(deadline.getTime() + 1000),
          ),
          accountNumber: sepayTestAccountNumber,
          code: fixture.donGiaoDich.maDonGiaoDich,
          transferType: 'in',
          transferAmount: fixture.totalAmount,
          currency: 'VND',
          content: fixture.donGiaoDich.maDonGiaoDich,
        });

        expect(response.status).toBe(200);
        const [order, booking, tickets, payment, bookingHistory, seats] =
          await Promise.all([
            prisma.donGiaoDich.findUniqueOrThrow({
              where: { donGiaoDichId: fixture.donGiaoDich.donGiaoDichId },
            }),
            prisma.phieuDatVe.findUniqueOrThrow({
              where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
            }),
            prisma.ve.findMany({
              where: { veId: { in: fixture.veIds } },
              orderBy: { veId: 'asc' },
            }),
            prisma.thanhToan.findUniqueOrThrow({
              where: { thanhToanId: fixture.thanhToan.thanhToanId },
            }),
            prisma.lichSuTrangThaiPhieuDatVe.findMany({
              where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
            }),
            prisma.gheChuyenXe.findMany({
              where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
            }),
          ]);

        expect(order.trangThai).toBe('DA_HUY');
        expect(booking.trangThai).toBe('DA_HUY');
        expect(tickets.map((ticket) => ticket.trangThai)).toEqual(['DA_HUY']);
        expect(seats.map((seat) => seat.trangThai)).toEqual(['TRONG']);
        expect(payment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: transactionId,
        });
        expect(
          bookingHistory.map((entry) => [entry.trangThaiCu, entry.trangThaiMoi]),
        ).toEqual([['CHO_THANH_TOAN', 'DA_HUY']]);

        const paymentStatus = await app
          .get(PaymentsService)
          .getPaymentStatus(fixture.thanhToan.thanhToanId, customerAPrincipal);
        expect(paymentStatus).toMatchObject({
          status: 'SUCCESS',
          paymentStatus: 'THANH_CONG',
          orderStatus: 'DA_HUY',
          bookingStatus: 'DA_HUY',
          requiresReconciliation: true,
        });
      } finally {
        await fixture.cleanup();
      }
    });

    it('expires a shipment when SePay transaction time is after the deadline even if the server clock is still before it', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();

      try {
        const createdAt = new Date(
          Math.floor((Date.now() - 60 * 1000) / 1000) * 1000,
        );
        await prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.order.donGiaoDichId },
          data: { ngayTao: createdAt },
        });
        const deadline = new Date(createdAt.getTime() + 10 * 60 * 1000);
        expect(Date.now()).toBeLessThan(deadline.getTime());

        const capacityService = app.get(CargoCapacityService);
        const capacityBefore = await capacityService.getSnapshot(
          prisma,
          fixture.tripId,
        );
        expect(capacityBefore?.capacities.HANG_NHE.used).toBe(2);

        const response = await postSignedSepayEvent({
          id: transactionId,
          gateway: 'STB',
          transactionDate: formatSepayVietnamTime(
            new Date(deadline.getTime() + 1000),
          ),
          accountNumber: sepayTestAccountNumber,
          code: fixture.order.maDonGiaoDich,
          transferType: 'in',
          transferAmount: fixture.amount,
          currency: 'VND',
          content: fixture.order.maDonGiaoDich,
        });
        expect(response.status).toBe(200);

        const [order, shipment, payment, history] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
          prisma.lichSuTrangThaiPhieuGuiHang.findMany({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_HUY');
        expect(shipment.trangThai).toBe('DA_HUY');
        expect(payment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: transactionId,
        });
        expect(history.map((entry) => entry.trangThai)).toEqual(['DA_HUY']);
        await expect(
          app
            .get(PaymentsService)
            .getPaymentStatus(fixture.payment.thanhToanId, customerAPrincipal),
        ).resolves.toMatchObject({
          status: 'SUCCESS',
          paymentStatus: 'THANH_CONG',
          orderStatus: 'DA_HUY',
          shipmentStatus: 'DA_HUY',
          requiresReconciliation: true,
        });

        const capacityAfter = await capacityService.getSnapshot(
          prisma,
          fixture.tripId,
        );
        expect(capacityAfter?.capacities.HANG_NHE).toMatchObject({
          total: 5,
          used: 0,
          remaining: 5,
        });
      } finally {
        await fixture.cleanup();
      }
    });

    it('keeps a scheduler-cancelled shipment cancelled when delayed SePay data says the bank transfer was on time', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();

      try {
        await prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.order.donGiaoDichId },
          data: {
            ngayTao: new Date(
              Math.floor((Date.now() - 20 * 60 * 1000) / 1000) * 1000,
            ),
          },
        });
        const expiredOrder = await prisma.donGiaoDich.findUniqueOrThrow({
          where: { donGiaoDichId: fixture.order.donGiaoDichId },
          select: { ngayTao: true },
        });
        const deadline = new Date(
          expiredOrder.ngayTao.getTime() + 10 * 60 * 1000,
        );

        await expect(
          app.get(PaymentsService).expireExpiredBookings(new Date()),
        ).resolves.toBe(1);

        const response = await postSignedSepayEvent({
          id: transactionId,
          gateway: 'STB',
          transactionDate: formatSepayVietnamTime(
            new Date(deadline.getTime() - 1000),
          ),
          accountNumber: sepayTestAccountNumber,
          code: fixture.order.maDonGiaoDich,
          transferType: 'in',
          transferAmount: fixture.amount,
          currency: 'VND',
          content: fixture.order.maDonGiaoDich,
        });
        expect(response.status).toBe(200);

        const [order, shipment, payment, history] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
          prisma.lichSuTrangThaiPhieuGuiHang.findMany({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_HUY');
        expect(shipment.trangThai).toBe('DA_HUY');
        expect(payment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: transactionId,
        });
        expect(history.map((entry) => entry.trangThai)).toEqual(['DA_HUY']);

        const lookup = await request(app.getHttpServer())
          .post('/api/v1/shipments/lookup')
          .send({
            waybillCode: fixture.shipment.maVanDon,
            phoneNumber: fixture.senderPhone,
          });
        expect(lookup.body.data ?? lookup.body).toMatchObject({
          orderStatus: 'DA_HUY',
          status: 'DA_HUY',
          paymentStatus: 'THANH_CONG',
          requiresReconciliation: true,
        });
      } finally {
        await fixture.cleanup();
      }
    });

    it('cancels an expired shipment before recording a signed late SePay payment when the scheduler has not run', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();
      const payload = {
        id: transactionId,
        gateway: 'STB',
        transactionDate: formatSepayVietnamTime(new Date()),
        accountNumber: sepayTestAccountNumber,
        code: fixture.order.maDonGiaoDich,
        transferType: 'in',
        transferAmount: fixture.amount,
        currency: 'VND',
        content: fixture.order.maDonGiaoDich,
      };

      try {
        await prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.order.donGiaoDichId },
          data: { ngayTao: new Date(Date.now() - 11 * 60 * 1000) },
        });

        const response = await postSignedSepayEvent(payload);
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ success: true });

        const [order, shipment, payment, history] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
          prisma.lichSuTrangThaiPhieuGuiHang.findMany({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_HUY');
        expect(shipment.trangThai).toBe('DA_HUY');
        expect(payment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: transactionId,
        });
        expect(history.map((entry) => entry.trangThai)).toEqual(['DA_HUY']);

        const lookup = await request(app.getHttpServer())
          .post('/api/v1/shipments/lookup')
          .send({
            waybillCode: fixture.shipment.maVanDon,
            phoneNumber: fixture.senderPhone,
          });
        expect(lookup.status).toBe(200);
        expect(lookup.body.data ?? lookup.body).toMatchObject({
          orderStatus: 'DA_HUY',
          status: 'DA_HUY',
          paymentStatus: 'THANH_CONG',
          requiresReconciliation: true,
        });

        currentPrincipal = customerAPrincipal;
        const paymentStatus = await request(app.getHttpServer()).get(
          `/api/v1/payments/${fixture.payment.thanhToanId}/status`,
        );
        currentPrincipal = null;
        expect(paymentStatus.status).toBe(200);
        expect(paymentStatus.body.data ?? paymentStatus.body).toMatchObject({
          orderStatus: 'DA_HUY',
          shipmentStatus: 'DA_HUY',
          paymentStatus: 'THANH_CONG',
          requiresReconciliation: true,
        });

        const replay = await postSignedSepayEvent(payload);
        expect(replay.status).toBe(200);
        await expect(
          prisma.lichSuTrangThaiPhieuGuiHang.count({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ).resolves.toBe(1);
        const capacity = await app
          .get(CargoCapacityService)
          .getSnapshot(prisma, fixture.tripId);
        expect(capacity?.capacities.HANG_NHE.used).toBe(0);
      } finally {
        await fixture.cleanup();
      }
    });

    it('serializes the signed late shipment callback against expiry with one cancellation history', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();
      const payload = {
        id: transactionId,
        gateway: 'STB',
        transactionDate: formatSepayVietnamTime(new Date()),
        accountNumber: sepayTestAccountNumber,
        code: fixture.order.maDonGiaoDich,
        transferType: 'in',
        transferAmount: fixture.amount,
        currency: 'VND',
        content: fixture.order.maDonGiaoDich,
      };

      try {
        await prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.order.donGiaoDichId },
          data: { ngayTao: new Date(Date.now() - 11 * 60 * 1000) },
        });

        const paymentsService = app.get(PaymentsService);
        const [expiredCount, callback] = await Promise.all([
          paymentsService.expireExpiredBookings(new Date()),
          postSignedSepayEvent(payload),
        ]);
        expect([0, 1]).toContain(expiredCount);
        expect(callback.status).toBe(200);

        const [order, shipment, payment, history] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
          prisma.lichSuTrangThaiPhieuGuiHang.findMany({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_HUY');
        expect(shipment.trangThai).toBe('DA_HUY');
        expect(payment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: transactionId,
        });
        expect(history.map((entry) => entry.trangThai)).toEqual(['DA_HUY']);
        const capacity = await app
          .get(CargoCapacityService)
          .getSnapshot(prisma, fixture.tripId);
        expect(capacity?.capacities.HANG_NHE.used).toBe(0);
      } finally {
        await fixture.cleanup();
      }
    });

    it('rejects a different SePay transaction ID for a paid shipment order that was later cancelled', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const existingTransactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();
      const unexpectedTransactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();

      try {
        await prisma.$transaction([
          prisma.donGiaoDich.update({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
            data: { trangThai: 'DA_HUY' },
          }),
          prisma.phieuGuiHang.update({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
            data: { trangThai: 'DA_HUY' },
          }),
          prisma.thanhToan.update({
            where: { thanhToanId: fixture.payment.thanhToanId },
            data: {
              trangThai: 'THANH_CONG',
              maGiaoDichSePay: existingTransactionId,
            },
          }),
        ]);

        const response = await postSignedSepayEvent({
          id: unexpectedTransactionId,
          gateway: 'STB',
          accountNumber: sepayTestAccountNumber,
          code: fixture.order.maDonGiaoDich,
          transferType: 'in',
          transferAmount: fixture.amount,
          currency: 'VND',
          content: fixture.order.maDonGiaoDich,
        });
        expect(response.status).toBe(409);
        expect(response.body.error).toBe('SEPAY_TRANSACTION_ALREADY_PROCESSED');

        const [order, shipment, payment] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_HUY');
        expect(shipment.trangThai).toBe('DA_HUY');
        expect(payment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: existingTransactionId,
        });
      } finally {
        await fixture.cleanup();
      }
    });

    it('returns shipment payment status only to its owning Customer', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      try {
        currentPrincipal = customerAPrincipal;
        const ownerResponse = await request(app.getHttpServer()).get(
          `/api/v1/payments/${fixture.payment.thanhToanId}/status`,
        );
        expect(ownerResponse.status).toBe(200);
        const ownerData = ownerResponse.body.data ?? ownerResponse.body;
        expect(ownerData).toMatchObject({
          paymentId: fixture.payment.thanhToanId,
          orderId: fixture.order.donGiaoDichId,
          orderCode: fixture.order.maDonGiaoDich,
          shipmentId: fixture.shipment.phieuGuiHangId,
          shipmentStatus: 'MOI_TAO',
          orderStatus: 'CHO_THANH_TOAN',
          amount: fixture.amount,
          status: 'PENDING',
        });
        expect(ownerData.paymentExpiresAt).toBe(
          new Date(fixture.order.ngayTao.getTime() + 10 * 60_000).toISOString(),
        );

        currentPrincipal = customerBPrincipal;
        const otherCustomerResponse = await request(app.getHttpServer()).get(
          `/api/v1/payments/${fixture.payment.thanhToanId}/status`,
        );
        expect(otherCustomerResponse.status).toBe(403);
        expect(otherCustomerResponse.body.error).toBe('FORBIDDEN');
      } finally {
        currentPrincipal = null;
        await fixture.cleanup();
      }
    });

    it('lets a guest verify shipment payment details only with waybill and sender phone', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      try {
        currentPrincipal = null;
        const response = await request(app.getHttpServer())
          .post('/api/v1/shipments/lookup')
          .send({
            waybillCode: fixture.shipment.maVanDon,
            phoneNumber: fixture.senderPhone,
          });

        expect(response.status).toBe(200);
        const data = response.body.data ?? response.body;
        expect(data).toMatchObject({
          waybillCode: fixture.shipment.maVanDon,
          orderCode: fixture.order.maDonGiaoDich,
          amount: fixture.amount,
          orderStatus: 'CHO_THANH_TOAN',
          paymentStatus: 'DANG_XU_LY',
        });
        expect(data.paymentExpiresAt).toBe(
          new Date(fixture.order.ngayTao.getTime() + 10 * 60_000).toISOString(),
        );
        expect(data).not.toHaveProperty('paymentId');

        const invalidPhoneResponse = await request(app.getHttpServer())
          .post('/api/v1/shipments/lookup')
          .send({
            waybillCode: fixture.shipment.maVanDon,
            phoneNumber: '+84951111111',
          });
        expect(invalidPhoneResponse.status).toBe(404);
        expect(invalidPhoneResponse.body.error).toBe('SHIPMENT_NOT_FOUND');
      } finally {
        currentPrincipal = null;
        await fixture.cleanup();
      }
    });

    it('settles a signed SePay callback for an order containing only a shipment', async () => {
      const fixture = await createShipmentOnlyPayment(customerAId);
      const transactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();
      const payload = {
        id: transactionId,
        gateway: 'STB',
        transactionDate: formatSepayVietnamTime(new Date()),
        accountNumber: sepayTestAccountNumber,
        code: fixture.order.maDonGiaoDich,
        transferType: 'in',
        transferAmount: fixture.amount,
        currency: 'VND',
        content: fixture.order.maDonGiaoDich,
      };
      const sendSignedEvent = async () => {
        const rawBody = JSON.stringify(payload);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = `sha256=${createHmac('sha256', sepayTestSecret)
          .update(`${timestamp}.`)
          .update(rawBody)
          .digest('hex')}`;
        return request(app.getHttpServer())
          .post('/api/v1/payments/sepay-webhook')
          .set('Content-Type', 'application/json')
          .set('X-SePay-Timestamp', timestamp)
          .set('X-SePay-Signature', signature)
          .send(rawBody);
      };

      try {
        const firstDelivery = await sendSignedEvent();
        expect(firstDelivery.status).toBe(200);
        expect(firstDelivery.body).toEqual({ success: true });

        const [order, shipment, payment] = await Promise.all([
          prisma.donGiaoDich.findUniqueOrThrow({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
          prisma.phieuGuiHang.findUniqueOrThrow({
            where: { phieuGuiHangId: fixture.shipment.phieuGuiHangId },
          }),
          prisma.thanhToan.findUniqueOrThrow({
            where: { thanhToanId: fixture.payment.thanhToanId },
          }),
        ]);
        expect(order.trangThai).toBe('DA_THANH_TOAN');
        expect(shipment.trangThai).toBe('MOI_TAO');
        expect(payment.trangThai).toBe('THANH_CONG');
        expect(payment.maGiaoDichSePay).toBe(transactionId);
        await expect(
          prisma.thanhToan.count({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
        ).resolves.toBe(1);

        const replay = await sendSignedEvent();
        expect(replay.status).toBe(200);
        await expect(
          prisma.thanhToan.count({
            where: { donGiaoDichId: fixture.order.donGiaoDichId },
          }),
        ).resolves.toBe(1);
      } finally {
        await fixture.cleanup();
      }
    });

    it('allows multiple null SePay IDs while rejecting duplicate transaction IDs', async () => {
      const first = await createTestPayment(customerAId, 'SEPAY');
      const second = await createTestPayment(customerAId, 'SEPAY');
      const sepayTransactionId = BigInt(
        `0x${randomUUID().replaceAll('-', '')}`,
      ).toString();

      const nullIdRows = await prisma.$queryRaw<Array<{ rowCount: bigint }>>`
        SELECT COUNT(*) AS rowCount
        FROM ThanhToan
        WHERE thanhToanId IN (
          ${first.thanhToan.thanhToanId},
          ${second.thanhToan.thanhToanId}
        )
          AND maGiaoDichSePay IS NULL
      `;
      expect(Number(nullIdRows[0]?.rowCount)).toBe(2);

      await prisma.$executeRaw`
        UPDATE ThanhToan
        SET maGiaoDichSePay = ${sepayTransactionId}
        WHERE thanhToanId = ${first.thanhToan.thanhToanId}
      `;

      await expect(
        prisma.$executeRaw`
          UPDATE ThanhToan
          SET maGiaoDichSePay = ${sepayTransactionId}
          WHERE thanhToanId = ${second.thanhToan.thanhToanId}
        `,
      ).rejects.toThrow();

      const persistedRows = await prisma.$queryRaw<
        Array<{ thanhToanId: number }>
      >`
        SELECT thanhToanId
        FROM ThanhToan
        WHERE maGiaoDichSePay = ${sepayTransactionId}
      `;
      expect(persistedRows.map((row) => row.thanhToanId)).toEqual([
        first.thanhToan.thanhToanId,
      ]);
    });

    it('authenticates, settles one exact SePay order once, and stores its transaction ID', async () => {
      const fixture = await createMultiTicketPayment(customerAId, 3, 'SEPAY');
      const { donGiaoDich, phieuDatVe, thanhToan } = fixture;
      const transactionId = Date.now() + Math.floor(Math.random() * 10000);
      const webhookPayload = {
        id: transactionId,
        gateway: 'STB',
        transactionDate: formatSepayVietnamTime(new Date()),
        accountNumber: sepayTestAccountNumber,
        code: donGiaoDich.maDonGiaoDich,
        transferType: 'in',
        transferAmount: fixture.totalAmount,
        content: `${donGiaoDich.maDonGiaoDich} chuyen tien`,
      };

      const sendSignedEvent = async (payload = webhookPayload) => {
        const rawBody = JSON.stringify(payload, null, 2);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = `sha256=${createHmac('sha256', sepayTestSecret)
          .update(`${timestamp}.`)
          .update(rawBody)
          .digest('hex')}`;
        return request(app.getHttpServer())
          .post('/api/v1/payments/sepay-webhook')
          .set('Content-Type', 'application/json')
          .set('X-SePay-Timestamp', timestamp)
          .set('X-SePay-Signature', signature)
          .send(rawBody);
      };

      try {
        // Booking creation has already committed these seats as DA_DAT; payment
        // settlement must preserve that state rather than release or re-hold them.
        await prisma.gheChuyenXe.updateMany({
          where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
          data: { trangThai: 'DA_DAT' },
        });
        const [firstDelivery, concurrentRetry] = await Promise.all([
          sendSignedEvent(),
          sendSignedEvent(),
        ]);
        expect(firstDelivery.status).toBe(200);
        expect(firstDelivery.body).toEqual({ success: true });
        expect(concurrentRetry.status).toBe(200);
        expect(concurrentRetry.body).toEqual({ success: true });

        const updatedBooking = await prisma.phieuDatVe.findUnique({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
          include: { donGiaoDich: true },
        });
        expect(updatedBooking?.trangThai).toBe('DA_THANH_TOAN');
        expect(updatedBooking?.donGiaoDich.trangThai).toBe('DA_THANH_TOAN');
        const settledPayment = await prisma.thanhToan.findUniqueOrThrow({
          where: { thanhToanId: thanhToan.thanhToanId },
        });
        expect(settledPayment.trangThai).toBe('THANH_CONG');
        expect(settledPayment.maGiaoDichSePay).toBe(String(transactionId));

        const settledTickets = await prisma.ve.findMany({
          where: { veId: { in: fixture.veIds } },
        });
        expect(settledTickets).toHaveLength(3);
        expect(settledTickets.map((ticket) => ticket.trangThai)).toEqual([
          'DA_THANH_TOAN',
          'DA_THANH_TOAN',
          'DA_THANH_TOAN',
        ]);
        const settledSeats = await prisma.gheChuyenXe.findMany({
          where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
          orderBy: { gheChuyenXeId: 'asc' },
          select: { gheChuyenXeId: true, trangThai: true },
        });
        expect(settledSeats).toHaveLength(3);
        expect(settledSeats.map((seat) => seat.trangThai)).toEqual([
          'DA_DAT',
          'DA_DAT',
          'DA_DAT',
        ]);
        await expect(
          prisma.thanhToan.count({
            where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.lichSuTrangThaiPhieuDatVe.count({
            where: {
              phieuDatVeId: phieuDatVe.phieuDatVeId,
              trangThaiMoi: 'DA_THANH_TOAN',
            },
          }),
        ).resolves.toBe(1);
        await expect(
          prisma.lichSuTrangThaiVe.count({
            where: { veId: { in: fixture.veIds }, trangThaiMoi: 'DA_THANH_TOAN' },
          }),
        ).resolves.toBe(3);

        const replay = await sendSignedEvent();
        expect(replay.status).toBe(200);
        expect(replay.body).toEqual({ success: true });

        const wrongAccountReplay = await sendSignedEvent({
          ...webhookPayload,
          accountNumber: '0099999999',
        });
        expect(wrongAccountReplay.status).toBe(400);
        expect(wrongAccountReplay.body.error).toBe('SEPAY_ACCOUNT_MISMATCH');

        const differentTransactionForSamePayment = await sendSignedEvent({
          ...webhookPayload,
          id: transactionId + 1,
        });
        expect(differentTransactionForSamePayment.status).toBe(409);
      } finally {
        await fixture.cleanup();
      }
    });

    it.each([
      {
        label: 'a different account',
        accountNumber: '0099999999',
        includeAccountNumber: true,
        expectedError: 'SEPAY_ACCOUNT_MISMATCH',
      },
      {
        label: 'a missing accountNumber',
        accountNumber: undefined,
        includeAccountNumber: false,
        expectedError: 'SEPAY_ACCOUNT_NUMBER_INVALID',
      },
    ])('rejects a signed event with $label without changing booking or payment records', async ({ accountNumber, includeAccountNumber, expectedError }) => {
      const { donGiaoDich, phieuDatVe, thanhToan } = await createTestPayment(
        customerAId,
        'SEPAY',
      );
      const transactionId = Date.now() + Math.floor(Math.random() * 10000);
      const basePayload: Record<string, unknown> = {
        id: transactionId,
        gateway: 'STB',
        transactionDate: formatSepayVietnamTime(new Date()),
        accountNumber: sepayTestAccountNumber,
        code: donGiaoDich.maDonGiaoDich,
        transferType: 'in',
        transferAmount: 200000,
        content: `${donGiaoDich.maDonGiaoDich} chuyen tien`,
      };
      if (includeAccountNumber) {
        basePayload.accountNumber = accountNumber;
      } else {
        delete basePayload.accountNumber;
      }
      const payload = basePayload;
      const rawBody = JSON.stringify(payload);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `sha256=${createHmac('sha256', sepayTestSecret)
        .update(`${timestamp}.`)
        .update(rawBody)
        .digest('hex')}`;
      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/sepay-webhook')
        .set('Content-Type', 'application/json')
        .set('X-SePay-Timestamp', timestamp)
        .set('X-SePay-Signature', signature)
        .send(rawBody);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(expectedError);

      const [unchangedOrder, unchangedBooking, unchangedPayment] = await Promise.all([
        prisma.donGiaoDich.findUniqueOrThrow({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
        }),
        prisma.phieuDatVe.findUniqueOrThrow({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
        }),
        prisma.thanhToan.findUniqueOrThrow({
          where: { thanhToanId: thanhToan.thanhToanId },
        }),
      ]);
      expect(unchangedOrder.trangThai).toBe('CHO_THANH_TOAN');
      expect(unchangedBooking.trangThai).toBe('CHO_THANH_TOAN');
      expect(unchangedPayment.trangThai).toBe('DANG_XU_LY');
      expect(unchangedPayment.maGiaoDichSePay).toBeNull();
      await expect(
        prisma.ve.count({ where: { phieuDatVeId: phieuDatVe.phieuDatVeId } }),
      ).resolves.toBe(0);
      await expect(
        prisma.lichSuTrangThaiPhieuDatVe.count({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
        }),
      ).resolves.toBe(0);
    });

    it('rejects authenticated SePay events with the wrong reference, direction, currency, or amount', async () => {
      const { donGiaoDich, phieuDatVe, thanhToan } = await createTestPayment(
        customerAId,
        'SEPAY',
      );
      const eventIdStart = Date.now() + Math.floor(Math.random() * 10000);
      const invalidPayloads = [
        {
          id: eventIdStart,
          accountNumber: sepayTestAccountNumber,
          code: `WRONG-${donGiaoDich.maDonGiaoDich}`,
          content: `WRONG-${donGiaoDich.maDonGiaoDich}`,
          transferType: 'in',
          transferAmount: 200000,
          expectedStatus: 404,
        },
        {
          id: eventIdStart + 1,
          accountNumber: sepayTestAccountNumber,
          code: donGiaoDich.maDonGiaoDich,
          content: donGiaoDich.maDonGiaoDich,
          transferType: 'out',
          transferAmount: 200000,
          expectedStatus: 400,
        },
        {
          id: eventIdStart + 2,
          accountNumber: sepayTestAccountNumber,
          code: donGiaoDich.maDonGiaoDich,
          content: donGiaoDich.maDonGiaoDich,
          transferType: 'in',
          currency: 'USD',
          transferAmount: 200000,
          expectedStatus: 400,
        },
        {
          id: eventIdStart + 3,
          accountNumber: sepayTestAccountNumber,
          code: donGiaoDich.maDonGiaoDich,
          content: donGiaoDich.maDonGiaoDich,
          transferType: 'in',
          transferAmount: 199999,
          expectedStatus: 400,
        },
        {
          id: eventIdStart + 4,
          accountNumber: sepayTestAccountNumber,
          code: donGiaoDich.maDonGiaoDich,
          content: donGiaoDich.maDonGiaoDich,
          transferType: 'in',
          transferAmount: 0,
          expectedStatus: 400,
        },
      ];

      for (const payload of invalidPayloads) {
        const { expectedStatus, ...webhookPayload } = payload;
        const rawBody = JSON.stringify({
          ...webhookPayload,
          transactionDate: formatSepayVietnamTime(new Date()),
        });
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = `sha256=${createHmac('sha256', sepayTestSecret)
          .update(`${timestamp}.`)
          .update(rawBody)
          .digest('hex')}`;
        const response = await request(app.getHttpServer())
          .post('/api/v1/payments/sepay-webhook')
          .set('Content-Type', 'application/json')
          .set('X-SePay-Timestamp', timestamp)
          .set('X-SePay-Signature', signature)
          .send(rawBody);
        expect(response.status).toBe(expectedStatus);
      }

      const unchanged = await prisma.phieuDatVe.findUniqueOrThrow({
        where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
        include: { donGiaoDich: true },
      });
      expect(unchanged.trangThai).toBe('CHO_THANH_TOAN');
      expect(unchanged.donGiaoDich.trangThai).toBe('CHO_THANH_TOAN');
      const unchangedPayment = await prisma.thanhToan.findUniqueOrThrow({
        where: { thanhToanId: thanhToan.thanhToanId },
      });
      expect(unchangedPayment.trangThai).toBe('DANG_XU_LY');
      expect(unchangedPayment.maGiaoDichSePay).toBeNull();
    });

    it('rejects missing, forged, and expired SePay signatures without settling', async () => {
      const suffix = randomUUID().slice(0, 8).toUpperCase();
      const maDonGiaoDich = `VXG-GD-20261013-${suffix}`;
      const donGiaoDich = await prisma.donGiaoDich.create({
        data: {
          maDonGiaoDich,
          ngayTao: new Date(),
          tongTien: 150000,
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: 'Sepay Customer',
          soDienThoaiKhachHang: '+84950000001',
          khachHangId: customerAId,
          nhaXeId: busCompanyId,
          phieuDatVe: {
            create: {
              maPhieuDatVe: `VXG-PDV-20261013-${suffix}`,
              ngayDat: new Date(),
              soLuongVeBanDau: 1,
              tongTienBanDau: 150000,
              trangThai: 'CHO_THANH_TOAN',
            },
          },
        },
        include: { phieuDatVe: true },
      });

      const rawBody = JSON.stringify({
        id: 99992,
        transferAmount: 150000,
        code: maDonGiaoDich,
        content: `VEXGO ${maDonGiaoDich}`,
      });
      const timestamp = String(Math.floor(Date.now() / 1000));

      const missingSignature = await request(app.getHttpServer())
        .post('/api/v1/payments/sepay-webhook')
        .set('X-SePay-Timestamp', timestamp)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      const forgedSignature = await request(app.getHttpServer())
        .post('/api/v1/payments/sepay-webhook')
        .set('X-SePay-Timestamp', timestamp)
        .set('X-SePay-Signature', `sha256=${'a'.repeat(64)}`)
        .set('Content-Type', 'application/json')
        .send(rawBody);
      const expiredTimestamp = String(Number(timestamp) - 301);
      const expiredSignature = `sha256=${createHmac('sha256', sepayTestSecret)
        .update(`${expiredTimestamp}.`)
        .update(rawBody)
        .digest('hex')}`;
      const expiredRequest = await request(app.getHttpServer())
        .post('/api/v1/payments/sepay-webhook')
        .set('X-SePay-Timestamp', expiredTimestamp)
        .set('X-SePay-Signature', expiredSignature)
        .set('Content-Type', 'application/json')
        .send(rawBody);

      expect(missingSignature.status).toBe(401);
      expect(forgedSignature.status).toBe(401);
      expect(expiredRequest.status).toBe(401);
      const updatedBooking = await prisma.phieuDatVe.findUnique({
        where: { phieuDatVeId: donGiaoDich.phieuDatVe!.phieuDatVeId },
        include: { donGiaoDich: true },
      });
      expect(updatedBooking?.trangThai).toBe('CHO_THANH_TOAN');
      expect(updatedBooking?.donGiaoDich.trangThai).toBe('CHO_THANH_TOAN');
      await expect(
        prisma.thanhToan.count({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
        }),
      ).resolves.toBe(0);
    });
  });

  describe('POST /api/v1/bookings/:bookingId/confirm-payment', () => {
    it('does not expose the legacy public payment mutation', async () => {
      const suffix = randomUUID().slice(0, 8).toUpperCase();
      const donGiaoDich = await prisma.donGiaoDich.create({
        data: {
          maDonGiaoDich: `VXG-GD-20261013-${suffix}`,
          ngayTao: new Date(),
          tongTien: 150000,
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: 'Payment Test Customer',
          soDienThoaiKhachHang: '+84950000001',
          khachHangId: customerAId,
          nhaXeId: busCompanyId,
          phieuDatVe: {
            create: {
              maPhieuDatVe: `VXG-PDV-20261013-${suffix}`,
              ngayDat: new Date(),
              soLuongVeBanDau: 1,
              tongTienBanDau: 150000,
              trangThai: 'CHO_THANH_TOAN',
            },
          },
        },
        include: { phieuDatVe: true },
      });

      const res = await request(app.getHttpServer())
        .post(
          `/api/v1/bookings/${donGiaoDich.phieuDatVe!.phieuDatVeId}/confirm-payment`,
        )
        .send({ paymentMethod: 'CHUYEN_KHOAN' });

      expect(res.status).toBe(404);
      const currentBooking = await prisma.phieuDatVe.findUnique({
        where: { phieuDatVeId: donGiaoDich.phieuDatVe!.phieuDatVeId },
        include: { donGiaoDich: true },
      });
      expect(currentBooking?.trangThai).toBe('CHO_THANH_TOAN');
      expect(currentBooking?.donGiaoDich.trangThai).toBe('CHO_THANH_TOAN');
      await expect(
        prisma.thanhToan.count({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
        }),
      ).resolves.toBe(0);
    });
  });

  describe('payment settlement atomicity', () => {
    it('rejects settlement when booking and order are DANG_XU_LY without changing any state', async () => {
      const fixture = await createTestPayment(customerAId, 'MOMO');
      await prisma.$transaction([
        prisma.donGiaoDich.update({
          where: { donGiaoDichId: fixture.donGiaoDich.donGiaoDichId },
          data: { trangThai: 'DANG_XU_LY' },
        }),
        prisma.phieuDatVe.update({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
          data: { trangThai: 'DANG_XU_LY' },
        }),
      ]);

      const response = await request(app.getHttpServer())
        .post('/api/v1/payments/momo/webhook')
        .send(buildMomoPayload(fixture.thanhToan.thanhToanId, { amount: 200000 }));

      expect(response.status).toBe(409);
      expect(response.body.error).toBe('PAYMENT_ORDER_STATE_CHANGED');
      const [currentOrder, currentBooking, currentAttempt] = await Promise.all([
        prisma.donGiaoDich.findUniqueOrThrow({
          where: { donGiaoDichId: fixture.donGiaoDich.donGiaoDichId },
        }),
        prisma.phieuDatVe.findUniqueOrThrow({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
        }),
        prisma.thanhToan.findUniqueOrThrow({
          where: { thanhToanId: fixture.thanhToan.thanhToanId },
        }),
      ]);
      expect(currentOrder.trangThai).toBe('DANG_XU_LY');
      expect(currentBooking.trangThai).toBe('DANG_XU_LY');
      expect(currentAttempt.trangThai).toBe('DANG_XU_LY');
    });

    it('does not expire booking/order records in the provider-attempt DANG_XU_LY state', async () => {
      const { donGiaoDich, phieuDatVe } = await createTestBooking(
        customerAId,
        'CHO_THANH_TOAN',
        200000,
      );
      const createdAt = new Date(Date.now() - 11 * 60 * 1000);
      await prisma.$transaction([
        prisma.donGiaoDich.update({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
          data: { trangThai: 'DANG_XU_LY' },
        }),
        prisma.phieuDatVe.update({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
          data: { trangThai: 'DANG_XU_LY', createdAt },
        }),
      ]);

      await expect(
        app
          .get(PaymentsService)
          .expireBookingIfExpired(phieuDatVe.phieuDatVeId, new Date()),
      ).resolves.toBe(false);

      const [currentOrder, currentBooking] = await Promise.all([
        prisma.donGiaoDich.findUniqueOrThrow({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
        }),
        prisma.phieuDatVe.findUniqueOrThrow({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
        }),
      ]);
      expect(currentOrder.trangThai).toBe('DANG_XU_LY');
      expect(currentBooking.trangThai).toBe('DANG_XU_LY');
    });

    it('expires an overdue booking atomically, releases its seats, cancels cargo, and keeps a late payment from reviving it', async () => {
      const fixture = await createMultiTicketPayment(customerAId, 1, 'SEPAY');
      const suffix = randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase();
      const sender = await prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `EXP-S-${suffix}`,
          tenDiem: `Điểm gửi ${suffix}`,
          diaChi: '1 Đường thử',
          tinhThanh: 'Hồ Chí Minh',
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
        },
        select: { diemGiaoNhanHangId: true },
      });
      const receiver = await prisma.diemGiaoNhanHang.create({
        data: {
          maDiem: `EXP-R-${suffix}`,
          tenDiem: `Điểm nhận ${suffix}`,
          diaChi: '2 Đường thử',
          tinhThanh: 'Lâm Đồng',
          trangThai: 'HOAT_DONG',
          nhaXeId: busCompanyId,
        },
        select: { diemGiaoNhanHangId: true },
      });
      const shipment = await prisma.phieuGuiHang.create({
        data: {
          maVanDon: `VD-EXP-${suffix}`,
          tenNguoiNhan: 'Người nhận kiểm thử',
          soDienThoaiNguoiNhan: '+84950000001',
          ngayGui: new Date(),
          cuocChinh: 0,
          phiDichVu: 0,
          soTienGiam: 0,
          tongPhi: 0,
          nguoiTraCuoc: 'NGUOI_GUI',
          trangThai: 'MOI_TAO',
          chuyenXeId: fixture.chuyenXeId,
          diemGuiId: sender.diemGiaoNhanHangId,
          diemNhanId: receiver.diemGiaoNhanHangId,
          donGiaoDichId: fixture.donGiaoDich.donGiaoDichId,
        },
      });

      try {
        const createdAt = new Date(Date.now() - 11 * 60 * 1000);
        await prisma.$transaction([
          prisma.donGiaoDich.update({
            where: { donGiaoDichId: fixture.donGiaoDich.donGiaoDichId },
            data: { ngayTao: createdAt },
          }),
          prisma.phieuDatVe.update({
            where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
            data: { createdAt },
          }),
        ]);
        await prisma.gheChuyenXe.updateMany({
          where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
          data: { trangThai: 'DA_DAT' },
        });

        const expiredCount = await app
          .get(PaymentsService)
          .expireBookingIfExpired(fixture.phieuDatVe.phieuDatVeId, new Date());
        expect(expiredCount).toBe(true);

        const expiredBooking = await prisma.phieuDatVe.findUnique({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
          include: { donGiaoDich: true, ves: { include: { gheChuyenXe: true } } },
        });
        expect(expiredBooking?.trangThai).toBe('DA_HUY');
        expect(expiredBooking?.donGiaoDich.trangThai).toBe('DA_HUY');
        expect(expiredBooking?.ves[0]?.trangThai).toBe('DA_HUY');
        expect(expiredBooking?.ves[0]?.gheChuyenXe.trangThai).toBe('TRONG');
        expect((await prisma.thanhToan.findUnique({
          where: { thanhToanId: fixture.thanhToan.thanhToanId },
        }))?.trangThai).toBe('THAT_BAI');
        expect((await prisma.phieuGuiHang.findUnique({
          where: { phieuGuiHangId: shipment.phieuGuiHangId },
        }))?.trangThai).toBe('DA_HUY');

        const bookingHistory = await prisma.lichSuTrangThaiPhieuDatVe.findMany({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
        });
        expect(bookingHistory.map((entry) => [entry.trangThaiCu, entry.trangThaiMoi])).toContainEqual([
          'CHO_THANH_TOAN',
          'DA_HUY',
        ]);
        const shipmentHistory = await prisma.lichSuTrangThaiPhieuGuiHang.findMany({
          where: { phieuGuiHangId: shipment.phieuGuiHangId },
        });
        expect(shipmentHistory.map((entry) => entry.trangThai)).toContain('DA_HUY');

        const transactionId = BigInt(
          `0x${randomUUID().replaceAll('-', '')}`,
        ).toString();
        const latePayload = {
          id: transactionId,
          gateway: 'STB',
          accountNumber: sepayTestAccountNumber,
          code: fixture.donGiaoDich.maDonGiaoDich,
          transferType: 'in',
          transferAmount: fixture.totalAmount,
          currency: 'VND',
          content: fixture.donGiaoDich.maDonGiaoDich,
        };
        const lateWebhook = await postSignedSepayEvent(latePayload);
        expect(lateWebhook.status).toBe(200);
        const afterLateWebhook = await prisma.phieuDatVe.findUnique({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
          include: { donGiaoDich: true, ves: true },
        });
        expect(afterLateWebhook?.trangThai).toBe('DA_HUY');
        expect(afterLateWebhook?.donGiaoDich.trangThai).toBe('DA_HUY');
        expect(afterLateWebhook?.ves[0]?.trangThai).toBe('DA_HUY');
        const latePayment = await prisma.thanhToan.findUnique({
          where: { thanhToanId: fixture.thanhToan.thanhToanId },
        });
        expect(latePayment).toMatchObject({
          trangThai: 'THANH_CONG',
          maGiaoDichSePay: transactionId,
        });
        const lateReplay = await postSignedSepayEvent(latePayload);
        expect(lateReplay.status).toBe(200);
        await expect(
          prisma.lichSuTrangThaiPhieuDatVe.count({
            where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
          }),
        ).resolves.toBe(1);
        await expect(
          app
            .get(PaymentsService)
            .getPaymentStatus(
              fixture.thanhToan.thanhToanId,
              customerAPrincipal,
            ),
        ).resolves.toMatchObject({
          status: 'SUCCESS',
          paymentStatus: 'THANH_CONG',
          orderStatus: 'DA_HUY',
          bookingStatus: 'DA_HUY',
          requiresReconciliation: true,
        });
      } finally {
        await prisma.lichSuTrangThaiPhieuGuiHang.deleteMany({
          where: { phieuGuiHangId: shipment.phieuGuiHangId },
        });
        await prisma.phieuGuiHang.deleteMany({
          where: { phieuGuiHangId: shipment.phieuGuiHangId },
        });
        await prisma.diemGiaoNhanHang.deleteMany({
          where: { diemGiaoNhanHangId: { in: [sender.diemGiaoNhanHangId, receiver.diemGiaoNhanHangId] } },
        });
        await fixture.cleanup();
      }
    });

    it('does not expire or release seats after an on-time payment settles', async () => {
      const fixture = await createMultiTicketPayment(customerAId, 1, 'MOMO');
      try {
        await prisma.gheChuyenXe.updateMany({
          where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
          data: { trangThai: 'DA_DAT' },
        });
        const payload = buildMomoPayload(fixture.thanhToan.thanhToanId, {
          amount: fixture.totalAmount,
        });
        const settled = await request(app.getHttpServer())
          .post('/api/v1/payments/momo/webhook')
          .send(payload);
        expect(settled.status).toBe(201);

        const expiredCount = await app
          .get(PaymentsService)
          .expireBookingIfExpired(
            fixture.phieuDatVe.phieuDatVeId,
            new Date(Date.now() + 20 * 60 * 1000),
          );
        expect(expiredCount).toBe(false);
        const current = await prisma.phieuDatVe.findUnique({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
          include: { ves: { include: { gheChuyenXe: true } } },
        });
        expect(current?.trangThai).toBe('DA_THANH_TOAN');
        expect(current?.ves[0]?.gheChuyenXe.trangThai).toBe('DA_DAT');
      } finally {
        await fixture.cleanup();
      }
    });

    it('serializes expiration against an on-time payment webhook by the booking deadline', async () => {
      const fixture = await createMultiTicketPayment(customerAId, 1, 'MOMO');
      try {
        const createdAt = new Date(Date.now() - 11 * 60 * 1000);
        await prisma.$transaction([
          prisma.donGiaoDich.update({
            where: { donGiaoDichId: fixture.donGiaoDich.donGiaoDichId },
            data: { ngayTao: createdAt },
          }),
          prisma.phieuDatVe.update({
            where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
            data: { createdAt },
          }),
        ]);
        await prisma.gheChuyenXe.updateMany({
          where: { gheChuyenXeId: { in: fixture.gheChuyenXeIds } },
          data: { trangThai: 'DA_DAT' },
        });
        const expiration = app
          .get(PaymentsService)
          .expireBookingIfExpired(fixture.phieuDatVe.phieuDatVeId, new Date());
        const webhook = request(app.getHttpServer())
          .post('/api/v1/payments/momo/webhook')
          .send(buildMomoPayload(fixture.thanhToan.thanhToanId, { amount: fixture.totalAmount }));
        const [, webhookResult] = await Promise.all([expiration, webhook]);
        expect([201, 409]).toContain(webhookResult.status);

        const current = await prisma.phieuDatVe.findUnique({
          where: { phieuDatVeId: fixture.phieuDatVe.phieuDatVeId },
          include: { donGiaoDich: true, ves: { include: { gheChuyenXe: true } } },
        });
        expect(current?.trangThai).toBe('DA_HUY');
        expect(current?.donGiaoDich.trangThai).toBe('DA_HUY');
        expect(current?.ves[0]?.trangThai).toBe('DA_HUY');
        expect(current?.ves[0]?.gheChuyenXe.trangThai).toBe('TRONG');
      } finally {
        await fixture.cleanup();
      }
    });

    it('rolls back payment and order updates when the booking state CAS fails', async () => {
      const suffix = randomUUID().slice(0, 8).toUpperCase();
      const donGiaoDich = await prisma.donGiaoDich.create({
        data: {
          maDonGiaoDich: `VXG-GD-20261013-${suffix}`,
          ngayTao: new Date(),
          tongTien: 150000,
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: 'Payment Test Customer',
          soDienThoaiKhachHang: '+84950000001',
          khachHangId: customerAId,
          nhaXeId: busCompanyId,
          phieuDatVe: {
            create: {
              maPhieuDatVe: `VXG-PDV-20261013-${suffix}`,
              ngayDat: new Date(),
              soLuongVeBanDau: 1,
              tongTienBanDau: 150000,
              trangThai: 'KHONG_HOP_LE',
            },
          },
        },
        include: { phieuDatVe: true },
      });
      const payment = await prisma.thanhToan.create({
        data: {
          soTien: 150000,
          phuongThuc: 'MOMO',
          loaiGiaoDich: 'THANH_TOAN',
          thoiGian: new Date(),
          trangThai: 'DANG_XU_LY',
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
      });

      await expect(
        app.get(PaymentsService).confirmPaymentSuccess({
          paymentId: payment.thanhToanId,
          provider: 'MOMO',
          amount: 150000,
        }),
      ).rejects.toThrow(ConflictException);

      const currentOrder = await prisma.donGiaoDich.findUnique({
        where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
      });
      const currentBooking = await prisma.phieuDatVe.findUnique({
        where: { phieuDatVeId: donGiaoDich.phieuDatVe!.phieuDatVeId },
      });
      const currentPayment = await prisma.thanhToan.findUnique({
        where: { thanhToanId: payment.thanhToanId },
      });

      expect(currentOrder?.trangThai).toBe('CHO_THANH_TOAN');
      expect(currentBooking?.trangThai).toBe('KHONG_HOP_LE');
      expect(currentPayment?.trangThai).toBe('DANG_XU_LY');
    });
  });
});

