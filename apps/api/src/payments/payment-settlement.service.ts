import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockPaymentOrder } from './payment-order-lock.js';

@Injectable()
export class PaymentSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  /** Call only after the payment provider has confirmed the payment. */
  async confirmPayment(paymentId: number) {
    const reference = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: paymentId },
      select: { donGiaoDichId: true },
    });
    if (!reference) {
      throw new NotFoundException({
        error: 'PAYMENT_NOT_FOUND',
        message: 'Không tìm thấy giao dịch thanh toán.',
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const hasOrder = await lockPaymentOrder(tx, reference.donGiaoDichId);
      if (!hasOrder) {
        throw new NotFoundException({
          error: 'PAYMENT_ORDER_NOT_FOUND',
          message: 'Không tìm thấy đơn giao dịch của khoản thanh toán.',
        });
      }

      const payment = await tx.thanhToan.findUnique({
        where: { thanhToanId: paymentId },
        include: {
          donGiaoDich: {
            select: {
              donGiaoDichId: true,
              trangThai: true,
              phieuGuiHang: { select: { trangThai: true } },
            },
          },
        },
      });
      if (!payment) {
        throw new NotFoundException({
          error: 'PAYMENT_NOT_FOUND',
          message: 'Không tìm thấy giao dịch thanh toán.',
        });
      }
      if (payment.donGiaoDichId !== reference.donGiaoDichId) {
        throw new ConflictException({
          error: 'PAYMENT_ORDER_CHANGED',
          message: 'Đơn giao dịch của khoản thanh toán đã thay đổi.',
        });
      }
      if (payment.loaiGiaoDich === 'HOAN_TIEN') {
        throw new ConflictException({
          error: 'PAYMENT_SETTLEMENT_NOT_ALLOWED',
          message:
            'Không thể xác nhận khoản hoàn tiền như một khoản thanh toán.',
        });
      }
      if (
        payment.donGiaoDich.trangThai === 'DA_HUY' ||
        payment.donGiaoDich.phieuGuiHang?.trangThai === 'DA_HUY'
      ) {
        throw new ConflictException({
          error: 'PAYMENT_ORDER_CANCELLED',
          message: 'Không thể xác nhận thanh toán cho đơn đã hủy.',
        });
      }

      if (
        payment.trangThai === 'THANH_CONG' ||
        payment.trangThai === 'DA_THANH_TOAN'
      ) {
        if (payment.donGiaoDich.trangThai === 'CHO_THANH_TOAN') {
          await tx.donGiaoDich.update({
            where: { donGiaoDichId: payment.donGiaoDichId },
            data: { trangThai: 'DA_THANH_TOAN' },
          });
        } else if (payment.donGiaoDich.trangThai !== 'DA_THANH_TOAN') {
          throw new ConflictException({
            error: 'PAYMENT_ORDER_STATE_CHANGED',
            message:
              'Tráº¡ng thÃ¡i Ä‘Æ¡n giao dá»‹ch khÃ´ng cho phÃ©p xÃ¡c nháº­n thanh toÃ¡n.',
          });
        }
        return { data: { paymentId, status: 'THANH_CONG' as const } };
      }
      if (!['CHO_THANH_TOAN', 'DANG_XU_LY'].includes(payment.trangThai)) {
        throw new ConflictException({
          error: 'PAYMENT_STATE_NOT_SETTLEABLE',
          message: 'Trạng thái thanh toán không cho phép xác nhận.',
        });
      }
      if (payment.donGiaoDich.trangThai !== 'CHO_THANH_TOAN') {
        throw new ConflictException({
          error: 'PAYMENT_ORDER_STATE_CHANGED',
          message:
            'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
        });
      }

      const otherSuccessfulPayment = await tx.thanhToan.findFirst({
        where: {
          donGiaoDichId: payment.donGiaoDichId,
          thanhToanId: { not: paymentId },
          loaiGiaoDich: { not: 'HOAN_TIEN' },
          trangThai: { in: ['THANH_CONG', 'DA_THANH_TOAN'] },
        },
        select: { thanhToanId: true },
      });
      if (otherSuccessfulPayment) {
        throw new ConflictException({
          error: 'PAYMENT_ORDER_ALREADY_PAID',
          message: 'Đơn giao dịch đã có khoản thanh toán thành công khác.',
        });
      }

      await tx.thanhToan.update({
        where: { thanhToanId: paymentId },
        data: { trangThai: 'THANH_CONG' },
      });
      await tx.donGiaoDich.update({
        where: { donGiaoDichId: payment.donGiaoDichId },
        data: { trangThai: 'DA_THANH_TOAN' },
      });

      return { data: { paymentId, status: 'THANH_CONG' as const } };
    });
  }
}
