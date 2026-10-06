import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PaymentsService } from '../../../src/payments/payments.service.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import type { MomoPaymentProvider } from '../../../src/payments/providers/momo-payment.provider.js';
import type { VnpayPaymentProvider } from '../../../src/payments/providers/vnpay-payment.provider.js';

describe('PaymentsService', () => {
  let service: PaymentsService;

  const mockBooking = {
    phieuDatVeId: 101,
    maPhieuDatVe: 'BK-101',
    trangThai: 'CHO_THANH_TOAN',
    donGiaoDichId: 55,
    donGiaoDich: {
      donGiaoDichId: 55,
      tongTien: 280000,
      trangThai: 'CHO_THANH_TOAN',
    },
  };

  const mockCreatedPayment = {
    thanhToanId: 201,
    soTien: 280000,
    phuongThuc: 'MOMO',
    loaiGiaoDich: 'THANH_TOAN',
    thoiGian: new Date(),
    trangThai: 'DANG_XU_LY',
    donGiaoDichId: 55,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTx = {
    thanhToan: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    donGiaoDich: {
      update: vi.fn(),
    },
    phieuDatVe: {
      update: vi.fn(),
    },
    ve: {
      updateMany: vi.fn(),
    },
    gheChuyenXe: {
      updateMany: vi.fn(),
    },
    hoaDon: {
      upsert: vi.fn(),
    },
  };

  const prisma = {
    phieuDatVe: {
      findUnique: vi.fn(),
    },
    thanhToan: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(async (cb) => cb(mockTx)),
  } as unknown as PrismaService;

  const momoProvider = {
    createPayment: vi.fn(),
    verifyIpn: vi.fn(),
  } as unknown as MomoPaymentProvider;

  const vnpayProvider = {
    createPayment: vi.fn(),
    verifyIpn: vi.fn(),
  } as unknown as VnpayPaymentProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new PaymentsService(prisma, momoProvider, vnpayProvider);
  });

  describe('createPayment', () => {
    it('creates MoMo payment session and returns payUrl', async () => {
      vi.mocked(prisma.phieuDatVe.findUnique).mockResolvedValue(
        mockBooking as any,
      );
      vi.mocked(prisma.thanhToan.create).mockResolvedValue(
        mockCreatedPayment as any,
      );
      vi.mocked(momoProvider.createPayment).mockResolvedValue({
        paymentUrl: 'https://test-payment.momo.vn/pay?s=123',
        qrCodeUrl: 'https://test-payment.momo.vn/qr/123',
        deeplink: 'momo://app?123',
      });

      const result = await service.createPayment({
        bookingId: 101,
        provider: 'MOMO',
      });

      expect(prisma.phieuDatVe.findUnique).toHaveBeenCalledWith({
        where: { phieuDatVeId: 101 },
        include: { donGiaoDich: true },
      });
      expect(prisma.thanhToan.create).toHaveBeenCalled();
      expect(momoProvider.createPayment).toHaveBeenCalled();
      expect(result.data.paymentId).toBe(201);
      expect(result.data.provider).toBe('MOMO');
      expect(result.data.amount).toBe(280000);
      expect(result.data.paymentUrl).toBe(
        'https://test-payment.momo.vn/pay?s=123',
      );
      expect(result.data.status).toBe('DANG_XU_LY');
    });

    it('creates VNPay payment session when provider is VNPAY', async () => {
      vi.mocked(prisma.phieuDatVe.findUnique).mockResolvedValue(
        mockBooking as any,
      );
      vi.mocked(prisma.thanhToan.create).mockResolvedValue({
        ...mockCreatedPayment,
        phuongThuc: 'VNPAY',
      } as any);
      vi.mocked(vnpayProvider.createPayment).mockResolvedValue({
        paymentUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html?vnp_Amount=28000000',
      });

      const result = await service.createPayment({
        bookingId: 101,
        provider: 'VNPAY',
      });

      expect(vnpayProvider.createPayment).toHaveBeenCalled();
      expect(result.data.provider).toBe('VNPAY');
      expect(result.data.paymentUrl).toContain('sandbox.vnpayment.vn');
    });

    it('throws NotFoundException when booking does not exist', async () => {
      vi.mocked(prisma.phieuDatVe.findUnique).mockResolvedValue(null);

      await expect(
        service.createPayment({ bookingId: 999, provider: 'MOMO' }),
      ).rejects.toThrow();
    });

    it('throws BadRequestException when booking is already paid', async () => {
      vi.mocked(prisma.phieuDatVe.findUnique).mockResolvedValue({
        ...mockBooking,
        trangThai: 'DA_THANH_TOAN',
      } as any);

      await expect(
        service.createPayment({ bookingId: 101, provider: 'MOMO' }),
      ).rejects.toThrow();
    });
  });

  describe('completeBookingPayment', () => {
    it('executes transaction and marks payment, booking, tickets, and seats as paid', async () => {
      mockTx.thanhToan.findUnique.mockResolvedValue({
        ...mockCreatedPayment,
        trangThai: 'DANG_XU_LY',
        donGiaoDich: {
          donGiaoDichId: 55,
          phieuDatVe: {
            phieuDatVeId: 101,
            ves: [
              { veId: 1, gheChuyenXeId: 501 },
              { veId: 2, gheChuyenXeId: 502 },
            ],
          },
        },
      });

      mockTx.thanhToan.update.mockResolvedValue({
        ...mockCreatedPayment,
        trangThai: 'THANH_CONG',
      });

      await service.completeBookingPayment(201, 'TRANS_123');

      expect(mockTx.thanhToan.update).toHaveBeenCalledWith({
        where: { thanhToanId: 201 },
        data: expect.objectContaining({ trangThai: 'THANH_CONG' }),
      });
      expect(mockTx.donGiaoDich.update).toHaveBeenCalledWith({
        where: { donGiaoDichId: 55 },
        data: { trangThai: 'DA_THANH_TOAN' },
      });
      expect(mockTx.phieuDatVe.update).toHaveBeenCalledWith({
        where: { phieuDatVeId: 101 },
        data: { trangThai: 'DA_THANH_TOAN' },
      });
      expect(mockTx.ve.updateMany).toHaveBeenCalledWith({
        where: { phieuDatVeId: 101 },
        data: { trangThai: 'DA_DAT' },
      });
      expect(mockTx.gheChuyenXe.updateMany).toHaveBeenCalledWith({
        where: { gheChuyenXeId: { in: [501, 502] } },
        data: { trangThai: 'DA_DAT' },
      });
      expect(mockTx.hoaDon.upsert).toHaveBeenCalled();
    });

    it('returns early when payment is already THANH_CONG (idempotent)', async () => {
      mockTx.thanhToan.findUnique.mockResolvedValue({
        ...mockCreatedPayment,
        trangThai: 'THANH_CONG',
      });

      await service.completeBookingPayment(201, 'TRANS_123');

      expect(mockTx.thanhToan.update).not.toHaveBeenCalled();
      expect(mockTx.phieuDatVe.update).not.toHaveBeenCalled();
    });
  });

  describe('handleMomoIpn', () => {
    it('confirms payment when MoMo IPN is valid and successful', async () => {
      vi.mocked(momoProvider.verifyIpn).mockResolvedValue({
        isValid: true,
        isSuccess: true,
        paymentId: 201,
        amount: 280000,
        transactionNo: 'MOMO_123',
      });

      mockTx.thanhToan.findUnique.mockResolvedValue({
        ...mockCreatedPayment,
        trangThai: 'DANG_XU_LY',
        donGiaoDich: { phieuDatVe: { phieuDatVeId: 101, ves: [] } },
      });

      const res = await service.handleMomoIpn({ orderId: '201' });

      expect(res.resultCode).toBe(0);
      expect(momoProvider.verifyIpn).toHaveBeenCalled();
    });

    it('returns error code when signature is invalid', async () => {
      vi.mocked(momoProvider.verifyIpn).mockResolvedValue({
        isValid: false,
        isSuccess: false,
        paymentId: 201,
        amount: 280000,
      });

      const res = await service.handleMomoIpn({ orderId: '201' });

      expect(res.resultCode).toBe(99);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe('handleVnpayIpn', () => {
    it('confirms payment when VNPay IPN is valid and successful', async () => {
      vi.mocked(vnpayProvider.verifyIpn).mockResolvedValue({
        isValid: true,
        isSuccess: true,
        paymentId: 201,
        amount: 280000,
        transactionNo: 'VNPAY_123',
      });

      mockTx.thanhToan.findUnique.mockResolvedValue({
        ...mockCreatedPayment,
        trangThai: 'DANG_XU_LY',
        donGiaoDich: { phieuDatVe: { phieuDatVeId: 101, ves: [] } },
      });

      const res = await service.handleVnpayIpn({ vnp_TxnRef: '201_123' });

      expect(res.RspCode).toBe('00');
    });

    it('returns 97 when checksum is invalid', async () => {
      vi.mocked(vnpayProvider.verifyIpn).mockResolvedValue({
        isValid: false,
        isSuccess: false,
        paymentId: 201,
        amount: 280000,
      });

      const res = await service.handleVnpayIpn({ vnp_TxnRef: '201_123' });

      expect(res.RspCode).toBe('97');
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });
});
