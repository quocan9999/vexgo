import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PaymentsService } from '../../../src/payments/payments.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prisma: any;

  const mockCustomerPrincipal: AuthPrincipal = {
    taiKhoanId: 1,
    sessionId: 'sess-1',
    roles: ['CUSTOMER'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };

  const otherCustomerPrincipal: AuthPrincipal = {
    taiKhoanId: 2,
    sessionId: 'sess-2',
    roles: ['CUSTOMER'],
    permissions: [],
    nhanVienId: null,
    nhaXeId: null,
  };

  const samplePayment = {
    thanhToanId: 100,
    soTien: '300000',
    phuongThuc: 'MOMO',
    loaiGiaoDich: 'THANH_TOAN',
    thoiGian: new Date('2026-10-06T10:00:00Z'),
    trangThai: 'DANG_XU_LY',
    donGiaoDichId: 200,
    createdAt: new Date('2026-10-06T10:00:00Z'),
    updatedAt: new Date('2026-10-06T10:00:00Z'),
    donGiaoDich: {
      donGiaoDichId: 200,
      khachHangId: 10,
      phieuDatVe: {
        phieuDatVeId: 300,
      },
      khachHang: {
        khachHangId: 10,
        taiKhoanId: 1,
      },
    },
  };

  beforeEach(() => {
    prisma = {
      phieuDatVe: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
      thanhToan: {
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
      },
      donGiaoDich: {
        update: vi.fn(),
      },
      khachHang: {
        findUnique: vi.fn(),
      },
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    service = new PaymentsService(prisma as unknown as PrismaService);
  });

  describe('getPaymentStatus', () => {
    it('is strictly read-only and does not mutate status', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      prisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: 10,
        taiKhoanId: 1,
      });

      const result = await service.getPaymentStatus(100, mockCustomerPrincipal);

      expect(result.status).toBe('PENDING');
      expect(result.amount).toBe(300000);
      expect(prisma.thanhToan.update).not.toHaveBeenCalled();
      expect(prisma.donGiaoDich.update).not.toHaveBeenCalled();
    });

    it('rejects access when customer does not own the payment', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      prisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: 99,
        taiKhoanId: 2,
      });

      await expect(
        service.getPaymentStatus(100, otherCustomerPrincipal),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when payment does not exist', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentStatus(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('confirmPaymentSuccess', () => {
    it('atomically updates payment, transaction, and booking to DA_THANH_TOAN', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);

      const result = await service.confirmPaymentSuccess(100);

      expect(result.success).toBe(true);
      expect(prisma.thanhToan.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { thanhToanId: 100 },
          data: { trangThai: 'THANH_CONG' },
        }),
      );
      expect(prisma.donGiaoDich.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { donGiaoDichId: 200 },
          data: { trangThai: 'DA_THANH_TOAN' },
        }),
      );
      expect(prisma.phieuDatVe.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phieuDatVeId: 300 },
          data: { trangThai: 'DA_THANH_TOAN' },
        }),
      );
    });
  });
});
