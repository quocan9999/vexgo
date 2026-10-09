import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
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
        tongTienBanDau: '300000',
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: 200,
        donGiaoDich: {
          donGiaoDichId: 200,
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

    it('returns existing pending payment without creating duplicate if already exists (idempotency)', async () => {
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
        trangThai: 'CHO_THANH_TOAN',
        donGiaoDichId: 200,
        donGiaoDich: {
          donGiaoDichId: 200,
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
          where: { donGiaoDichId: 200, trangThai: { notIn: ['DA_HUY', 'HUY'] } },
          data: { trangThai: 'DA_THANH_TOAN' },
        }),
      );
      expect(prisma.phieuDatVe.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { phieuDatVeId: 300, trangThai: { in: ['CHO_THANH_TOAN', 'DANG_XU_LY'] } },
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
  });

  describe('Signature Verifications & Webhook Handlers', () => {
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
