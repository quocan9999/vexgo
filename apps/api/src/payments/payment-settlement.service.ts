import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockPaymentOrder } from './payment-order-lock.js';

type LockedPayment = Prisma.ThanhToanGetPayload<{
  include: {
    donGiaoDich: {
      include: {
        phieuDatVe: true;
        phieuGuiHang: true;
        khachHang: true;
      };
    };
  };
}>;

@Injectable()
export class PaymentSettlementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Runs the production payment writer under the single DonGiaoDich lock used
   * by shipment status changes. The callback must keep all settlement writes
   * on the provided transaction client.
   */
  async withLockedPayment<T>(
    paymentId: number,
    settle: (tx: Prisma.TransactionClient, payment: LockedPayment) => Promise<T>,
  ): Promise<T> {
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
            include: {
              phieuDatVe: true,
              phieuGuiHang: true,
              khachHang: true,
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

      return settle(tx, payment);
    });
  }
}
