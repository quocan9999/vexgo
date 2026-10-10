import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
} from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface SepayWebhookPayload {
  id?: number;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  code?: string;
  content?: string;
  transferType?: string;
  transferAmount?: number;
  accumulated?: number;
  subAccount?: string;
  referenceCode?: string;
  description?: string;
}

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookingsService: BookingsService,
  ) {}

  @Public()
  @Post('sepay-webhook')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhook(
    @Body() payload: SepayWebhookPayload,
    @Headers('authorization') authHeader?: string,
  ) {
    this.logger.log(`Received SePay Webhook: ${JSON.stringify(payload)}`);

    const content = (payload.content || payload.description || '').toUpperCase();
    const transferAmount = Number(payload.transferAmount || 0);

    if (!content) {
      return { success: false, message: 'Nội dung chuyển khoản rỗng' };
    }

    // 1. Tìm kiếm mã đơn giao dịch hoặc mã phiếu đặt vé trong nội dung
    // Quy ước nội dung: VEXGO [maDonGiaoDich] hoặc [maPhieuDatVe] hoặc VEXGO [bookingId]
    // Ví dụ: "VEXGO HN-DN-GD-..." hoặc "VEXGO 15" hoặc "HN-DN-GD-..."
    
    // Tìm theo bookingId dạng số (ví dụ: VEXGO 12, BOOKING 12)
    const idMatch = content.match(/VEXGO\s*(\d+)/i) || content.match(/BOOKING\s*(\d+)/i);
    let matchedBooking = null;

    if (idMatch && idMatch[1]) {
      const bId = parseInt(idMatch[1], 10);
      matchedBooking = await this.prisma.phieuDatVe.findUnique({
        where: { phieuDatVeId: bId },
        include: { donGiaoDich: true },
      });
    }

    const cleanContent = content.replace(/[^A-Z0-9]/g, '');

    // Nếu chưa tìm thấy, tìm theo mã đơn giao dịch (DonGiaoDich.maDonGiaoDich)
    if (!matchedBooking) {
      const allOrders = await this.prisma.donGiaoDich.findMany({
        where: { trangThai: 'CHO_THANH_TOAN' },
        include: { phieuDatVe: true },
        take: 50,
        orderBy: { donGiaoDichId: 'desc' },
      });

      for (const order of allOrders) {
        if (!order.maDonGiaoDich) continue;
        const cleanOrderCode = order.maDonGiaoDich.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (
          content.includes(order.maDonGiaoDich.toUpperCase()) ||
          cleanContent.includes(cleanOrderCode)
        ) {
          matchedBooking = order.phieuDatVe
            ? { ...order.phieuDatVe, donGiaoDich: order }
            : null;
          break;
        }
      }
    }

    // Nếu vẫn chưa tìm thấy, tìm theo mã phiếu đặt vé (PhieuDatVe.maPhieuDatVe)
    if (!matchedBooking) {
      const pendingBookings = await this.prisma.phieuDatVe.findMany({
        where: { trangThai: 'CHO_THANH_TOAN' },
        include: { donGiaoDich: true },
        take: 50,
        orderBy: { phieuDatVeId: 'desc' },
      });

      for (const b of pendingBookings) {
        if (!b.maPhieuDatVe) continue;
        const cleanBookingCode = b.maPhieuDatVe.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (
          content.includes(b.maPhieuDatVe.toUpperCase()) ||
          cleanContent.includes(cleanBookingCode)
        ) {
          matchedBooking = b;
          break;
        }
      }
    }

    if (!matchedBooking) {
      this.logger.warn(`Không tìm thấy đơn hàng tương ứng cho nội dung: "${content}"`);
      return {
        success: false,
        message: 'Không tìm thấy đơn hàng khớp với nội dung chuyển khoản.',
      };
    }

    const orderAmount = Number(matchedBooking.donGiaoDich.tongTien);
    // Cho phép dung sai hoặc xác nhận nếu số tiền chuyển >= tiền đơn
    if (transferAmount > 0 && transferAmount < orderAmount) {
      this.logger.warn(
        `Số tiền chuyển ${transferAmount} nhỏ hơn tổng tiền đơn ${orderAmount} của booking #${matchedBooking.phieuDatVeId}`,
      );
      return {
        success: false,
        message: 'Số tiền chuyển khoản chưa đủ.',
      };
    }

    // 2. Kích hoạt xác nhận thanh toán
    await this.bookingsService.confirmBookingPayment(
      matchedBooking.phieuDatVeId,
      'CHUYEN_KHOAN_SEPAY',
    );

    this.logger.log(
      `Đã tự động xác nhận thanh toán thành công cho booking #${matchedBooking.phieuDatVeId} (GD: ${matchedBooking.donGiaoDich.maDonGiaoDich})`,
    );

    return {
      success: true,
      bookingId: matchedBooking.phieuDatVeId,
      orderCode: matchedBooking.donGiaoDich.maDonGiaoDich,
    };
  }
}
