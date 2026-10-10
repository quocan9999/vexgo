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

  describe('createBooking', () => {
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

      (prisma as any).chuyenXe = { findUnique: vi.fn().mockResolvedValue(mockTrip) };
      (prisma as any).bangGia = { findFirst: vi.fn().mockResolvedValue({ bangGiaId: 1, giaNiemYet: 250000 }) };
      (prisma as any).$transaction = vi.fn().mockImplementation(async (cb) => {
        const txMock = {
          gheChuyenXe: {
            findMany: vi.fn().mockResolvedValue([
              { gheChuyenXeId: 1, trangThai: 'TRONG', ghe: { soGhe: 'A01' } },
            ]),
            update: vi.fn().mockResolvedValue({}),
          },
          khachHang: { findUnique: vi.fn().mockResolvedValue({ khachHangId: 10 }) },
          donGiaoDich: {
            count: vi.fn().mockResolvedValue(1),
            create: vi.fn().mockResolvedValue({ donGiaoDichId: 99 }),
          },
          phieuDatVe: {
            create: vi.fn().mockResolvedValue({ phieuDatVeId: 88, trangThai: 'CHO_THANH_TOAN' }),
          },
          ve: {
            create: vi.fn().mockResolvedValue({ veId: 77 }),
          },
        };
        return cb(txMock);
      });

      const res = await service.createBooking({
        tripId: 1,
        seatNumbers: ['A01'],
        passenger: {
          fullName: 'Nguyễn Văn Test',
          phoneNumber: '0901234567',
          email: 'test@example.com',
        },
      }, 1);

      expect(res.bookingId).toBe(88);
      expect(res.ticketCount).toBe(1);
      expect(res.totalAmount).toBe(250000);
      expect(res.tickets[0].soGhe).toBe('A01');
    });
  });
});
