import { BadRequestException, ConflictException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingsService } from '../../../src/bookings/bookings.service.js';
import { Prisma } from '../../../src/generated/prisma/client.js';

describe('Timed Pickup/Dropoff Booking & Pricing (Stage 4)', () => {
  let bookingService: BookingsService;
  let mockPrisma: any;
  let mockCargoPricing: any;
  let mockConfigService: any;
  let mockSeatHolds: any;

  beforeEach(() => {
    mockPrisma = {
      khachHang: { findFirst: vi.fn(), findUnique: vi.fn() },
      chuyenXe: { findUnique: vi.fn() },
      gheChuyenXe: { findMany: vi.fn(), updateMany: vi.fn() },
      diemDonTraChuyenXe: { findFirst: vi.fn(), findMany: vi.fn() },
      bangGia: { findFirst: vi.fn() },
      bangGiaVe: { findFirst: vi.fn() },
      khuyenMai: { findFirst: vi.fn() },
      phieuDatVe: { count: vi.fn().mockResolvedValue(0) },
      $transaction: vi.fn(),
    };

    mockCargoPricing = {
      priceCargoDraft: vi.fn(),
    };

    mockConfigService = {
      get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
    };

    mockSeatHolds = {
      verifyHold: vi.fn().mockResolvedValue(true),
      consumeHoldInTx: vi.fn().mockResolvedValue({ giuChoId: 999 }),
    };

    bookingService = new BookingsService(
      mockPrisma as any,
      mockConfigService as any,
      mockSeatHolds as any,
      {} as any,
      mockCargoPricing as any,
      {} as any,
      {} as any,
    );
    (bookingService as any).seatHoldsService = mockSeatHolds;
  });

  describe('getBookingQuote with timed stops & surcharges', () => {
    it('calculates unit price with pickup and dropoff surcharges per seat', async () => {
      const depDate = new Date();
      depDate.setDate(depDate.getDate() + 2);

      mockPrisma.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 10,
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: depDate,
        gioKhoiHanh: depDate,
        tuyenXeId: 5,
        nhaXeId: 1,
        xe: { loaiXeId: 1 },
      });

      mockPrisma.gheChuyenXe.findMany.mockResolvedValue([
        { gheChuyenXeId: 101, trangThai: 'TRONG', loaiGhe: 'THUONG' },
        { gheChuyenXeId: 102, trangThai: 'TRONG', loaiGhe: 'THUONG' },
      ]);

      mockPrisma.bangGia.findFirst.mockResolvedValue({
        bangGiaId: 1,
        giaNiemYet: new Prisma.Decimal(200000),
      });

      // Mock pickup stop: +30,000 VND
      const pickupStop = {
        diemDonTraChuyenXeId: 201,
        chuyenXeId: 10,
        loaiDiem: 'DON',
        nhanKhach: true,
        phutLech: 0,
        thuTu: 1,
        phuPhi: new Prisma.Decimal(30000),
        diemDonTra: { tenDiem: 'VP Bến xe Miền Đông', diaChi: 'TP.HCM' },
      };

      // Mock dropoff stop: +20,000 VND
      const dropoffStop = {
        diemDonTraChuyenXeId: 202,
        chuyenXeId: 10,
        loaiDiem: 'TRA',
        nhanKhach: true,
        phutLech: 120,
        thuTu: 5,
        phuPhi: new Prisma.Decimal(20000),
        diemDonTra: { tenDiem: 'Điểm trả trung chuyển', diaChi: 'Vũng Tàu' },
      };

      mockPrisma.diemDonTraChuyenXe.findFirst.mockImplementation(({ where }: any) => {
        if (where.diemDonTraChuyenXeId === 201) return Promise.resolve(pickupStop);
        if (where.diemDonTraChuyenXeId === 202) return Promise.resolve(dropoffStop);
        return Promise.resolve(null);
      });

      const quote = await bookingService.getBookingQuote(
        10,
        [101, 102],
        undefined,
        undefined,
        undefined,
        201,
        202,
      );

      // Base fare 200,000 + pickup 30,000 + dropoff 20,000 = 250,000 VND per seat
      expect(quote.baseUnitPrice).toBe('200000.00');
      expect(quote.pickupSurcharge).toBe('30000.00');
      expect(quote.dropoffSurcharge).toBe('20000.00');
      expect(quote.unitPrice).toBe('250000.00');
      expect(quote.seatCount).toBe(2);
      expect(quote.originalTotal).toBe('500000.00');
      expect(quote.finalTotal).toBe('500000.00');
    });

    it('rejects if dropoff stop appears before pickup stop', async () => {
      const depDate = new Date();
      depDate.setDate(depDate.getDate() + 2);

      mockPrisma.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 10,
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: depDate,
        gioKhoiHanh: depDate,
        tuyenXeId: 5,
        nhaXeId: 1,
        xe: { loaiXeId: 1 },
      });

      mockPrisma.gheChuyenXe.findMany.mockResolvedValue([
        { gheChuyenXeId: 101, trangThai: 'TRONG', loaiGhe: 'THUONG' },
      ]);

      mockPrisma.bangGia.findFirst.mockResolvedValue({
        bangGiaId: 1,
        giaNiemYet: new Prisma.Decimal(200000),
      });

      const pickupStop = {
        diemDonTraChuyenXeId: 201,
        chuyenXeId: 10,
        loaiDiem: 'DON',
        nhanKhach: true,
        phutLech: 100,
        thuTu: 3,
        phuPhi: new Prisma.Decimal(0),
      };

      const dropoffStop = {
        diemDonTraChuyenXeId: 202,
        chuyenXeId: 10,
        loaiDiem: 'TRA',
        nhanKhach: true,
        phutLech: 50, // Earlier than pickup!
        thuTu: 2,
        phuPhi: new Prisma.Decimal(0),
      };

      mockPrisma.diemDonTraChuyenXe.findFirst.mockImplementation(({ where }: any) => {
        if (where.diemDonTraChuyenXeId === 201) return Promise.resolve(pickupStop);
        if (where.diemDonTraChuyenXeId === 202) return Promise.resolve(dropoffStop);
        return Promise.resolve(null);
      });

      await expect(
        bookingService.getBookingQuote(
          10,
          [101],
          undefined,
          undefined,
          undefined,
          201,
          202,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('createBooking with timed stops & cutoff', () => {
    it('rejects booking if pickup departure time cutoff (30 minutes) has passed', async () => {
      const departureDate = new Date();
      // Departure in 15 minutes (cutoff is 30 mins)
      departureDate.setMinutes(departureDate.getMinutes() + 15);

      mockPrisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });
      mockPrisma.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 10,
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: departureDate,
        gioKhoiHanh: departureDate,
        nhaXeId: 1,
        xe: { loaiXeId: 1 },
        tuyenXe: { diemDi: 'SG', diemDen: 'VT' },
        gheChuyenXes: [{ gheChuyenXeId: 101, trangThai: 'TRONG' }],
      });

      const pickupStop = {
        diemDonTraChuyenXeId: 201,
        chuyenXeId: 10,
        loaiDiem: 'DON',
        nhanKhach: true,
        phutLech: 0,
        thuTu: 1,
        diemDonTra: { tenDiem: 'Bến xe', diaChi: 'TP.HCM' },
      };

      mockPrisma.diemDonTraChuyenXe.findFirst.mockResolvedValue(pickupStop);

      vi.spyOn(bookingService, 'getBookingQuote').mockResolvedValue({
        unitPrice: '200000.00',
        seatCount: 1,
        originalTotal: '200000.00',
        discountAmount: '0.00',
        finalTotal: '200000.00',
        currency: 'VND',
        appliedPromotionCode: null,
        identityChecked: false,
        phoneEligibilityChecked: true,
        requiresPhoneBeforeBooking: false,
      });

      const dto: any = {
        tripId: 10,
        seatIds: [101],
        holdToken: 'test-token',
        pickupPoint: 'Bến xe',
        dropoffPoint: 'Điểm đến',
        diemDonChuyenXeId: 201,
        contact: { fullName: 'Khách', phone: '0901234567' },
      };

      await expect(
        bookingService.createBooking(dto, { taiKhoanId: 1, roles: ['CUSTOMER'] } as any),
      ).rejects.toThrow(ConflictException);
    });

    it('persists diemDonSnapshot and diemTraSnapshot into created tickets', async () => {
      const departureDate = new Date();
      // Departure in 24 hours
      departureDate.setDate(departureDate.getDate() + 1);

      mockPrisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });
      mockPrisma.chuyenXe.findUnique.mockResolvedValue({
        chuyenXeId: 10,
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: departureDate,
        gioKhoiHanh: departureDate,
        nhaXeId: 1,
        xe: { loaiXeId: 1 },
        tuyenXe: { diemDi: 'SG', diemDen: 'VT' },
        gheChuyenXes: [{ gheChuyenXeId: 101, trangThai: 'DANG_GIU' }],
      });

      mockPrisma.gheChuyenXe.findMany.mockResolvedValue([
        {
          gheChuyenXeId: 101,
          trangThai: 'DANG_GIU',
          loaiGhe: 'THUONG',
          chuyenXeId: 10,
          ghe: { soGhe: 'A01', viTri: 'Tầng 1' },
          chuyenXe: {
            chuyenXeId: 10,
            nhaXeId: 1,
            trangThai: 'CHUA_KHOI_HANH',
            ngayKhoiHanh: departureDate,
            gioKhoiHanh: departureDate,
            tuyenXe: { diemDi: 'SG', diemDen: 'VT' },
            xe: { loaiXe: { loaiXeId: 1, tenLoai: 'Ghế ngồi' } },
          },
        },
      ]);

      const pickupStop = {
        diemDonTraChuyenXeId: 201,
        chuyenXeId: 10,
        loaiDiem: 'DON',
        nhanKhach: true,
        phutLech: 0,
        phutCoMatTruoc: 15,
        phuPhi: new Prisma.Decimal(25000),
        diemDonTra: {
          diemDonTraId: 501,
          tenDiem: 'Bến xe Miền Đông Mới',
          diaChi: 'TP. Thủ Đức',
          loaiDiem: 'BEN_XE',
          kinhDo: 106.8,
          viDo: 10.8,
        },
      };

      const dropoffStop = {
        diemDonTraChuyenXeId: 202,
        chuyenXeId: 10,
        loaiDiem: 'TRA',
        nhanKhach: true,
        phutLech: 120,
        phutCoMatTruoc: 0,
        phuPhi: new Prisma.Decimal(15000),
        diemDonTra: {
          diemDonTraId: 502,
          tenDiem: 'Bến xe Vũng Tàu',
          diaChi: 'TP. Vũng Tàu',
          loaiDiem: 'BEN_XE',
          kinhDo: 107.1,
          viDo: 10.4,
        },
      };

      mockPrisma.diemDonTraChuyenXe.findFirst.mockImplementation(({ where }: any) => {
        if (where.diemDonTraChuyenXeId === 201) return Promise.resolve(pickupStop);
        if (where.diemDonTraChuyenXeId === 202) return Promise.resolve(dropoffStop);
        return Promise.resolve(null);
      });

      mockPrisma.bangGia.findFirst.mockResolvedValue({
        bangGiaId: 1,
        giaNiemYet: new Prisma.Decimal(200000),
      });

      vi.spyOn(bookingService, 'getBookingQuote').mockResolvedValue({
        baseUnitPrice: '200000.00',
        pickupSurcharge: '25000.00',
        dropoffSurcharge: '15000.00',
        unitPrice: '240000.00',
        seatCount: 1,
        originalTotal: '240000.00',
        discountAmount: '0.00',
        finalTotal: '240000.00',
        currency: 'VND',
        appliedPromotionCode: null,
        identityChecked: false,
        phoneEligibilityChecked: true,
        requiresPhoneBeforeBooking: false,
      });

      let savedTicket: any = null;
      mockPrisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          donGiaoDich: {
            create: vi.fn().mockResolvedValue({
              donGiaoDichId: 500,
              maDonGiaoDich: 'GD-500',
              tongTien: new Prisma.Decimal(240000),
              ngayTao: new Date(),
            }),
          },
          phieuDatVe: {
            create: vi.fn().mockResolvedValue({
              phieuDatVeId: 600,
              maPhieuDatVe: 'PDV-600',
              trangThai: 'CHO_THANH_TOAN',
              createdAt: new Date(),
              updatedAt: new Date(),
            }),
          },
          gheChuyenXe: {
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          thanhToan: {
            create: vi.fn().mockResolvedValue({
              thanhToanId: 800,
              soTien: new Prisma.Decimal(240000),
              phuongThuc: 'SEPAY',
              trangThai: 'CHO_THANH_TOAN',
            }),
          },
          ve: {
            create: vi.fn().mockImplementation((args: any) => {
              savedTicket = args.data;
              return Promise.resolve({
                veId: 700,
                maVe: args.data.maVe,
                ...args.data,
              });
            }),
          },
        };
        return cb(tx);
      });

      const dto: any = {
        tripId: 10,
        seatIds: [101],
        holdToken: 'test-token',
        pickupPoint: 'Bến xe Miền Đông Mới',
        dropoffPoint: 'Bến xe Vũng Tàu',
        diemDonChuyenXeId: 201,
        diemTraChuyenXeId: 202,
        contact: { fullName: 'Khách', phone: '0901234567' },
      };

      const result = await bookingService.createBooking(dto, { taiKhoanId: 1, roles: ['CUSTOMER'] } as any);

      expect(result).toBeDefined();
      expect(savedTicket).toBeDefined();
      expect(savedTicket.diemDonChuyenXeId).toBe(201);
      expect(savedTicket.diemTraChuyenXeId).toBe(202);
      expect(savedTicket.diemDon).toBe('Bến xe Miền Đông Mới');
      expect(savedTicket.diemDonSnapshot).toMatchObject({
        diemDonTraChuyenXeId: 201,
        tenDiem: 'Bến xe Miền Đông Mới',
        phuPhi: 25000,
      });
      expect(savedTicket.diemTraSnapshot).toMatchObject({
        diemDonTraChuyenXeId: 202,
        tenDiem: 'Bến xe Vũng Tàu',
        phuPhi: 15000,
      });
    });
  });
});
