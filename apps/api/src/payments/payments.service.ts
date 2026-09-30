import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createPayment(bookingId: number, provider: string) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: Number(bookingId) },
      include: {
        donGiaoDich: true,
      },
    });

    if (!booking) {
      throw new NotFoundException(`Đơn đặt vé #${bookingId} không tồn tại.`);
    }

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

    this.logger.log(`Created payment #${payment.thanhToanId} via ${cleanProvider} for booking #${bookingId}, amount: ${amount}đ`);

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

  async getPaymentStatus(paymentId: number) {
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
      throw new NotFoundException(`Giao dịch thanh toán #${paymentId} không tồn tại.`);
    }

    // In dev demo mode, mark as SUCCESS when checked
    const updatedPayment = await this.prisma.thanhToan.update({
      where: { thanhToanId: payment.thanhToanId },
      data: {
        trangThai: 'THANH_CONG',
      },
    });

    // Also update PhieuDatVe and DonGiaoDich to DA_THANH_TOAN
    if (payment.donGiaoDich) {
      await this.prisma.donGiaoDich.update({
        where: { donGiaoDichId: payment.donGiaoDichId },
        data: { trangThai: 'DA_THANH_TOAN' },
      });

      if (payment.donGiaoDich.phieuDatVe) {
        await this.prisma.phieuDatVe.update({
          where: { phieuDatVeId: payment.donGiaoDich.phieuDatVe.phieuDatVeId },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
      }
    }

    this.logger.log(`Payment #${paymentId} confirmed SUCCESS in MySQL.`);

    return {
      paymentId: payment.thanhToanId,
      bookingId: payment.donGiaoDich?.phieuDatVe?.phieuDatVeId ?? 0,
      provider: payment.phuongThuc,
      amount: Number(payment.soTien),
      status: 'SUCCESS',
      paidAt: new Date().toISOString(),
    };
  }

  async getPaymentById(paymentId: number) {
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
      throw new NotFoundException(`Giao dịch thanh toán #${paymentId} không tồn tại.`);
    }

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

  async handleMomoWebhook(body: any) {
    this.logger.log(`Received MoMo Webhook: ${JSON.stringify(body)}`);
    const paymentId = Number(body.orderId || body.paymentId || body.extraData);
    if (paymentId) {
      return this.getPaymentStatus(paymentId);
    }
    return { resultCode: 0, message: 'Received' };
  }

  async handleVnpayWebhook(queryOrBody: any) {
    this.logger.log(`Received VNPay Webhook: ${JSON.stringify(queryOrBody)}`);
    const paymentId = Number(queryOrBody.vnp_TxnRef || queryOrBody.paymentId);
    if (paymentId) {
      return this.getPaymentStatus(paymentId);
    }
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  async handleZaloPayWebhook(body: any) {
    this.logger.log(`Received ZaloPay Webhook: ${JSON.stringify(body)}`);
    const paymentId = Number(body.app_trans_id || body.paymentId);
    if (paymentId) {
      return this.getPaymentStatus(paymentId);
    }
    return { return_code: 1, return_message: 'success' };
  }
}
