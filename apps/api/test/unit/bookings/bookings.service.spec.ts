import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BookingsService } from '../../../src/bookings/bookings.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

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

  const service = new BookingsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    {} as any,
    {} as any,
  );

  beforeEach(() => {
    vi.clearAllMocks();
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
        donGiaoDich: {
          ...sampleBooking.donGiaoDich,
          khachHang: { taiKhoanId: 888 },
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

  describe('createBooking - Financial Consistency & Remainder Allocation', () => {
    it('distributes remainder deterministically so sum(Ve.giaThucTe) strictly equals finalTotal', async () => {
      const mockSeatHolds = {
        verifyHold: vi.fn(),
        consumeHold: vi.fn(),
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
        { gheChuyenXeId: 101, chuyenXeId: 50, trangThai: 'TRONG', ghe: { soGhe: 'A1' } },
        { gheChuyenXeId: 102, chuyenXeId: 50, trangThai: 'TRONG', ghe: { soGhe: 'A2' } },
        { gheChuyenXeId: 103, chuyenXeId: 50, trangThai: 'TRONG', ghe: { soGhe: 'A3' } },
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
                return data;
              }),
            },
            gheChuyenXe: {
              updateMany: vi.fn().mockResolvedValue({ count: 3 }),
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
        contact: { fullName: 'Test', phone: '0901234567' },
      };

      const result = await bookingService.createBooking(principal, dto);

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
      expect(mockSeatHolds.consumeHold).toHaveBeenCalledWith(
        'hold_test_token',
        50,
        [101, 102, 103],
        10,
      );
    });
  });
});
