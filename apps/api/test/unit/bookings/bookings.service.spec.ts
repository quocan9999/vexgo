import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingsService } from '../../../src/bookings/bookings.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';
import { CargoPricingService } from '../../../src/cargo-pricing/cargo-pricing.service.js';

describe('BookingsService', () => {
  const mockCustomer = {
    khachHangId: 10,
    taiKhoanId: 1,
  };

  const sampleBooking = {
    phieuDatVeId: 101,
    maPhieuDatVe: 'PDV-101',
    ngayDat: new Date('2026-09-20T10:00:00.000Z'),
    soLuongVeBanDau: 2,
    tongTienBanDau: '500000',
    trangThai: 'DA_THANH_TOAN',
    khuyenMaiId: null,
    donGiaoDichId: 201,
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
    updatedAt: new Date('2026-09-20T10:05:00.000Z'),
    donGiaoDich: {
      donGiaoDichId: 201,
      maDonGiaoDich: 'GD-201',
      tongTien: '500000',
      trangThai: 'DA_THANH_TOAN',
      tenKhachHang: 'Nguyễn Văn A',
      soDienThoaiKhachHang: '+84901234567',
      khachHangId: 10,
      nhaXeId: 1,
      khachHang: {
        khachHangId: 10,
        taiKhoanId: 1,
      },
      nhaXe: {
        nhaXeId: 1,
        tenNhaXe: 'Phương Trang',
      },
      thanhToans: [
        {
          thanhToanId: 301,
          soTien: '500000',
          phuongThuc: 'VNPAY',
          trangThai: 'THANH_CONG',
        },
      ],
    },
    ves: [
      {
        veId: 1,
        maVe: 'VE-001',
        giaNiemYet: '250000',
        giaThucTe: '250000',
        trangThai: 'DA_DAT',
        diemDon: 'Bến xe Miền Đông',
        gheChuyenXe: {
          gheChuyenXeId: 11,
          ghe: { soGhe: 'A01', viTri: 'Tầng dưới' },
          chuyenXe: {
            chuyenXeId: 50,
            maChuyenXe: 'CX-50',
            ngayKhoiHanh: new Date('2026-09-25T00:00:00.000Z'),
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
            tuyenXe: {
              diemDi: 'TP.HCM',
              diemDen: 'Đà Lạt',
              nhaXe: { tenNhaXe: 'Phương Trang' },
            },
            xe: {
              loaiXe: { tenLoai: 'GIƯỜNG NẰM' },
            },
          },
        },
      },
      {
        veId: 2,
        maVe: 'VE-002',
        giaNiemYet: '250000',
        giaThucTe: '250000',
        trangThai: 'DA_DAT',
        diemDon: 'Bến xe Miền Đông',
        gheChuyenXe: {
          gheChuyenXeId: 12,
          ghe: { soGhe: 'A02', viTri: 'Tầng dưới' },
          chuyenXe: {
            chuyenXeId: 50,
            maChuyenXe: 'CX-50',
            ngayKhoiHanh: new Date('2026-09-25T00:00:00.000Z'),
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
            tuyenXe: {
              diemDi: 'TP.HCM',
              diemDen: 'Đà Lạt',
              nhaXe: { tenNhaXe: 'Phương Trang' },
            },
            xe: {
              loaiXe: { tenLoai: 'GIƯỜNG NẰM' },
            },
          },
        },
      },
    ],
  };

  const prisma = {
    khachHang: {
      findUnique: vi.fn(),
    },
    phieuDatVe: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  };

  const config = {
    get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
  };

  const seatHoldsService = {
    verifyHold: vi.fn(),
    consumeHoldInTx: vi.fn().mockResolvedValue({ giuChoId: 1 }),
  };

  const cargoCapacityService = {
    lockTrip: vi.fn().mockResolvedValue(undefined),
    getSnapshot: vi.fn().mockResolvedValue({
      trip: { chuyenXeId: 50, trangThai: 'CHUA_KHOI_HANH', nhanGuiHang: true },
      capacities: {
        XE_MAY: { total: 100, used: 0, remaining: 100 },
        HANG_CONG_KENH: { total: 100, used: 0, remaining: 100 },
        HANG_NHE: { total: 100, used: 0, remaining: 100 },
      },
    }),
    assertAvailable: vi.fn(),
  };

  const service = new BookingsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    seatHoldsService as any,
    {} as any,
    new CargoPricingService(),
    cargoCapacityService as any,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    seatHoldsService.consumeHoldInTx.mockResolvedValue({ giuChoId: 1 });
  });

  describe('findCustomerBookings', () => {
    it('throws NotFoundException when customer profile does not exist', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(null);

      await expect(
        service.findCustomerBookings(999, { page: 1, pageSize: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns paginated bookings mapped with route, tickets, and payment summary', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.phieuDatVe.count.mockResolvedValue(1);
      prisma.phieuDatVe.findMany.mockResolvedValue([sampleBooking]);

      const result = await service.findCustomerBookings(1, {
        page: 1,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      const booking = result.data[0];
      expect(booking.bookingId).toBe(101);
      expect(booking.bookingCode).toBe('PDV-101');
      expect(booking.route).toBe('TP.HCM - Đà Lạt');
      expect(booking.ticketCount).toBe(2);
      expect(booking.seatNumbers).toEqual(['A01', 'A02']);
      expect(booking.totalAmount).toBe(500000);
      expect(booking.paymentMethod).toBe('VNPAY');
      expect(booking.status).toBe('DA_THANH_TOAN');
      expect(result.meta).toEqual({
        page: 1,
        pageSize: 10,
        totalItems: 1,
        totalPages: 1,
      });
    });

    it('orders by createdAt desc and phieuDatVeId desc by default', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.phieuDatVe.count.mockResolvedValue(1);
      prisma.phieuDatVe.findMany.mockResolvedValue([sampleBooking]);

      await service.findCustomerBookings(1, { page: 1, pageSize: 10 });

      expect(prisma.phieuDatVe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { phieuDatVeId: 'desc' }],
          include: expect.objectContaining({
            donGiaoDich: expect.objectContaining({
              include: expect.objectContaining({
                thanhToans: {
                  orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
                  take: 1,
                },
              }),
            }),
          }),
        }),
      );
    });

    it('orders by totalAmount and direction when requested', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.phieuDatVe.count.mockResolvedValue(1);
      prisma.phieuDatVe.findMany.mockResolvedValue([sampleBooking]);

      await service.findCustomerBookings(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'totalAmount',
        sortDirection: 'asc',
      });

      expect(prisma.phieuDatVe.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ tongTienBanDau: 'asc' }, { phieuDatVeId: 'asc' }],
        }),
      );
    });
  });

  describe('findCustomerBookingById', () => {
    it('throws NotFoundException when booking does not exist', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue(null);

      await expect(service.findCustomerBookingById(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when booking belongs to another customer', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        ...sampleBooking,
        maPhieuDatVe: 'FUTA-PDV-0123456789ABCDEF0123456789ABCD',
        donGiaoDich: {
          ...sampleBooking.donGiaoDich,
          khachHang: { taiKhoanId: 888 },
        },
      });

      await expect(service.findCustomerBookingById(1, 101)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('denies account history access to an unlinked guest booking', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        ...sampleBooking,
        maPhieuDatVe: 'FUTA-PDV-0123456789ABCDEF0123456789ABCD',
        donGiaoDich: {
          ...sampleBooking.donGiaoDich,
          khachHangId: null,
          khachHang: null,
        },
      });

      await expect(service.findCustomerBookingById(1, 101)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns booking detail wrapped in data envelope when authorized', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue(sampleBooking);

      const result = await service.findCustomerBookingById(1, 101);
      expect(result.data.bookingId).toBe(101);
      expect(result.data.tickets).toHaveLength(2);
      expect(result.data.tickets[0].seatNumber).toBe('A01');
    });
  });

  describe('findPublicBookingById', () => {
    it('requires the account owner for a registered customer booking', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue(sampleBooking);

      await expect(service.findPublicBookingById(101)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(
        service.findPublicBookingById(101, { taiKhoanId: 1 } as any),
      ).resolves.toMatchObject({ bookingId: 101 });
    });

    it('requires booking code and matching phone to read an unlinked guest booking', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        ...sampleBooking,
        maPhieuDatVe: 'FUTA-PDV-0123456789ABCDEF0123456789ABCD',
        donGiaoDich: {
          ...sampleBooking.donGiaoDich,
          khachHangId: null,
          khachHang: null,
        },
      });

      await expect(service.findPublicBookingById(101)).rejects.toThrow(
        NotFoundException,
      );
      await expect(
        service.findPublicBookingById(
          101,
          undefined,
          'FUTA-PDV-0123456789ABCDEF0123456789ABCD',
          '0900000000',
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findPublicBookingById(101, undefined, 'PDV-101', '0901234567'),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.findPublicBookingById(
          101,
          undefined,
          'FUTA-PDV-0123456789ABCDEF0123456789ABCD',
          '0901234567',
        ),
      ).resolves.toMatchObject({
        bookingId: 101,
        passenger: { phoneNumber: '+84901234567' },
      });
    });
  });

  describe('mapBooking financial totals', () => {
    it('uses the final order total and reports discounted ticket subtotal separately', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        ...sampleBooking,
        tongTienBanDau: '600000',
        donGiaoDich: {
          ...sampleBooking.donGiaoDich,
          tongTien: '650000',
          phieuGuiHang: {
            tongPhi: '150000',
            hangHoas: [],
          },
        },
        ves: sampleBooking.ves.map((ticket) => ({
          ...ticket,
          giaThucTe: '250000',
        })),
      });

      await expect(
        service.findPublicBookingById(101, { taiKhoanId: 1 } as any),
      ).resolves.toMatchObject({
        totalAmount: 650000,
        ticketSubtotal: 500000,
        originalTicketSubtotal: 600000,
        discountAmount: 100000,
        cargoFee: 150000,
      });
    });
  });

  describe('createBooking', () => {
    it('requires a hold token before reading booking data or starting a transaction', async () => {
      await expect(
        service.createBooking({
          tripId: 1,
          seatIds: [11],
          contact: { fullName: 'Guest', phone: '0901234567' },
        } as any),
      ).rejects.toMatchObject({
        response: { error: 'HOLD_REQUIRED' },
      });

      expect(prisma.khachHang.findUnique).not.toHaveBeenCalled();
    });

    it('creates a booking atomically when valid trip and seats are provided', async () => {
      const mockTrip = {
        chuyenXeId: 1,
        ngayKhoiHanh: new Date(Date.now() + 86400000), // tomorrow
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        nhanGuiHang: true,
        sucChuaXeMay: 3,
        sucChuaHangCongKenh: 10,
        sucChuaHangNhe: 10,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: 1,
        tuyenXeId: 1,
        tuyenXe: {
          tuyenXeId: 1,
          diemDi: 'TP.HCM',
          diemDen: 'Đà Lạt',
          nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
        },
        xe: { loaiXeId: 1 },
      };

      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer as any);
      (prisma as any).chuyenXe = {
        findUnique: vi.fn().mockResolvedValue(mockTrip),
      };
      (prisma as any).bangGia = { findFirst: vi.fn().mockResolvedValue({ bangGiaId: 1, giaNiemYet: 250000 }) };
      (prisma as any).gheChuyenXe = {
        findMany: vi.fn().mockResolvedValue([
          { gheChuyenXeId: 1, trangThai: 'DANG_GIU', giuChoId: 1, ghe: { soGhe: 'A01' } },
        ]),
      };
      let createdOrderData: Record<string, unknown> | undefined;
      let createdBookingData: Record<string, unknown> | undefined;
      (prisma as any).$transaction = vi.fn().mockImplementation(async (cb) => {
        const txMock = {
          gheChuyenXe: {
            findMany: vi.fn().mockResolvedValue([
              { gheChuyenXeId: 1, trangThai: 'DANG_GIU', giuChoId: 1, ghe: { soGhe: 'A01' } },
            ]),
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          khachHang: { findUnique: vi.fn().mockResolvedValue({ khachHangId: 10 }) },
          donGiaoDich: {
            count: vi.fn().mockRejectedValue(new Error('count must not be used')),
            create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
              createdOrderData = data;
              return { donGiaoDichId: 99 };
            }),
          },
          phieuDatVe: {
            create: vi.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) => {
              createdBookingData = data;
              return {
                phieuDatVeId: 88,
                createdAt: new Date(),
                trangThai: 'CHO_THANH_TOAN',
              };
            }),
          },
          ve: {
            create: vi.fn().mockResolvedValue({ veId: 77 }),
          },
        };
        return cb(txMock);
      });

      const res = await service.createBooking({
        tripId: 1,
        seatIds: [1],
        holdToken: 'hold_test_token',
        pickupPoint: 'Bến xe Miền Đông',
        dropoffPoint: 'Bến xe Đà Lạt',
        contact: {
          fullName: 'Nguyễn Văn Test',
          phone: '0901234567',
          email: 'test@example.com',
        },
      }, { taiKhoanId: 1 } as any);

      expect(res.bookingId).toBe(88);
      expect(res.ticketCount).toBe(1);
      expect(res.totalAmount).toBe(250000);
      expect(res.tickets[0].soGhe).toBe('A01');
      expect(createdOrderData?.maDonGiaoDich).toMatch(/^FUTAGD[A-F\d]{30}$/);
      expect(createdOrderData?.thanhToans).toEqual({
        create: {
          phuongThuc: 'SEPAY',
          loaiGiaoDich: 'THANH_TOAN',
          trangThai: 'DANG_XU_LY',
          soTien: expect.anything(),
          thoiGian: expect.any(Date),
        },
      });
      expect(Number((createdOrderData?.thanhToans as any).create.soTien)).toBe(250000);
      expect(createdBookingData?.maPhieuDatVe).toMatch(/^FUTA-PDV-[A-F\d]{30}$/);
    });
  });

  describe('createBooking cargo rates', () => {
    it('applies one active tariff per cargo type using aggregate weight and stores its snapshot', async () => {
      const trip = {
        chuyenXeId: 50,
        ngayKhoiHanh: new Date('2099-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        nhanGuiHang: true,
        sucChuaXeMay: 3,
        sucChuaHangCongKenh: 10,
        sucChuaHangNhe: 10,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: 1,
        tuyenXeId: 2,
        tuyenXe: {
          tuyenXeId: 2,
          diemDi: 'TP.HCM',
          diemDen: 'Đà Lạt',
          nhaXe: { nhaXeId: 1, maNhaXe: 'FUTA', tenNhaXe: 'Phương Trang' },
        },
        xe: { loaiXeId: 3, nhaXe: { maNhaXe: 'FUTA' } },
      };
      const tripSeat = {
        gheChuyenXeId: 101,
        chuyenXeId: 50,
        trangThai: 'DANG_GIU',
        giuChoId: 1,
        ghe: { soGhe: 'A01' },
      };
      const senderPoint = {
        vaiTro: 'GUI_HANG',
        diemGiaoNhanHangId: 11,
        diemGiaoNhanHang: {
          diemGiaoNhanHangId: 11,
          nhaXeId: 1,
          trangThai: 'HOAT_DONG',
        },
      };
      const receiverPoint = {
        vaiTro: 'NHAN_HANG',
        diemGiaoNhanHangId: 12,
        diemGiaoNhanHang: {
          diemGiaoNhanHangId: 12,
          nhaXeId: 1,
          trangThai: 'HOAT_DONG',
        },
      };
      const lightCargoType = {
        loaiHangHoaId: 21,
        tenLoai: 'Hàng nhẹ',
        nhomSucChua: 'HANG_NHE',
      };
      const prismaMock: Record<string, any> = {
        chuyenXe: { findUnique: vi.fn().mockResolvedValue(trip) },
        gheChuyenXe: { findMany: vi.fn().mockResolvedValue([tripSeat]) },
        bangGia: {
          findFirst: vi.fn().mockResolvedValue({ bangGiaId: 9, giaNiemYet: 150000 }),
        },
        diemGiaoNhanTuyenXe: {
          findMany: vi.fn().mockResolvedValue([senderPoint, receiverPoint]),
        },
        loaiHangHoa: {
          findMany: vi.fn().mockResolvedValue([lightCargoType]),
        },
        bangCuocGuiHang: {
          findMany: vi.fn().mockResolvedValue([
            {
              bangCuocGuiHangId: 31,
              loaiHangHoaId: 21,
              khoiLuongTu: 0,
              khoiLuongDen: 5,
              mucCuoc: 20000,
            },
            {
              bangCuocGuiHangId: 32,
              loaiHangHoaId: 21,
              khoiLuongTu: 5,
              khoiLuongDen: 10,
              mucCuoc: 60000,
            },
          ]),
        },
      };
      const cargoRows: Record<string, unknown>[] = [];
      const feeRows: Record<string, unknown>[] = [];
      const orderRows: Record<string, unknown>[] = [];
      const shipmentRows: Record<string, unknown>[] = [];
      const rateLookup = vi.fn().mockResolvedValue([
        {
          bangCuocGuiHangId: 31,
          loaiHangHoaId: 21,
          khoiLuongTu: 0,
          khoiLuongDen: 5,
          mucCuoc: 20000,
        },
        {
          bangCuocGuiHangId: 32,
          loaiHangHoaId: 21,
          khoiLuongTu: 5,
          khoiLuongDen: 10,
          mucCuoc: 60000,
        },
      ]);
      prismaMock.$transaction = vi.fn(async (callback) =>
        callback({
          diemGiaoNhanTuyenXe: {
            findMany: vi.fn().mockResolvedValue([senderPoint, receiverPoint]),
          },
          loaiHangHoa: {
            findMany: vi.fn().mockResolvedValue([lightCargoType]),
          },
          bangCuocGuiHang: { findMany: rateLookup },
          gheChuyenXe: {
            findMany: vi.fn().mockResolvedValue([tripSeat]),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          hangHoa: {
            findMany: vi.fn().mockResolvedValue([]),
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              cargoRows.push(data);
              return { hangHoaId: cargoRows.length, ...data };
            }),
          },
          donGiaoDich: {
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              orderRows.push(data);
              return { donGiaoDichId: 201, maDonGiaoDich: data.maDonGiaoDich };
            }),
          },
          phieuDatVe: {
            create: vi.fn().mockResolvedValue({
              phieuDatVeId: 301,
              maPhieuDatVe: 'FUTA-PDV-TEST',
              createdAt: new Date('2026-10-14T12:00:00.000Z'),
              trangThai: 'CHO_THANH_TOAN',
            }),
          },
          ve: { create: vi.fn().mockResolvedValue({ veId: 401 }) },
          phieuGuiHang: {
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              shipmentRows.push(data);
              return { phieuGuiHangId: 501 };
            }),
          },
          chiTietCuocGuiHang: {
            create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
              feeRows.push(data);
              return { chiTietCuocGuiHangId: feeRows.length };
            }),
          },
          lichSuTrangThaiPhieuGuiHang: { create: vi.fn() },
          lichSuTrangThaiPhieuDatVe: { create: vi.fn() },
          lichSuTrangThaiVe: { create: vi.fn() },
        }),
      );
      const seatHoldMock = {
        verifyHold: vi.fn(),
        consumeHoldInTx: vi.fn().mockResolvedValue({ giuChoId: 1 }),
      };
      const bookingService = new BookingsService(
        prismaMock as unknown as PrismaService,
        config as unknown as ConfigService,
        seatHoldMock as any,
        {} as any,
        new CargoPricingService(),
        cargoCapacityService as any,
      );
      vi.spyOn(bookingService, 'getBookingQuote').mockResolvedValue({
        unitPrice: 150000,
        seatCount: 1,
        originalTotal: 150000,
        discountAmount: 0,
        finalTotal: 150000,
        currency: 'VND',
        appliedPromotionCode: null,
      });

      const result = await bookingService.createBooking(
        {
          tripId: 50,
          seatIds: [101],
          holdToken: 'hold_test_token',
          pickupPoint: 'Bến xe Miền Đông',
          dropoffPoint: 'Bến xe Đà Lạt',
          contact: { fullName: 'Khách thử', phone: '0901234567' },
        cargoItems: [
            { name: 'Túi sách', type: 'Hàng nhẹ', loaiHangHoaId: 21, quantity: 1, weight: 2 },
            { name: 'Va li', type: 'Hàng nhẹ', loaiHangHoaId: 21, quantity: 1, weight: 4 },
          ],
        } as any,
      );

      expect(result.shippingFee).toBe(60000);
      expect(result.totalAmount).toBe(210000);
      expect(rateLookup).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            diemGuiId: 11,
            diemNhanId: 12,
          }),
        }),
      );
      expect(feeRows).toHaveLength(1);
      expect(feeRows[0]).toMatchObject({
        loaiHangHoaId: 21,
        bangCuocGuiHangId: 32,
        khoiLuongTinhCuoc: expect.objectContaining({ d: [6] }),
        soTienCuoc: expect.objectContaining({ d: [60000] }),
      });
      expect(Number(orderRows[0].tongTien)).toBe(210000);
      expect(orderRows[0].khachHangId).toBeNull();
      expect((orderRows[0].thanhToans as any).create).toMatchObject({
        phuongThuc: 'SEPAY', loaiGiaoDich: 'THANH_TOAN', trangThai: 'DANG_XU_LY',
      });
      expect(Number((orderRows[0].thanhToans as any).create.soTien)).toBe(210000);
      expect(Number(shipmentRows[0].tongPhi)).toBe(60000);
      expect(cargoRows).toHaveLength(2);
    });

    it('requires explicit route points when multiple active sender choices exist', async () => {
      const trip = {
        chuyenXeId: 50,
        ngayKhoiHanh: new Date('2099-12-01T00:00:00.000Z'),
        gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
        nhanGuiHang: true,
        trangThai: 'CHUA_KHOI_HANH',
        nhaXeId: 1,
        tuyenXeId: 2,
        tuyenXe: { nhaXe: { maNhaXe: 'FUTA' } },
        xe: { loaiXeId: 3 },
      };
      const prismaMock: Record<string, any> = {
        chuyenXe: { findUnique: vi.fn().mockResolvedValue(trip) },
        gheChuyenXe: {
          findMany: vi.fn().mockResolvedValue([
            {
              gheChuyenXeId: 101,
              trangThai: 'DANG_GIU',
              ghe: { soGhe: 'A01' },
            },
          ]),
        },
        bangGia: {
          findFirst: vi.fn().mockResolvedValue({ bangGiaId: 9 }),
        },
        diemGiaoNhanTuyenXe: {
          findMany: vi.fn().mockResolvedValue([
            { vaiTro: 'GUI_HANG', diemGiaoNhanHangId: 11, diemGiaoNhanHang: { nhaXeId: 1, trangThai: 'HOAT_DONG' } },
            { vaiTro: 'GUI_HANG', diemGiaoNhanHangId: 13, diemGiaoNhanHang: { nhaXeId: 1, trangThai: 'HOAT_DONG' } },
            { vaiTro: 'NHAN_HANG', diemGiaoNhanHangId: 12, diemGiaoNhanHang: { nhaXeId: 1, trangThai: 'HOAT_DONG' } },
          ]),
        },
      };
      const seatHoldMock = {
        verifyHold: vi.fn(),
        consumeHoldInTx: vi.fn(),
      };
      const bookingService = new BookingsService(
        prismaMock as unknown as PrismaService,
        config as unknown as ConfigService,
        seatHoldMock as any,
        {} as any,
        new CargoPricingService(),
        cargoCapacityService as any,
      );
      prismaMock.$transaction = vi.fn(async (callback: (tx: unknown) => unknown) =>
        callback({
          diemGiaoNhanTuyenXe: {
            findMany: vi.fn().mockResolvedValue([
              { vaiTro: 'GUI_HANG', diemGiaoNhanHangId: 11, diemGiaoNhanHang: { nhaXeId: 1, trangThai: 'HOAT_DONG' } },
              { vaiTro: 'GUI_HANG', diemGiaoNhanHangId: 13, diemGiaoNhanHang: { nhaXeId: 1, trangThai: 'HOAT_DONG' } },
              { vaiTro: 'NHAN_HANG', diemGiaoNhanHangId: 12, diemGiaoNhanHang: { nhaXeId: 1, trangThai: 'HOAT_DONG' } },
            ]),
          },
        }),
      );
      vi.spyOn(bookingService, 'getBookingQuote').mockResolvedValue({
        unitPrice: 150000,
        seatCount: 1,
        originalTotal: 150000,
        discountAmount: 0,
        finalTotal: 150000,
        currency: 'VND',
        appliedPromotionCode: null,
      });

      await expect(
        bookingService.createBooking(
          {
            tripId: 50,
            seatIds: [101],
            holdToken: 'hold_test_token',
            pickupPoint: 'Bến xe Miền Đông',
            dropoffPoint: 'Bến xe Đà Lạt',
            contact: { fullName: 'Khách thử', phone: '0901234567' },
            cargoItems: [{ name: 'Túi sách', type: 'Hàng nhẹ', quantity: 1, weight: 2 }],
          } as any,
        ),
      ).rejects.toThrow(ConflictException);
      expect(seatHoldMock.consumeHoldInTx).not.toHaveBeenCalled();
    });
  });

  describe('createBooking - Financial Consistency & Remainder Allocation', () => {
    it('distributes remainder deterministically so sum(Ve.giaThucTe) strictly equals finalTotal', async () => {
      const mockSeatHolds = {
        verifyHold: vi.fn(),
        consumeHold: vi.fn(),
        consumeHoldInTx: vi.fn().mockResolvedValue({ giuChoId: 1 }),
      };
      const mockPromotions = {
        validatePromotion: vi.fn().mockResolvedValue({ isValid: false, discountAmount: 0 }),
      };

      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const trip = {
        chuyenXeId: 50,
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: futureDate,
        gioKhoiHanh: new Date('1970-01-01T08:00:00Z'),
        nhaXeId: 1,
        tuyenXeId: 2,
        xe: { loaiXeId: 3 },
      };

      const tripSeats = [
        { gheChuyenXeId: 101, chuyenXeId: 50, trangThai: 'DANG_GIU', ghe: { soGhe: 'A1' } },
        { gheChuyenXeId: 102, chuyenXeId: 50, trangThai: 'DANG_GIU', ghe: { soGhe: 'A2' } },
        { gheChuyenXeId: 103, chuyenXeId: 50, trangThai: 'DANG_GIU', ghe: { soGhe: 'A3' } },
      ];

      const createdTickets: any[] = [];
      const testPrisma: any = {
        khachHang: {
          findUnique: vi.fn().mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 }),
        },
        chuyenXe: {
          findUnique: vi.fn().mockResolvedValue(trip),
        },
        gheChuyenXe: {
          findMany: vi.fn().mockResolvedValue(tripSeats),
        },
        bangGia: {
          findFirst: vi.fn().mockResolvedValue({ bangGiaId: 9, giaNiemYet: '33333.33' }),
        },
        khuyenMai: {
          findFirst: vi.fn().mockResolvedValue(null),
        },
        $transaction: vi.fn(async (cb) => {
          const tx = {
            donGiaoDich: {
              create: vi.fn().mockResolvedValue({ donGiaoDichId: 201 }),
            },
            phieuDatVe: {
              create: vi.fn().mockResolvedValue({
                phieuDatVeId: 301,
                maPhieuDatVe: 'PDV-301',
                createdAt: new Date(),
              }),
            },
            ve: {
              create: vi.fn().mockImplementation(async ({ data }: any) => {
                createdTickets.push(data);
                return { veId: 501, ...data };
              }),
            },
            gheChuyenXe: {
              updateMany: vi.fn().mockResolvedValue({ count: 3 }),
            },
            lichSuTrangThaiPhieuDatVe: {
              create: vi.fn().mockResolvedValue({}),
            },
            lichSuTrangThaiVe: {
              create: vi.fn().mockResolvedValue({}),
            },
          };
          return cb(tx);
        }),
      };

      const bookingService = new BookingsService(
        testPrisma as unknown as PrismaService,
        config as unknown as ConfigService,
        mockSeatHolds as any,
        mockPromotions as any,
        new CargoPricingService(),
        cargoCapacityService as any,
      );

      // Giả lập tính giá: 100,000 VND chia cho 3 ghế (không chia hết)
      vi.spyOn(bookingService, 'getBookingQuote').mockResolvedValue({
        unitPrice: 33333.33,
        seatCount: 3,
        originalTotal: 100000,
        discountAmount: 0,
        finalTotal: 100000,
        currency: 'VND',
        appliedPromotionCode: null,
      });

      const principal: any = { taiKhoanId: 1, roles: ['CUSTOMER'] };
      const dto: any = {
        tripId: 50,
        seatIds: [101, 102, 103],
        holdToken: 'hold_test_token',
        pickupPoint: 'Bến xe',
        dropoffPoint: 'Bến xe khác',
        contact: { fullName: 'Test', phone: '0901234567' },
      };

      const result = await bookingService.createBooking(dto, principal);

      expect(result).toBeDefined();
      expect(createdTickets).toHaveLength(3);

      // Giá từng vé: 100000 / 3 = 33333 dư 1 -> Vé 1: 33334, Vé 2: 33333, Vé 3: 33333
      expect(createdTickets[0].giaThucTe).toBe(33334);
      expect(createdTickets[1].giaThucTe).toBe(33333);
      expect(createdTickets[2].giaThucTe).toBe(33333);

      // Tổng tiền từng vé phải khớp tuyệt đối 100% với finalTotal
      const totalTicketPrices = createdTickets.reduce((sum, t) => sum + t.giaThucTe, 0);
      expect(totalTicketPrices).toBe(100000);

      // Kiểm tra holdToken được verify với customerId và consume
      expect(mockSeatHolds.verifyHold).toHaveBeenCalledWith(
        'hold_test_token',
        50,
        [101, 102, 103],
        10,
      );
      expect(mockSeatHolds.consumeHoldInTx).toHaveBeenCalledWith(
        expect.anything(),
        'hold_test_token',
        50,
        [101, 102, 103],
        10,
      );
    });
  });
});
