import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  ParseIntPipe,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../auth/decorators/public.decorator.js';
import { CurrentPrincipal } from '../auth/decorators/current-principal.decorator.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { BookingsService } from '../bookings/bookings.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { PaymentsService } from './payments.service.js';
import { CreatePaymentDto } from './dto/create-payment.dto.js';
import {
  MomoWebhookDto,
  VnpayWebhookDto,
  ZaloPayWebhookDto,
} from './dto/webhook.dto.js';

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
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  async createPayment(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Body() dto: CreatePaymentDto,
  ) {
    return this.paymentsService.createPayment(
      dto.bookingId,
      dto.provider,
      principal,
    );
  }

  @Get(':paymentId/status')
  async getPaymentStatus(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentStatus(paymentId, principal);
  }

  @Get(':paymentId')
  async getPaymentById(
    @CurrentPrincipal() principal: AuthPrincipal,
    @Param('paymentId', ParseIntPipe) paymentId: number,
  ) {
    return this.paymentsService.getPaymentById(paymentId, principal);
  }

  @Public()
  @Post('momo/webhook')
  async momoWebhook(@Body() body: MomoWebhookDto) {
    return this.paymentsService.handleMomoWebhook(body);
  }

  @Public()
  @Post('vnpay/webhook')
  async vnpayWebhook(@Body() body: VnpayWebhookDto) {
    return this.paymentsService.handleVnpayWebhook(body);
  }

  @Public()
  @Post('zalopay/webhook')
  async zalopayWebhook(@Body() body: ZaloPayWebhookDto) {
    return this.paymentsService.handleZaloPayWebhook(body);
  }

  @Public()
  @Post('sepay-webhook')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhook(
    @Body() payload: SepayWebhookPayload,
    @Headers('authorization') authHeader?: string,
  ) {
    this.logger.log(`Received SePay Webhook: ${JSON.stringify(payload)}`);

    // 1. Xác thực token nếu webhook token được cấu hình
    const expectedToken = this.configService.get<string>('SEPAY_WEBHOOK_TOKEN');
    if (expectedToken) {
      const incomingToken = (authHeader || '').replace(/^Apikey\s+/i, '').trim();
      if (!incomingToken || incomingToken !== expectedToken.trim()) {
        throw new UnauthorizedException({
          error: 'UNAUTHORIZED_WEBHOOK',
          message: 'Mã xác thực SePay Webhook không hợp lệ.',
        });
      }
    }

    const content = (payload.content || payload.description || '').toUpperCase();
    const transferAmount = Number(payload.transferAmount || 0);

    if (!content && !payload.code && !payload.referenceCode) {
      return { success: false, message: 'Nội dung chuyển khoản rỗng' };
    }

    // 2. Tìm kiếm chính xác (indexed queries) - không fuzzy scan 50 đơn
    let matchedBooking: any = null;

    // 2.1 Kiểm tra direct field code hoặc referenceCode từ webhook payload
    const directCode = (payload.code || payload.referenceCode || '').trim();
    if (directCode) {
      matchedBooking = await this.prisma.phieuDatVe.findFirst({
        where: {
          OR: [
            { maPhieuDatVe: directCode },
            { donGiaoDich: { maDonGiaoDich: directCode } },
          ],
        },
        include: { donGiaoDich: true },
      });
    }

    // 2.2 Trích xuất mã giao dịch (GD-...) từ nội dung chuyển khoản
    if (!matchedBooking) {
      const orderCodeMatch = content.match(/[A-Z0-9]+-GD-[A-Z0-9-]+/i) || content.match(/GD-[A-Z0-9-]+/i);
      if (orderCodeMatch) {
        matchedBooking = await this.prisma.phieuDatVe.findFirst({
          where: {
            donGiaoDich: { maDonGiaoDich: orderCodeMatch[0].toUpperCase() },
          },
          include: { donGiaoDich: true },
        });
      }
    }

    // 2.3 Trích xuất mã phiếu đặt vé (PDV-...) từ nội dung chuyển khoản
    if (!matchedBooking) {
      const bookingCodeMatch = content.match(/[A-Z0-9]+-PDV-[A-Z0-9-]+/i) || content.match(/PDV-[A-Z0-9-]+/i);
      if (bookingCodeMatch) {
        matchedBooking = await this.prisma.phieuDatVe.findFirst({
          where: {
            maPhieuDatVe: bookingCodeMatch[0].toUpperCase(),
          },
          include: { donGiaoDich: true },
        });
      }
    }

    // 2.4 Trích xuất booking ID: VEXGO <id> hoặc BOOKING <id>
    if (!matchedBooking) {
      const idMatch = content.match(/VEXGO\s*(\d+)/i) || content.match(/BOOKING\s*(\d+)/i);
      if (idMatch && idMatch[1]) {
        const bId = parseInt(idMatch[1], 10);
        if (!isNaN(bId) && bId > 0) {
          matchedBooking = await this.prisma.phieuDatVe.findUnique({
            where: { phieuDatVeId: bId },
            include: { donGiaoDich: true },
          });
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

    // 3. Idempotency: Nếu đơn đã thanh toán trước đó, trả về thành công ngay lập tức
    if (matchedBooking.trangThai === 'DA_THANH_TOAN') {
      this.logger.log(`Booking #${matchedBooking.phieuDatVeId} đã thanh toán trước đó (idempotent duplicate webhook).`);
      return {
        success: true,
        message: 'Đơn hàng đã được thanh toán thành công trước đó.',
        bookingId: matchedBooking.phieuDatVeId,
        orderCode: matchedBooking.donGiaoDich.maDonGiaoDich,
      };
    }

    // 4. Kiểm tra số tiền chuyển khoản
    const orderAmount = Number(matchedBooking.donGiaoDich.tongTien);
    if (transferAmount > 0 && transferAmount < orderAmount) {
      this.logger.warn(
        `Số tiền chuyển ${transferAmount} nhỏ hơn tổng tiền đơn ${orderAmount} của booking #${matchedBooking.phieuDatVeId}`,
      );
      return {
        success: false,
        message: 'Số tiền chuyển khoản chưa đủ.',
      };
    }

    // 5. Kích hoạt xác nhận thanh toán
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
