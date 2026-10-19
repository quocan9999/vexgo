import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
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
      ngayTao: new Date(),
      trangThai: 'CHO_THANH_TOAN',
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

  let configService: any;

  beforeEach(() => {
    prisma = {
      phieuDatVe: {
        findUnique: vi.fn().mockResolvedValue({
          phieuDatVeId: 300,
          trangThai: 'CHO_THANH_TOAN',
          ves: [],
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      thanhToan: {
        findUnique: vi.fn(),
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      donGiaoDich: {
        findUnique: vi.fn().mockResolvedValue({
          donGiaoDichId: 200,
          trangThai: 'CHO_THANH_TOAN',
        }),
        update: vi.fn(),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      khachHang: {
        findUnique: vi.fn(),
      },
      ve: {
        updateMany: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
      },
      lichSuTrangThaiPhieuDatVe: {
        create: vi.fn(),
      },
      lichSuTrangThaiVe: {
        create: vi.fn(),
      },
      $queryRaw: vi.fn().mockResolvedValue([{ donGiaoDichId: 200 }]),
      $executeRaw: vi.fn().mockResolvedValue(1),
      $transaction: vi.fn(async (cb) => cb(prisma)),
    };

    configService = {
      get: vi.fn((key: string) => {
        if (key === 'PAYMENT_DEMO_MODE') return 'true';
        if (key === 'MOMO_SECRET_KEY') return 'vexgo_momo_demo_secret';
        if (key === 'VNPAY_HASH_SECRET') return 'vexgo_vnpay_demo_secret';
        if (key === 'ZALOPAY_KEY2') return 'vexgo_zalopay_demo_key2';
        return null;
      }),
    };

    service = new PaymentsService(prisma as unknown as PrismaService, configService);
  });

  describe('createPayment', () => {
    it('creates payment with DEMO mode marker when running in demo mode', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        createdAt: new Date(),
        tongTienBanDau: '300000',
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: 200,
        donGiaoDich: {
          donGiaoDichId: 200,
          ngayTao: new Date(),
          khachHangId: 10,
          tongTien: '300000',
          trangThai: 'CHO_THANH_TOAN',
        },
      });
      prisma.khachHang.findUnique.mockResolvedValue({
        khachHangId: 10,
        taiKhoanId: 1,
      });
      prisma.thanhToan.create.mockResolvedValue({
        ...samplePayment,
        soTien: '300000',
      });

      const result = await service.createPayment(300, 'MOMO', mockCustomerPrincipal);

      expect(result.paymentId).toBe(100);
      expect(result.amount).toBe(300000);
      expect(result.mode).toBe('DEMO');
      expect(result.status).toBe('PENDING');
      expect(result.paymentUrl).toContain('sandbox.momo.vn');
      expect(prisma.$executeRaw).toHaveBeenCalled();
    });

    it('rejects createPayment with ConflictException when booking is cancelled (discussion_r4226248027)', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'DA_HUY',
        donGiaoDich: { khachHangId: 10, trangThai: 'DA_HUY' },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });

      await expect(service.createPayment(300, 'MOMO', mockCustomerPrincipal)).rejects.toMatchObject({
        response: { error: 'BOOKING_CANCELLED' },
      });
      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
    });

    it('rejects createPayment with ConflictException when booking is already paid', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'DA_THANH_TOAN',
        donGiaoDich: { khachHangId: 10, trangThai: 'DA_THANH_TOAN' },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });

      await expect(service.createPayment(300, 'MOMO', mockCustomerPrincipal)).rejects.toMatchObject({
        response: { error: 'BOOKING_ALREADY_PAID' },
      });
      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
    });

    it('rejects createPayment with ConflictException when booking has invalid status', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'HOAN_TAT',
        donGiaoDich: { khachHangId: 10, trangThai: 'HOAN_TAT' },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });

      await expect(service.createPayment(300, 'MOMO', mockCustomerPrincipal)).rejects.toMatchObject({
        response: { error: 'INVALID_BOOKING_STATUS' },
      });
      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
    });

    it('rejects DANG_XU_LY on booking/order while keeping it as a payment-attempt state', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        createdAt: new Date(),
        trangThai: 'DANG_XU_LY',
        donGiaoDich: { khachHangId: 10, trangThai: 'DANG_XU_LY' },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });

      await expect(
        service.createPayment(300, 'MOMO', mockCustomerPrincipal),
      ).rejects.toMatchObject({
        response: { error: 'INVALID_BOOKING_STATUS' },
      });
      expect(prisma.thanhToan.findMany).not.toHaveBeenCalled();
      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('returns existing pending payment without creating duplicate if already exists (idempotency)', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        createdAt: new Date(),
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: 200,
        donGiaoDich: {
          khachHangId: 10,
          ngayTao: new Date(),
          trangThai: 'CHO_THANH_TOAN',
        },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });
      prisma.thanhToan.findMany.mockResolvedValue([
        {
          thanhToanId: 888,
          soTien: '300000',
          trangThai: 'DANG_XU_LY',
          phuongThuc: 'MOMO',
          createdAt: new Date('2026-03-30T10:00:00.000Z'),
        },
      ]);

      const result = await service.createPayment(300, 'MOMO', mockCustomerPrincipal);

      expect(result.paymentId).toBe(888);
      expect(result.status).toBe('PENDING');
      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
    });

    it('supersedes previous active payment of different provider to THAT_BAI when switching providers (Finding B)', async () => {
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        createdAt: new Date(),
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: 200,
        donGiaoDich: {
          donGiaoDichId: 200,
          ngayTao: new Date(),
          khachHangId: 10,
          trangThai: 'CHO_THANH_TOAN',
          tongTien: '300000',
        },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });
      // Existing active attempt is MOMO
      prisma.thanhToan.findMany.mockResolvedValue([
        {
          thanhToanId: 777,
          soTien: '300000',
          trangThai: 'DANG_XU_LY',
          phuongThuc: 'MOMO',
          createdAt: new Date('2026-03-30T10:00:00.000Z'),
        },
      ]);
      prisma.thanhToan.create.mockResolvedValue({
        thanhToanId: 999,
        soTien: '300000',
        phuongThuc: 'VNPAY',
        trangThai: 'DANG_XU_LY',
        createdAt: new Date('2026-03-30T10:05:00.000Z'),
      });

      const result = await service.createPayment(300, 'VNPAY', mockCustomerPrincipal);

      expect(result.paymentId).toBe(999);
      expect(result.provider).toBe('VNPAY');
      // Previous attempt #777 must be superseded to THAT_BAI
      expect(prisma.thanhToan.updateMany).toHaveBeenCalledWith({
        where: { thanhToanId: { in: [777] } },
        data: { trangThai: 'THAT_BAI' },
      });
      expect(prisma.thanhToan.create).toHaveBeenCalled();
    });

    it('throws ServiceUnavailableException when PAYMENT_DEMO_MODE is not true even if pending payment exists in DB (Finding A)', async () => {
      const prodConfigService = {
        get: vi.fn((key: string) => (key === 'PAYMENT_DEMO_MODE' ? 'false' : null)),
      };
      const prodService = new PaymentsService(prisma as unknown as PrismaService, prodConfigService as any);

      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: 200,
        donGiaoDich: { khachHangId: 10, trangThai: 'CHO_THANH_TOAN' },
      });
      prisma.khachHang.findUnique.mockResolvedValue({ khachHangId: 10, taiKhoanId: 1 });
      prisma.thanhToan.findMany.mockResolvedValue([
        {
          thanhToanId: 888,
          soTien: '300000',
          trangThai: 'DANG_XU_LY',
          phuongThuc: 'MOMO',
        },
      ]);

      await expect(prodService.createPayment(300, 'MOMO', mockCustomerPrincipal)).rejects.toThrowError(
        /Cổng thanh toán MOMO chưa được cấu hình cho môi trường thực tế/,
      );
      // Ensure no transaction or payment query was executed
      expect(prisma.thanhToan.create).not.toHaveBeenCalled();
    });

    it('rejects webhook signatures when secrets are unconfigured in non-demo mode (discussion_r4220529064 & r4199181810)', () => {
      const emptySecretConfig = {
        get: vi.fn(() => null), // Fail-closed default: isDemoMode = false, secrets = ''
      };
      const strictService = new PaymentsService(prisma as unknown as PrismaService, emptySecretConfig as any);
      expect(strictService.isDemoMode).toBe(false);
      expect(strictService.momoSecretKey).toBe('');
      expect(strictService.vnpayHashSecret).toBe('');
      expect(strictService.zalopayKey2).toBe('');

      expect(strictService.verifyMomoSignature({ signature: 'any' } as any)).toBe(false);
      expect(strictService.verifyVnpaySignature({ vnp_SecureHash: 'any' } as any)).toBe(false);
      expect(strictService.verifyZaloPayMac({ mac: 'any', data: '{}' } as any)).toBe(false);
    });
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
    it('returns PAYMENT_ORDER_STATE_CHANGED when a successful payment has an incompatible order status', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue({
        ...samplePayment,
        trangThai: 'THANH_CONG',
        donGiaoDich: {
          ...samplePayment.donGiaoDich,
          trangThai: 'MOI_TAO',
        },
      });

      await expect(
        service.confirmPaymentSuccess({
          paymentId: 100,
          provider: 'MOMO',
          amount: 300000,
        }),
      ).rejects.toMatchObject({
        response: {
          error: 'PAYMENT_ORDER_STATE_CHANGED',
          message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
        },
        status: 409,
      });
      expect(prisma.donGiaoDich.updateMany).not.toHaveBeenCalled();
    });

    it('atomically updates payment, transaction, and booking to DA_THANH_TOAN', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(prisma.thanhToan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { thanhToanId: 100, trangThai: { not: 'THANH_CONG' } },
          data: { trangThai: 'THANH_CONG' },
        }),
      );
      expect(prisma.donGiaoDich.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { donGiaoDichId: 200, trangThai: 'CHO_THANH_TOAN' },
          data: { trangThai: 'DA_THANH_TOAN' },
        }),
      );
      expect(prisma.phieuDatVe.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phieuDatVeId: 300, trangThai: 'CHO_THANH_TOAN' },
          data: { trangThai: 'DA_THANH_TOAN' },
        }),
      );
    });

    it('does not revive cancelled booking or tickets upon receiving late webhook (discussion_r4222294102)', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'DA_HUY',
        ves: [{ veId: 501, trangThai: 'DA_HUY' }],
      });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(result.isLatePayment).toBe(true);
      expect(prisma.thanhToan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { thanhToanId: 100, trangThai: { not: 'THANH_CONG' } },
          data: { trangThai: 'THANH_CONG' },
        }),
      );
      expect(prisma.phieuDatVe.updateMany).not.toHaveBeenCalled();
      expect(prisma.ve.updateMany).not.toHaveBeenCalled();
      expect(prisma.lichSuTrangThaiPhieuDatVe.create).not.toHaveBeenCalled();
    });

    it('is idempotent if payment was already marked THANH_CONG', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue({
        ...samplePayment,
        trangThai: 'THANH_CONG',
      });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(prisma.thanhToan.updateMany).not.toHaveBeenCalled();
    });

    it('stores the SePay transaction ID atomically with the successful payment claim', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue({
        ...samplePayment,
        phuongThuc: 'SEPAY',
        maGiaoDichSePay: null,
      });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'SEPAY',
        amount: 300000,
        providerTransactionId: '987654321',
      });

      expect(result.success).toBe(true);
      expect(prisma.thanhToan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            thanhToanId: 100,
            trangThai: { not: 'THANH_CONG' },
            maGiaoDichSePay: null,
          },
          data: {
            trangThai: 'THANH_CONG',
            maGiaoDichSePay: '987654321',
          },
        }),
      );
    });

    it('rejects a different SePay transaction ID for an already claimed payment', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue({
        ...samplePayment,
        phuongThuc: 'SEPAY',
        trangThai: 'THANH_CONG',
        maGiaoDichSePay: '987654321',
      });

      await expect(
        service.confirmPaymentSuccess({
          paymentId: 100,
          provider: 'SEPAY',
          amount: 300000,
          providerTransactionId: '987654322',
        }),
      ).rejects.toMatchObject({
        response: { error: 'SEPAY_TRANSACTION_ALREADY_PROCESSED' },
      });
      expect(prisma.thanhToan.updateMany).not.toHaveBeenCalled();
    });

    it('returns idempotent success without mutating downstream records when concurrent claim is lost (discussion_r4222294112)', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      // Simulate that another concurrent transaction already claimed the record
      prisma.thanhToan.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Giao dịch đã được xác nhận trước đó.');
      expect(prisma.phieuDatVe.updateMany).not.toHaveBeenCalled();
      expect(prisma.ve.updateMany).not.toHaveBeenCalled();
      expect(prisma.lichSuTrangThaiPhieuDatVe.create).not.toHaveBeenCalled();
    });

    it('does not revive booking or tickets when donGiaoDich is cancelled upon receiving late webhook (Finding 1 / discussion_r4226248027)', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      prisma.donGiaoDich.findUnique.mockResolvedValue({
        donGiaoDichId: 200,
        trangThai: 'DA_HUY',
      });
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'CHO_THANH_TOAN',
        ves: [{ veId: 501, trangThai: 'CHO_THANH_TOAN' }],
      });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(result.isLatePayment).toBe(true);
      expect(prisma.phieuDatVe.updateMany).not.toHaveBeenCalled();
      expect(prisma.ve.updateMany).not.toHaveBeenCalled();
      expect(prisma.lichSuTrangThaiPhieuDatVe.create).not.toHaveBeenCalled();
    });

    it('does not mutate booking or tickets if donGiaoDich updateMany returns count 0 (Finding 1 CAS check)', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      prisma.donGiaoDich.findUnique.mockResolvedValue({
        donGiaoDichId: 200,
        trangThai: 'CHO_THANH_TOAN',
      });
      prisma.donGiaoDich.findUnique
        .mockResolvedValueOnce({
          donGiaoDichId: 200,
          trangThai: 'CHO_THANH_TOAN',
        })
        .mockResolvedValueOnce({
          donGiaoDichId: 200,
          trangThai: 'DA_HUY',
        });
      prisma.donGiaoDich.updateMany.mockResolvedValue({ count: 0 }); // Concurrently cancelled
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'CHO_THANH_TOAN',
        ves: [{ veId: 501, trangThai: 'CHO_THANH_TOAN' }],
      });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(result.isLatePayment).toBe(true);
      expect(prisma.phieuDatVe.updateMany).not.toHaveBeenCalled();
      expect(prisma.ve.updateMany).not.toHaveBeenCalled();
      expect(prisma.lichSuTrangThaiPhieuDatVe.create).not.toHaveBeenCalled();
    });

    it('rolls back settlement when the booking state cannot be claimed', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);
      prisma.donGiaoDich.findUnique.mockResolvedValue({
        donGiaoDichId: 200,
        trangThai: 'CHO_THANH_TOAN',
      });
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'KHONG_HOP_LE',
        ves: [],
      });
      prisma.phieuDatVe.updateMany.mockResolvedValue({ count: 0 });

      await expect(
        service.confirmPaymentSuccess({
          paymentId: 100,
          provider: 'MOMO',
          amount: 300000,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('does not re-settle transaction and booking when callback arrives for superseded attempt and transaction is already DA_THANH_TOAN (Finding B)', async () => {
      // Payment 100 was superseded to THAT_BAI when user switched provider
      const supersededPayment = {
        ...samplePayment,
        trangThai: 'THAT_BAI',
      };
      prisma.thanhToan.findUnique.mockResolvedValue(supersededPayment);
      prisma.donGiaoDich.findUnique.mockResolvedValue({
        donGiaoDichId: 200,
        trangThai: 'DA_THANH_TOAN', // Already settled by another attempt
      });
      prisma.phieuDatVe.findUnique.mockResolvedValue({
        phieuDatVeId: 300,
        trangThai: 'DA_THANH_TOAN',
        ves: [{ veId: 501, trangThai: 'DA_THANH_TOAN' }],
      });

      const result = await service.confirmPaymentSuccess({
        paymentId: 100,
        provider: 'MOMO',
        amount: 300000,
      });

      expect(result.success).toBe(true);
      expect(result.requiresReconciliation).toBe(true);
      // Payment itself was claimed as THANH_CONG
      expect(prisma.thanhToan.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { thanhToanId: 100, trangThai: { not: 'THANH_CONG' } },
          data: { trangThai: 'THANH_CONG' },
        }),
      );
      // But DonGiaoDich and PhieuDatVe were NOT mutated again
      expect(prisma.donGiaoDich.updateMany).not.toHaveBeenCalled();
      expect(prisma.phieuDatVe.updateMany).not.toHaveBeenCalled();
      expect(prisma.lichSuTrangThaiPhieuDatVe.create).not.toHaveBeenCalled();
    });

    it('rejects confirmation with BadRequestException when provider mismatches (discussion_r4164957958)', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment); // phuongThuc: MOMO

      await expect(
        service.confirmPaymentSuccess({
          paymentId: 100,
          provider: 'VNPAY',
          amount: 300000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects confirmation with BadRequestException when amount mismatches (discussion_r4164957969)', async () => {
      prisma.thanhToan.findUnique.mockResolvedValue(samplePayment); // soTien: 300000

      await expect(
        service.confirmPaymentSuccess({
          paymentId: 100,
          provider: 'MOMO',
          amount: 150000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([0, -1, Number.NaN, 300000.4])(
      'rejects invalid non-positive, non-finite, or fractional VND amount %s',
      async (amount) => {
        prisma.thanhToan.findUnique.mockResolvedValue(samplePayment);

        await expect(
          service.confirmPaymentSuccess({
            paymentId: 100,
            provider: 'MOMO',
            amount,
          }),
        ).rejects.toThrow(BadRequestException);

        expect(prisma.thanhToan.updateMany).not.toHaveBeenCalled();
        expect(prisma.$transaction).not.toHaveBeenCalled();
      },
    );
  });

  describe('Signature Verifications & Webhook Handlers', () => {
    const sepayAccountNumber = '0012345678';
    const sepayTransactionDate = new Date(Date.now() + 7 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 19)
      .replace('T', ' ');
    const rawBody = Buffer.from(
      JSON.stringify({
        id: 123,
        accountNumber: sepayAccountNumber,
        transferAmount: 150000,
      }),
    );
    const timestamp = String(Math.floor(Date.now() / 1000));
    const makeSepaySignature = (body: Buffer, signedAt: string, secret: string) =>
      `sha256=${createHmac('sha256', secret)
        .update(`${signedAt}.`)
        .update(body)
        .digest('hex')}`;
    const setSepayConfig = (secret: string, accountNumber?: unknown) => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'SEPAY_WEBHOOK_SECRET') return secret;
        if (key === 'SEPAY_ACCOUNT_NUMBER') return accountNumber;
        return null;
      });
    };

    it('fails closed when the SePay HMAC secret is not configured', async () => {
      await expect(
        service.handleSepayWebhook({
          rawBody,
          timestamp,
          signature: `sha256=${'a'.repeat(64)}`,
        }),
      )
        .rejects.toThrow(ServiceUnavailableException);
    });

    it('validates the SePay HMAC signature before parsing a signed event', async () => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, sepayAccountNumber);

      await expect(
        service.handleSepayWebhook({
          rawBody,
          timestamp,
          signature: 'sha256=' + 'a'.repeat(64),
        }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.handleSepayWebhook({
          rawBody,
          timestamp: String(Number(timestamp) - 301),
          signature: makeSepaySignature(rawBody, String(Number(timestamp) - 301), secret),
        }),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.handleSepayWebhook({
          rawBody,
          timestamp,
          signature: makeSepaySignature(rawBody, timestamp, secret),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['whitespace-only', '   '],
      ['surrounded by whitespace', ` ${sepayAccountNumber} `],
      ['containing whitespace', '0012 345678'],
    ])('fails closed when the SePay account configuration is %s', async (_label, configuredAccount) => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, configuredAccount);
      const body = Buffer.from(
        JSON.stringify({
          id: 12345,
          accountNumber: sepayAccountNumber,
          code: 'ORDER-1',
          content: 'ORDER-1',
          transferType: 'in',
          transferAmount: 300000,
        }),
      );
      const settle = vi.spyOn(service, 'confirmPaymentSuccess');

      await expect(
        service.handleSepayWebhook({
          rawBody: body,
          timestamp,
          signature: makeSepaySignature(body, timestamp, secret),
        }),
      ).rejects.toMatchObject({
        response: { error: 'SEPAY_ACCOUNT_NOT_CONFIGURED' },
      });
      expect(prisma.donGiaoDich.findUnique).not.toHaveBeenCalled();
      expect(prisma.thanhToan.findUnique).not.toHaveBeenCalled();
      expect(settle).not.toHaveBeenCalled();
    });

    it.each([
      ['missing', undefined, false, 'SEPAY_ACCOUNT_NUMBER_INVALID'],
      ['null', null, true, 'SEPAY_ACCOUNT_NUMBER_INVALID'],
      ['number', 12345678, true, 'SEPAY_ACCOUNT_NUMBER_INVALID'],
      ['empty', '', true, 'SEPAY_ACCOUNT_NUMBER_INVALID'],
      ['whitespace-only', '   ', true, 'SEPAY_ACCOUNT_NUMBER_INVALID'],
      ['containing whitespace', '0012 345678', true, 'SEPAY_ACCOUNT_NUMBER_INVALID'],
      ['different account with leading zero', '0012345679', true, 'SEPAY_ACCOUNT_MISMATCH'],
      ['same digits without leading zero', '12345678', true, 'SEPAY_ACCOUNT_MISMATCH'],
    ])('rejects a SePay event with %s accountNumber before database lookups', async (_label, accountNumber, includeAccountNumber, expectedError) => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, sepayAccountNumber);
      const payload: Record<string, unknown> = {
        id: 12345,
        code: 'ORDER-1',
        content: 'ORDER-1',
        transferType: 'in',
        transferAmount: 300000,
      };
      if (includeAccountNumber) payload.accountNumber = accountNumber;
      const body = Buffer.from(JSON.stringify(payload));
      const settle = vi.spyOn(service, 'confirmPaymentSuccess');

      await expect(
        service.handleSepayWebhook({
          rawBody: body,
          timestamp,
          signature: makeSepaySignature(body, timestamp, secret),
        }),
      ).rejects.toMatchObject({
        response: { error: expectedError },
      });
      expect(prisma.donGiaoDich.findUnique).not.toHaveBeenCalled();
      expect(prisma.thanhToan.findUnique).not.toHaveBeenCalled();
      expect(prisma.thanhToan.findFirst).not.toHaveBeenCalled();
      expect(settle).not.toHaveBeenCalled();
    });

    it('rejects a replay with a mismatched destination account before checking its transaction ID', async () => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, sepayAccountNumber);
      prisma.thanhToan.findUnique.mockResolvedValue({
        ...samplePayment,
        phuongThuc: 'SEPAY',
        trangThai: 'THANH_CONG',
        maGiaoDichSePay: '12345',
      });
      const body = Buffer.from(JSON.stringify({
        id: 12345,
        accountNumber: '0099999999',
        code: 'ORDER-1',
        content: 'ORDER-1',
        transferType: 'in',
        transferAmount: 300000,
      }));

      await expect(
        service.handleSepayWebhook({
          rawBody: body,
          timestamp,
          signature: makeSepaySignature(body, timestamp, secret),
        }),
      ).rejects.toMatchObject({
        response: { error: 'SEPAY_ACCOUNT_MISMATCH' },
      });
      expect(prisma.thanhToan.findUnique).not.toHaveBeenCalled();
      expect(prisma.donGiaoDich.findUnique).not.toHaveBeenCalled();
    });

    it.each([
      ['FUTAGD29612020BAC94BCEA507A24A8D759B', 'FUTAGD29612020BAC94BCEA507A24A8D759B'],
      ['FUTAGD29612020BAC94BCEA507A24A8D759B', 'FUTA-GD-29612020BAC94BCEA507A24A8D759B'],
      ['FUTA-GD-29612020BAC94BCEA507A24A8D759B', 'FUTA-GD-29612020BAC94BCEA507A24A8D759B'],
    ])('matches complete content %s to order %s despite a truncated provider code', async (content, orderCode) => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, sepayAccountNumber);
      const order = { donGiaoDichId: 200, tongTien: '300000', phieuDatVe: { phieuDatVeId: 300 } };
      prisma.donGiaoDich.findUnique.mockImplementation(async ({ where }: any) =>
        where.maDonGiaoDich === orderCode ? order : null,
      );
      prisma.thanhToan.findFirst.mockResolvedValue({ ...samplePayment, phuongThuc: 'SEPAY' });
      const settle = vi.spyOn(service, 'confirmPaymentSuccess').mockResolvedValue({ success: true } as any);
      const body = Buffer.from(JSON.stringify({
        id: 12345, accountNumber: sepayAccountNumber, transactionDate: sepayTransactionDate, code: 'AGD29612020BAC', content, transferType: 'in', transferAmount: 300000,
      }));
      await service.handleSepayWebhook({ rawBody: body, timestamp, signature: makeSepaySignature(body, timestamp, secret) });
      expect(settle).toHaveBeenCalledOnce();
      expect(settle).toHaveBeenCalledWith(expect.objectContaining({ provider: 'SEPAY', providerTransactionId: '12345' }));
    });

    it('rejects code and content identifying different orders without settlement', async () => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, sepayAccountNumber);
      prisma.donGiaoDich.findUnique.mockImplementation(async ({ where }: any) => ({
        donGiaoDichId: where.maDonGiaoDich === 'ORDER-A' ? 200 : 201,
        phieuDatVe: { phieuDatVeId: 300 },
      }));
      const settle = vi.spyOn(service, 'confirmPaymentSuccess');
      const body = Buffer.from(JSON.stringify({ id: 12345, accountNumber: sepayAccountNumber, transactionDate: sepayTransactionDate, code: 'ORDER-A', content: 'ORDER-B', transferType: 'in', transferAmount: 300000 }));
      await expect(service.handleSepayWebhook({ rawBody: body, timestamp, signature: makeSepaySignature(body, timestamp, secret) })).rejects.toMatchObject({ response: { error: 'SEPAY_REFERENCE_MISMATCH' } });
      expect(settle).not.toHaveBeenCalled();
    });

    it('rejects incomplete transfer references without attempting settlement', async () => {
      const secret = 'sepay-hmac-test-secret';
      setSepayConfig(secret, sepayAccountNumber);
      prisma.donGiaoDich.findUnique.mockResolvedValue(null);
      const settle = vi.spyOn(service, 'confirmPaymentSuccess');
      const body = Buffer.from(JSON.stringify({ id: 12345, accountNumber: sepayAccountNumber, transactionDate: sepayTransactionDate, code: 'AGD29612020BAC', content: 'FUTAGD29612020BAC', transferType: 'in', transferAmount: 300000 }));
      await expect(service.handleSepayWebhook({ rawBody: body, timestamp, signature: makeSepaySignature(body, timestamp, secret) })).rejects.toMatchObject({ response: { error: 'SEPAY_ORDER_NOT_FOUND' } });
      expect(settle).not.toHaveBeenCalled();
    });

    it('verifies valid MoMo HMAC-SHA256 signature and rejects forged ones', () => {
      const raw = `accessKey=DEMO&amount=100000&extraData=100&message=Success&orderId=100&orderInfo=Test&orderType=momo_wallet&partnerCode=MOMO&payType=qr&requestId=REQ100&responseTime=123456&resultCode=0&transId=999`;
      const validSig = createHmac('sha256', service.momoSecretKey)
        .update(raw)
        .digest('hex');

      const validDto = {
        accessKey: 'DEMO',
        amount: 100000,
        extraData: '100',
        message: 'Success',
        orderId: '100',
        orderInfo: 'Test',
        orderType: 'momo_wallet',
        partnerCode: 'MOMO',
        payType: 'qr',
        requestId: 'REQ100',
        responseTime: 123456,
        resultCode: 0,
        transId: 999,
        signature: validSig,
      };

      expect(service.verifyMomoSignature(validDto)).toBe(true);
      expect(
        service.verifyMomoSignature({ ...validDto, signature: 'invalid_sig' }),
      ).toBe(false);
    });

    it('rejects MoMo webhook with invalid signature with BadRequestException', async () => {
      await expect(
        service.handleMomoWebhook({
          orderId: '100',
          signature: 'invalid_sig',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects VNPay webhook with invalid signature with BadRequestException', async () => {
      await expect(
        service.handleVnpayWebhook({
          vnp_TxnRef: '100',
          vnp_SecureHash: 'invalid_hash',
        } as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects ZaloPay webhook with invalid MAC with BadRequestException', async () => {
      await expect(
        service.handleZaloPayWebhook({
          app_trans_id: '100',
          data: '{"app_trans_id":100}',
          mac: 'invalid_mac',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
