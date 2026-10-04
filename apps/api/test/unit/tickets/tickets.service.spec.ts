import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TicketsService } from '../../../src/tickets/tickets.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { ConfigService } from '@nestjs/config';

describe('TicketsService', () => {
  const mockCustomer = {
    khachHangId: 10,
    taiKhoanId: 1,
  };

  const sampleTicket = {
    veId: 1,
    maVe: 'VE-001',
    giaNiemYet: '250000',
    giaThucTe: '250000',
    trangThai: 'DA_DAT',
    diemDon: 'Bến xe Miền Đông',
    phieuDatVeId: 101,
    gheChuyenXeId: 11,
    bangGiaApDungId: 2,
    createdAt: new Date('2026-09-20T10:00:00.000Z'),
    updatedAt: new Date('2026-09-20T10:05:00.000Z'),
    phieuDatVe: {
      phieuDatVeId: 101,
      donGiaoDichId: 201,
      maPhieuDatVe: 'PDV-101',
      trangThai: 'DA_THANH_TOAN',
      donGiaoDich: {
        donGiaoDichId: 201,
        trangThai: 'DA_THANH_TOAN',
        tenKhachHang: 'Nguyễn Văn A',
        soDienThoaiKhachHang: '0901234567',
        khachHangId: 10,
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
            soTien: '250000',
            phuongThuc: 'MOMO',
            trangThai: 'THANH_CONG',
          },
        ],
      },
    },
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
  };

  const prisma = {
    khachHang: {
      findUnique: vi.fn(),
    },
    ve: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    gheChuyenXe: {
      update: vi.fn(),
    },
    phieuDatVe: {
      update: vi.fn(),
    },
    donGiaoDich: {
      update: vi.fn(),
    },
    thanhToan: {
      create: vi.fn(),
    },
    $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => cb(prisma)),
  };

  const config = {
    get: vi.fn().mockReturnValue('Asia/Ho_Chi_Minh'),
  };

  const service = new TicketsService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.ve.updateMany.mockResolvedValue({ count: 1 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('findCustomerTickets', () => {
    it('throws NotFoundException when customer profile does not exist', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(null);

      await expect(
        service.findCustomerTickets(999, { page: 1, pageSize: 10 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns paginated tickets for authenticated customer', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.ve.count.mockResolvedValue(1);
      prisma.ve.findMany.mockResolvedValue([sampleTicket]);

      const result = await service.findCustomerTickets(1, {
        page: 1,
        pageSize: 10,
      });

      expect(result.data).toHaveLength(1);
      const ticket = result.data[0];
      expect(ticket.ticketId).toBe(1);
      expect(ticket.ticketCode).toBe('VE-001');
      expect(ticket.seatNumber).toBe('A01');
      expect(ticket.route).toBe('TP.HCM - Đà Lạt');
      expect(ticket.busCompanyName).toBe('Phương Trang');
      expect(ticket.price).toBe(250000);
      expect(result.meta.totalItems).toBe(1);
    });

    it('orders by createdAt desc and veId desc by default', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.ve.count.mockResolvedValue(1);
      prisma.ve.findMany.mockResolvedValue([sampleTicket]);

      await service.findCustomerTickets(1, { page: 1, pageSize: 10 });

      expect(prisma.ve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: 'desc' }, { veId: 'desc' }],
          include: expect.objectContaining({
            phieuDatVe: expect.objectContaining({
              include: expect.objectContaining({
                donGiaoDich: expect.objectContaining({
                  include: expect.objectContaining({
                    thanhToans: {
                      where: {
                        loaiGiaoDich: 'THANH_TOAN',
                        trangThai: 'THANH_CONG',
                      },
                      orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
                      take: 1,
                    },
                  }),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('orders by price and direction when requested', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.ve.count.mockResolvedValue(1);
      prisma.ve.findMany.mockResolvedValue([sampleTicket]);

      await service.findCustomerTickets(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'price',
        sortDirection: 'asc',
      });

      expect(prisma.ve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ giaThucTe: 'asc' }, { veId: 'asc' }],
        }),
      );
    });

    it('orders by departureTime and direction when requested', async () => {
      prisma.khachHang.findUnique.mockResolvedValue(mockCustomer);
      prisma.ve.count.mockResolvedValue(1);
      prisma.ve.findMany.mockResolvedValue([sampleTicket]);

      await service.findCustomerTickets(1, {
        page: 1,
        pageSize: 10,
        sortBy: 'departureTime',
        sortDirection: 'desc',
      });

      expect(prisma.ve.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [
            { gheChuyenXe: { chuyenXe: { ngayKhoiHanh: 'desc' } } },
            { gheChuyenXe: { chuyenXe: { gioKhoiHanh: 'desc' } } },
            { veId: 'desc' },
          ],
        }),
      );
    });
  });

  describe('findCustomerTicketById', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      prisma.ve.findUnique.mockResolvedValue(null);

      await expect(service.findCustomerTicketById(1, 999)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when ticket belongs to another customer', async () => {
      prisma.ve.findUnique.mockResolvedValue({
        ...sampleTicket,
        phieuDatVe: {
          ...sampleTicket.phieuDatVe,
          donGiaoDich: {
            ...sampleTicket.phieuDatVe.donGiaoDich,
            khachHang: { taiKhoanId: 888 },
          },
        },
      });

      await expect(service.findCustomerTicketById(1, 1)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('returns ticket detail wrapped in data envelope when authorized', async () => {
      prisma.ve.findUnique.mockResolvedValue(sampleTicket);

      const result = await service.findCustomerTicketById(1, 1);
      expect(result.data.ticketId).toBe(1);
      expect(result.data.seatNumber).toBe('A01');
      expect(result.data.passengerName).toBe('Nguyễn Văn A');
    });
  });

  describe('lookupTicket', () => {
    it('throws NotFoundException when ticket code does not exist', async () => {
      prisma.ve.findUnique.mockResolvedValue(null);

      await expect(
        service.lookupTicket({
          ticketCode: 'INVALID',
          phoneNumber: '0901234567',
        }),
      ).rejects.toMatchObject({
        response: {
          error: 'TICKET_NOT_FOUND',
          message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
        },
      });
    });

    it('throws NotFoundException when phone number does not match', async () => {
      prisma.ve.findUnique.mockResolvedValue(sampleTicket);

      await expect(
        service.lookupTicket({
          ticketCode: 'VE-001',
          phoneNumber: '0999999999',
        }),
      ).rejects.toMatchObject({
        response: {
          error: 'TICKET_NOT_FOUND',
          message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
        },
      });
    });

    it('returns ticket wrapped in data envelope when ticket code and phone match', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-24T07:00:00.000Z'));
      prisma.ve.findUnique.mockResolvedValue(sampleTicket);

      const result = await service.lookupTicket({
        ticketCode: 'VE-001',
        phoneNumber: '+84901234567',
      });

      expect(result.data.ticketId).toBe(1);
      expect(result.data.ticketCode).toBe('VE-001');
      expect(result.data.route).toBe('TP.HCM - Đà Lạt');
      expect(result.data.cancellation).toMatchObject({
        eligible: true,
        cancelFeeRate: 0.2,
        cancelFee: 50000,
        refundAmount: 200000,
      });
    });

    it.each([
      ['exactly 12 hours', '2026-09-24T13:00:00.000Z', 0.2],
      ['exactly 24 hours', '2026-09-24T01:00:00.000Z', 0.2],
      ['more than 24 hours', '2026-09-24T00:59:59.999Z', 0.1],
    ])(
      'quotes the correct fee %s before departure',
      async (_label, now, rate) => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(now));
        prisma.ve.findUnique.mockResolvedValue(sampleTicket);

        const result = await service.lookupTicket({
          ticketCode: 'VE-001',
          phoneNumber: '0901234567',
        });

        expect(result.data.cancellation.cancelFeeRate).toBe(rate);
      },
    );
  });

  describe('cancelTicket', () => {
    it('throws NotFoundException when ticket does not exist', async () => {
      prisma.ve.findUnique.mockResolvedValue(null);

      await expect(
        service.cancelTicket({
          ticketCode: 'INVALID',
          phoneNumber: '0901234567',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when ticket is already cancelled', async () => {
      prisma.ve.findUnique.mockResolvedValue({
        ...sampleTicket,
        trangThai: 'HUY',
      });

      await expect(
        service.cancelTicket({
          ticketCode: 'VE-001',
          phoneNumber: '0901234567',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects cancellation less than 12 hours before departure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-24T18:00:00.000Z'));
      prisma.ve.findUnique.mockResolvedValue(sampleTicket);

      await expect(
        service.cancelTicket({
          ticketCode: 'VE-001',
          phoneNumber: '0901234567',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          error: 'CANCELLATION_CUTOFF_PASSED',
        }),
      });
    });

    it('charges 20 percent from 12 through 24 hours before departure', async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-09-24T07:00:00.000Z'));
      prisma.ve.findUnique.mockResolvedValue(sampleTicket);
      prisma.ve.count.mockResolvedValue(0);

      const result = await service.cancelTicket({
        ticketCode: 'VE-001',
        phoneNumber: '0901234567',
      });

      expect(result.data.cancelFee).toBe(50000);
      expect(result.data.refundAmount).toBe(200000);
    });

    it('cancels ticket atomically and queues a 10 percent refund over 24 hours before departure', async () => {
      const futureTicket = {
        ...sampleTicket,
        gheChuyenXe: {
          ...sampleTicket.gheChuyenXe,
          chuyenXe: {
            ...sampleTicket.gheChuyenXe.chuyenXe,
            ngayKhoiHanh: new Date('2029-01-01T00:00:00.000Z'),
            gioKhoiHanh: new Date('1970-01-01T08:00:00.000Z'),
          },
        },
      };
      prisma.ve.findUnique.mockResolvedValue(futureTicket);
      prisma.ve.count.mockResolvedValue(0);

      const result = await service.cancelTicket({
        ticketCode: 'VE-001',
        phoneNumber: '0901234567',
      });

      expect(prisma.ve.updateMany).toHaveBeenCalledWith({
        where: { veId: 1, trangThai: { not: 'HUY' } },
        data: { trangThai: 'HUY' },
      });
      expect(prisma.gheChuyenXe.update).toHaveBeenCalledWith({
        where: { gheChuyenXeId: 11 },
        data: { trangThai: 'TRONG' },
      });
      expect(result.data.status).toBe('HUY');
      expect(result.data.cancelFee).toBe(25000);
      expect(result.data.refundAmount).toBe(225000);
      expect(prisma.thanhToan.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          phuongThuc: 'MOMO',
          loaiGiaoDich: 'HOAN_TIEN',
          trangThai: 'DANG_XU_LY',
          donGiaoDichId: 201,
          veId: 1,
        }),
      });
      expect(
        prisma.thanhToan.create.mock.calls[0][0].data.soTien.toString(),
      ).toBe('225000');
    });

    it('returns conflict when another request has already cancelled the ticket', async () => {
      const futureTicket = {
        ...sampleTicket,
        gheChuyenXe: {
          ...sampleTicket.gheChuyenXe,
          chuyenXe: {
            ...sampleTicket.gheChuyenXe.chuyenXe,
            ngayKhoiHanh: new Date('2029-01-01T00:00:00.000Z'),
          },
        },
      };
      prisma.ve.findUnique.mockResolvedValue(futureTicket);
      prisma.ve.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.cancelTicket({
          ticketCode: 'VE-001',
          phoneNumber: '0901234567',
        }),
      ).rejects.toThrow(ConflictException);

      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
    });

    it('maps a serialization conflict to a clear cancellation conflict', async () => {
      prisma.$transaction.mockRejectedValueOnce({ code: 'P2034' });

      await expect(
        service.cancelTicket({
          ticketCode: 'VE-001',
          phoneNumber: '0901234567',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
