import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import type {
  MomoWebhookDto,
  VnpayWebhookDto,
  ZaloPayWebhookDto,
} from './dto/webhook.dto.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async verifyCustomerOwnership(
    principal: AuthPrincipal | undefined,
    khachHangId?: number | null,
    errorMessage = 'Bạn không có quyền truy cập thông tin thanh toán này.',
  ) {
    if (!principal) return;
    if (
      principal.roles?.includes('ADMIN') ||
      principal.roles?.includes('OPERATOR')
    ) {
      return;
    }
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId: principal.taiKhoanId },
    });
    if (!customer || customer.khachHangId !== khachHangId) {
      throw new ForbiddenException(errorMessage);
    }
  }

  async createPayment(
    bookingId: number,
    provider: string,
    principal?: AuthPrincipal,
  ) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: Number(bookingId) },
      include: {
        donGiaoDich: {
          include: {
            khachHang: true,
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Đơn đặt vé #${bookingId} không tồn tại.`);
    }

    await this.verifyCustomerOwnership(
      principal,
      booking.donGiaoDich?.khachHangId,
      'Bạn không có quyền thanh toán cho đơn đặt vé này.',
    );

    const cleanProvider = (provider || 'MOMO').toUpperCase();

    // Create record in ThanhToan table
    const payment = await this.prisma.thanhToan.create({
      data: {
        soTien: booking.donGiaoDich.tongTien,
        phuongThuc: cleanProvider,
        loaiGiaoDich: 'THANH_TOAN',
        thoiGian: new Date(),
        trangThai: 'DANG_XU_LY',
        donGiaoDichId: booking.donGiaoDichId,
      },
    });

    const amount = Number(payment.soTien);
    const paymentUrl = `https://sandbox.${cleanProvider.toLowerCase()}.vn/pay?id=${payment.thanhToanId}&amount=${amount}`;
    const deeplink = `${cleanProvider.toLowerCase()}://app?id=${payment.thanhToanId}`;

    this.logger.log(
      `Created payment #${payment.thanhToanId} via ${cleanProvider} for booking #${bookingId}, amount: ${amount}đ`,
    );

    return {
      paymentId: payment.thanhToanId,
      bookingId: booking.phieuDatVeId,
      provider: cleanProvider,
      amount,
      paymentUrl,
      deeplink,
      status: 'PENDING',
      createdAt: payment.createdAt.toISOString(),
    };
  }

  async getPaymentStatus(paymentId: number, principal?: AuthPrincipal) {
    const payment = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: Number(paymentId) },
      include: {
        donGiaoDich: {
          include: {
            phieuDatVe: true,
            khachHang: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Giao dịch thanh toán #${paymentId} không tồn tại.`,
      );
    }

    await this.verifyCustomerOwnership(
      principal,
      payment.donGiaoDich?.khachHangId,
    );

    // Purely READ-ONLY: do NOT mutate database!
    const isSuccess = payment.trangThai === 'THANH_CONG';
    const isFailed = payment.trangThai === 'THAT_BAI';
    const status = isSuccess ? 'SUCCESS' : isFailed ? 'FAILED' : 'PENDING';

    return {
      paymentId: payment.thanhToanId,
      bookingId: payment.donGiaoDich?.phieuDatVe?.phieuDatVeId ?? 0,
      provider: payment.phuongThuc,
      amount: Number(payment.soTien),
      status,
      paidAt: isSuccess ? payment.updatedAt.toISOString() : undefined,
    };
  }

  async getPaymentById(paymentId: number, principal?: AuthPrincipal) {
    const payment = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: Number(paymentId) },
      include: {
        donGiaoDich: {
          include: {
            phieuDatVe: true,
            khachHang: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Giao dịch thanh toán #${paymentId} không tồn tại.`,
      );
    }

    await this.verifyCustomerOwnership(
      principal,
      payment.donGiaoDich?.khachHangId,
    );

    return {
      paymentId: payment.thanhToanId,
      bookingId: payment.donGiaoDich?.phieuDatVe?.phieuDatVeId ?? 0,
      provider: payment.phuongThuc,
      amount: Number(payment.soTien),
      status: payment.trangThai,
      createdAt: payment.createdAt.toISOString(),
      updatedAt: payment.updatedAt.toISOString(),
    };
  }

  async confirmPaymentSuccess(paymentId: number) {
    const payment = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: Number(paymentId) },
      include: {
        donGiaoDich: {
          include: {
            phieuDatVe: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundException(
        `Giao dịch thanh toán #${paymentId} không tồn tại.`,
      );
    }

    if (payment.trangThai === 'THANH_CONG') {
      return { success: true, message: 'Giao dịch đã được xác nhận trước đó.' };
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.thanhToan.update({
        where: { thanhToanId: payment.thanhToanId },
        data: {
          trangThai: 'THANH_CONG',
        },
      });

      if (payment.donGiaoDich) {
        await tx.donGiaoDich.update({
          where: { donGiaoDichId: payment.donGiaoDichId },
          data: { trangThai: 'DA_THANH_TOAN' },
        });

        if (payment.donGiaoDich.phieuDatVe) {
          await tx.phieuDatVe.update({
            where: { phieuDatVeId: payment.donGiaoDich.phieuDatVe.phieuDatVeId },
            data: { trangThai: 'DA_THANH_TOAN' },
          });
        }
      }
    });

    this.logger.log(
      `Payment #${paymentId} confirmed SUCCESS via verified webhook.`,
    );
    return { success: true };
  }

  async handleMomoWebhook(body: MomoWebhookDto) {
    this.logger.log(`Received MoMo Webhook: ${JSON.stringify(body)}`);
    const paymentId = Number(body.orderId || body.paymentId || body.extraData);
    if (paymentId && (body.resultCode === 0 || body.resultCode === undefined)) {
      await this.confirmPaymentSuccess(paymentId);
    }
    return { resultCode: 0, message: 'Received' };
  }

  async handleVnpayWebhook(queryOrBody: VnpayWebhookDto) {
    this.logger.log(`Received VNPay Webhook: ${JSON.stringify(queryOrBody)}`);
    const paymentId = Number(queryOrBody.vnp_TxnRef || queryOrBody.paymentId);
    if (
      paymentId &&
      (queryOrBody.vnp_ResponseCode === '00' || !queryOrBody.vnp_ResponseCode)
    ) {
      await this.confirmPaymentSuccess(paymentId);
    }
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  async handleZaloPayWebhook(body: ZaloPayWebhookDto) {
    this.logger.log(`Received ZaloPay Webhook: ${JSON.stringify(body)}`);
    const paymentId = Number(body.app_trans_id || body.paymentId);
    if (paymentId) {
      await this.confirmPaymentSuccess(paymentId);
    }
    return { return_code: 1, return_message: 'success' };
  }
}
