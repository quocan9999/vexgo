import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { generateUuidV1 } from '../common/uuid-v1.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import type {
  MomoWebhookDto,
  VnpayWebhookDto,
  ZaloPayWebhookDto,
} from './dto/webhook.dto.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  readonly isDemoMode: boolean;
  readonly momoSecretKey: string;
  readonly vnpayHashSecret: string;
  readonly zalopayKey2: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.isDemoMode =
      (this.configService?.get<string>('PAYMENT_DEMO_MODE') ?? '').toLowerCase() ===
      'true';
    this.momoSecretKey =
      this.configService?.get<string>('MOMO_SECRET_KEY') ||
      (this.isDemoMode
        ? (process.env.NODE_ENV === 'test'
            ? 'vexgo_momo_demo_secret'
            : randomBytes(32).toString('hex'))
        : '');
    this.vnpayHashSecret =
      this.configService?.get<string>('VNPAY_HASH_SECRET') ||
      (this.isDemoMode
        ? (process.env.NODE_ENV === 'test'
            ? 'vexgo_vnpay_demo_secret'
            : randomBytes(32).toString('hex'))
        : '');
    this.zalopayKey2 =
      this.configService?.get<string>('ZALOPAY_KEY2') ||
      (this.isDemoMode
        ? (process.env.NODE_ENV === 'test'
            ? 'vexgo_zalopay_demo_key2'
            : randomBytes(32).toString('hex'))
        : '');

    if (this.isDemoMode && process.env.NODE_ENV !== 'test') {
      if (
        !this.configService?.get<string>('MOMO_SECRET_KEY') ||
        !this.configService?.get<string>('VNPAY_HASH_SECRET') ||
        !this.configService?.get<string>('ZALOPAY_KEY2')
      ) {
        this.logger.warn(
          '[PAYMENT DEMO MODE] Generated random in-memory ephemeral secret keys because explicit keys were not provided. Hardcoded literal secrets are disabled to prevent external forged webhooks.',
        );
      }
    }
  }

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

    // 1. Kiểm tra trạng thái booking & transaction (discussion_r4226248027)
    const isCancelled =
      ['DA_HUY', 'HUY'].includes(booking.trangThai) ||
      (booking.donGiaoDich && ['DA_HUY', 'HUY'].includes(booking.donGiaoDich.trangThai));
    if (isCancelled) {
      throw new ConflictException({
        error: 'BOOKING_CANCELLED',
        message: 'Đơn đặt vé đã bị hủy, không thể tạo giao dịch thanh toán.',
      });
    }

    const isAlreadyPaid =
      booking.trangThai === 'DA_THANH_TOAN' ||
      (booking.donGiaoDich && booking.donGiaoDich.trangThai === 'DA_THANH_TOAN');
    if (isAlreadyPaid) {
      throw new ConflictException({
        error: 'BOOKING_ALREADY_PAID',
        message: 'Đơn đặt vé đã được thanh toán thành công.',
      });
    }

    if (!['CHO_THANH_TOAN', 'DANG_XU_LY'].includes(booking.trangThai)) {
      throw new ConflictException({
        error: 'INVALID_BOOKING_STATUS',
        message: 'Trạng thái đơn đặt vé không hợp lệ để tạo giao dịch thanh toán.',
      });
    }

    const cleanProvider = (provider || 'MOMO').toUpperCase();

    // 2. Pending Payment Idempotency: Tái sử dụng payment DANG_XU_LY nếu đã tồn tại cùng provider
    const existingPendingPayment = await this.prisma.thanhToan.findFirst({
      where: {
        donGiaoDichId: booking.donGiaoDichId,
        trangThai: 'DANG_XU_LY',
        phuongThuc: cleanProvider,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (existingPendingPayment) {
      const existingAmount = Number(existingPendingPayment.soTien);
      const existingUrl = `https://sandbox.${cleanProvider.toLowerCase()}.vn/pay?id=${existingPendingPayment.thanhToanId}&amount=${existingAmount}`;
      const existingDeeplink = `${cleanProvider.toLowerCase()}://app?id=${existingPendingPayment.thanhToanId}`;

      return {
        paymentId: existingPendingPayment.thanhToanId,
        bookingId: booking.phieuDatVeId,
        provider: cleanProvider,
        amount: existingAmount,
        paymentUrl: existingUrl,
        deeplink: existingDeeplink,
        status: 'PENDING',
        mode: 'DEMO',
        createdAt: existingPendingPayment.createdAt?.toISOString?.() ?? new Date().toISOString(),
      };
    }

    // Production vs Demo check (discussion_r4220529077)
    if (!this.isDemoMode) {
      throw new ServiceUnavailableException(
        `Cổng thanh toán ${cleanProvider} chưa được cấu hình cho môi trường thực tế. Vui lòng bật PAYMENT_DEMO_MODE=true để thử nghiệm.`,
      );
    }

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

    this.logger.warn(
      `[DEMO MODE] Generated sandbox payment URL for payment #${payment.thanhToanId} via ${cleanProvider}`,
    );

    return {
      paymentId: payment.thanhToanId,
      bookingId: booking.phieuDatVeId,
      provider: cleanProvider,
      amount,
      paymentUrl,
      deeplink,
      status: 'PENDING',
      mode: 'DEMO',
      createdAt: payment.createdAt?.toISOString?.() ?? new Date().toISOString(),
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

  async confirmPaymentSuccess(params: {
    paymentId: number;
    provider: string;
    amount: number;
  }) {
    const payment = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: Number(params.paymentId) },
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
        `Giao dịch thanh toán #${params.paymentId} không tồn tại.`,
      );
    }

    // 1. Kiểm tra khớp provider (Discussion #discussion_r4164957958)
    if (payment.phuongThuc.toUpperCase() !== params.provider.toUpperCase()) {
      throw new BadRequestException({
        error: 'PAYMENT_PROVIDER_MISMATCH',
        message: `Phương thức thanh toán không khớp: mong đợi ${payment.phuongThuc}, nhận được ${params.provider}`,
      });
    }

    // 2. Kiểm tra khớp số tiền (Discussion #discussion_r4164957969)
    const expectedAmount = Math.round(Number(payment.soTien));
    const receivedAmount = Math.round(Number(params.amount));
    if (expectedAmount !== receivedAmount) {
      throw new BadRequestException({
        error: 'PAYMENT_AMOUNT_MISMATCH',
        message: `Số tiền thanh toán không khớp: mong đợi ${expectedAmount}, nhận được ${receivedAmount}`,
      });
    }

    if (payment.trangThai === 'THANH_CONG') {
      return { success: true, message: 'Giao dịch đã được xác nhận trước đó.' };
    }

    let isAlreadyClaimed = false;
    let isLatePaymentForCancelledBooking = false;

    await this.prisma.$transaction(async (tx) => {
      // Atomic state claim: Chỉ update nếu trạng thái CHƯA PHẢI là THANH_CONG (discussion_r4222294112)
      // MySQL InnoDB sẽ acquire exclusive row lock trên dòng thanh toán này.
      const claimResult = await tx.thanhToan.updateMany({
        where: {
          thanhToanId: payment.thanhToanId,
          trangThai: { not: 'THANH_CONG' },
        },
        data: {
          trangThai: 'THANH_CONG',
        },
      });

      // Nếu count === 0, giao dịch này đã được claim/xác nhận thành công bởi 1 webhook đồng thời khác
      if (claimResult.count === 0) {
        isAlreadyClaimed = true;
        return;
      }

      if (payment.donGiaoDich) {
        const phieuDatVe = payment.donGiaoDich.phieuDatVe;
        if (phieuDatVe) {
          // Lấy trạng thái mới nhất của donGiaoDich, phieuDatVe và các vé trong transaction
          const currentDonGiaoDich = await tx.donGiaoDich.findUnique({
            where: { donGiaoDichId: payment.donGiaoDichId },
          });

          const currentBooking = await tx.phieuDatVe.findUnique({
            where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
            include: { ves: true },
          });

          const isCancelled =
            (currentBooking &&
              ['DA_HUY', 'HUY'].includes(currentBooking.trangThai)) ||
            (currentDonGiaoDich &&
              ['DA_HUY', 'HUY'].includes(currentDonGiaoDich.trangThai));

          if (isCancelled) {
            isLatePaymentForCancelledBooking = true;
            this.logger.warn(
              `Payment #${payment.thanhToanId} confirmed SUCCESS for ALREADY CANCELLED booking/transaction #${phieuDatVe.phieuDatVeId}. Kept booking and tickets CANCELLED. Requires refund.`,
            );
            return;
          }

          // Cập nhật DonGiaoDich nếu chưa bị hủy (Atomic CAS)
          const updateDonGiaoDichResult = await tx.donGiaoDich.updateMany({
            where: {
              donGiaoDichId: payment.donGiaoDichId,
              trangThai: { notIn: ['DA_HUY', 'HUY'] },
            },
            data: { trangThai: 'DA_THANH_TOAN' },
          });

          // Nếu DonGiaoDich không cập nhật được (bị hủy concurrent hoặc trạng thái không hợp lệ)
          if (
            updateDonGiaoDichResult.count === 0 &&
            currentDonGiaoDich?.trangThai !== 'DA_THANH_TOAN'
          ) {
            isLatePaymentForCancelledBooking = true;
            this.logger.warn(
              `Payment #${payment.thanhToanId} confirmed SUCCESS but transaction #${payment.donGiaoDichId} update failed (cancelled or invalid). Kept booking and tickets CANCELLED. Requires refund.`,
            );
            return;
          }

          // Conditional update: Chỉ chuyển DA_THANH_TOAN nếu đơn đang ở trạng thái CHO_THANH_TOAN / DANG_XU_LY
          const updateBookingResult = await tx.phieuDatVe.updateMany({
            where: {
              phieuDatVeId: phieuDatVe.phieuDatVeId,
              trangThai: { in: ['CHO_THANH_TOAN', 'DANG_XU_LY'] },
            },
            data: { trangThai: 'DA_THANH_TOAN' },
          });

          if (updateBookingResult.count === 0) {
            // Đơn không ở trạng thái hợp lệ để chuyển DA_THANH_TOAN (hoặc đã hoàn tất)
            return;
          }

          // Chỉ cập nhật các vé CHƯA bị hủy sang DA_THANH_TOAN
          let activeTickets: any[] = [];
          if (tx.ve) {
            await tx.ve.updateMany({
              where: {
                phieuDatVeId: phieuDatVe.phieuDatVeId,
                trangThai: { notIn: ['DA_HUY', 'HUY'] },
              },
              data: { trangThai: 'DA_THANH_TOAN' },
            });
            activeTickets = await tx.ve.findMany({
              where: {
                phieuDatVeId: phieuDatVe.phieuDatVeId,
                trangThai: 'DA_THANH_TOAN',
              },
            });
          }

          const operationId = generateUuidV1();
          const timestamp = new Date();
          const providerName = payment.phuongThuc.toUpperCase();

          if (tx.lichSuTrangThaiPhieuDatVe) {
            await tx.lichSuTrangThaiPhieuDatVe.create({
              data: {
                phieuDatVeId: phieuDatVe.phieuDatVeId,
                trangThaiCu: currentBooking?.trangThai || 'CHO_THANH_TOAN',
                trangThaiMoi: 'DA_THANH_TOAN',
                thoiDiem: timestamp,
                nguonThayDoi: 'SYSTEM',
                taiKhoanId: null,
                lyDo: `Thanh toán thành công qua ${providerName}`,
                laOverride: false,
                maThaoTac: operationId,
              },
            });
          }

          if (tx.lichSuTrangThaiVe) {
            for (const ticket of activeTickets) {
              await tx.lichSuTrangThaiVe.create({
                data: {
                  veId: ticket.veId,
                  trangThaiCu: 'DA_DAT',
                  trangThaiMoi: 'DA_THANH_TOAN',
                  thoiDiem: timestamp,
                  nguonThayDoi: 'SYSTEM',
                  taiKhoanId: null,
                  lyDo: `Thanh toán vé thành công qua ${providerName}`,
                  laOverride: false,
                  maThaoTac: operationId,
                },
              });
            }
          }
        }
      }
    });

    if (isAlreadyClaimed) {
      this.logger.log(
        `Payment #${payment.thanhToanId} was already claimed/confirmed by concurrent transaction.`,
      );
      return { success: true, message: 'Giao dịch đã được xác nhận trước đó.' };
    }

    if (isLatePaymentForCancelledBooking) {
      return {
        success: true,
        isLatePayment: true,
        message:
          'Thanh toán thành công nhưng đơn đặt vé đã bị hủy trước đó. Cần hoàn tiền cho khách.',
      };
    }

    this.logger.log(
      `Payment #${params.paymentId} confirmed SUCCESS via verified webhook.`,
    );
    return { success: true };
  }

  verifyMomoSignature(body: MomoWebhookDto): boolean {
    if (!this.momoSecretKey || !body.signature) return false;
    const raw = `accessKey=${body.accessKey ?? ''}&amount=${body.amount ?? ''}&extraData=${body.extraData ?? ''}&message=${body.message ?? ''}&orderId=${body.orderId ?? ''}&orderInfo=${body.orderInfo ?? ''}&orderType=${body.orderType ?? ''}&partnerCode=${body.partnerCode ?? ''}&payType=${body.payType ?? ''}&requestId=${body.requestId ?? ''}&responseTime=${body.responseTime ?? ''}&resultCode=${body.resultCode ?? ''}&transId=${body.transId ?? ''}`;
    const expectedSig = createHmac('sha256', this.momoSecretKey)
      .update(raw)
      .digest('hex');
    return body.signature === expectedSig;
  }

  verifyVnpaySignature(queryOrBody: VnpayWebhookDto): boolean {
    if (!this.vnpayHashSecret) return false;
    const secureHash = queryOrBody.vnp_SecureHash;
    if (!secureHash) return false;

    const entries = Object.entries(queryOrBody as Record<string, any>)
      .filter(
        ([k, v]) =>
          k.startsWith('vnp_') &&
          k !== 'vnp_SecureHash' &&
          k !== 'vnp_SecureHashType' &&
          v !== undefined &&
          v !== null &&
          v !== '',
      )
      .sort(([a], [b]) => a.localeCompare(b));

    const signData = entries
      .map(
        ([k, v]) =>
          `${k}=${encodeURIComponent(String(v)).replace(/%20/g, '+')}`,
      )
      .join('&');

    const expectedHash = createHmac('sha512', this.vnpayHashSecret)
      .update(Buffer.from(signData, 'utf-8'))
      .digest('hex');

    return secureHash.toLowerCase() === expectedHash.toLowerCase();
  }

  verifyZaloPayMac(body: ZaloPayWebhookDto): boolean {
    if (!this.zalopayKey2 || !body.mac || !body.data) return false;
    const expectedMac = createHmac('sha256', this.zalopayKey2)
      .update(body.data)
      .digest('hex');
    return body.mac === expectedMac;
  }

  async handleMomoWebhook(body: MomoWebhookDto) {
    this.logger.log(
      `Received MoMo Webhook for orderId: ${body.orderId}, resultCode: ${body.resultCode}`,
    );

    if (!this.verifyMomoSignature(body)) {
      this.logger.warn(
        `MoMo Webhook signature verification failed for orderId: ${body.orderId}`,
      );
      throw new BadRequestException('Chữ ký webhook MoMo không hợp lệ.');
    }

    if (body.resultCode !== 0) {
      this.logger.warn(
        `MoMo Webhook returned non-zero resultCode: ${body.resultCode}`,
      );
      return {
        resultCode: body.resultCode,
        message: body.message || 'Payment failed',
      };
    }

    const paymentId = Number(body.orderId || body.paymentId || body.extraData);
    if (!paymentId || isNaN(paymentId)) {
      throw new BadRequestException('Mã thanh toán không hợp lệ.');
    }

    await this.confirmPaymentSuccess({
      paymentId,
      provider: 'MOMO',
      amount: Number(body.amount),
    });
    return { resultCode: 0, message: 'Received' };
  }

  async handleVnpayWebhook(queryOrBody: VnpayWebhookDto) {
    this.logger.log(
      `Received VNPay Webhook for txnRef: ${queryOrBody.vnp_TxnRef}, responseCode: ${queryOrBody.vnp_ResponseCode}`,
    );

    if (!this.verifyVnpaySignature(queryOrBody)) {
      this.logger.warn(
        `VNPay Webhook secure hash verification failed for txnRef: ${queryOrBody.vnp_TxnRef}`,
      );
      throw new BadRequestException('Chữ ký bảo mật VNPay không hợp lệ.');
    }

    if (
      queryOrBody.vnp_ResponseCode !== '00' ||
      (queryOrBody.vnp_TransactionStatus &&
        queryOrBody.vnp_TransactionStatus !== '00')
    ) {
      this.logger.warn(
        `VNPay Webhook returned non-success code: ${queryOrBody.vnp_ResponseCode}`,
      );
      return {
        RspCode: queryOrBody.vnp_ResponseCode || '99',
        Message: 'Payment failed',
      };
    }

    const paymentId = Number(queryOrBody.vnp_TxnRef || queryOrBody.paymentId);
    if (!paymentId || isNaN(paymentId)) {
      throw new BadRequestException('Mã thanh toán không hợp lệ.');
    }

    const rawAmount = Number(queryOrBody.vnp_Amount);
    const vnpayAmount = rawAmount > 0 ? rawAmount / 100 : 0;

    await this.confirmPaymentSuccess({
      paymentId,
      provider: 'VNPAY',
      amount: vnpayAmount,
    });
    return { RspCode: '00', Message: 'Confirm Success' };
  }

  async handleZaloPayWebhook(body: ZaloPayWebhookDto) {
    this.logger.log(
      `Received ZaloPay Webhook for app_trans_id: ${body.app_trans_id}`,
    );

    if (!this.verifyZaloPayMac(body)) {
      this.logger.warn(
        `ZaloPay Webhook MAC verification failed for app_trans_id: ${body.app_trans_id}`,
      );
      throw new BadRequestException('Chữ ký MAC ZaloPay không hợp lệ.');
    }

    let paymentId: number | null = null;
    let amount = 0;
    if (body.data) {
      try {
        const parsed = JSON.parse(body.data);
        paymentId = Number(parsed.app_trans_id || parsed.paymentId);
        amount = Number(parsed.amount || parsed.item_price || 0);
      } catch {
        // ignore parse error, fallback
      }
    }
    if (!paymentId) {
      paymentId = Number(body.app_trans_id || body.paymentId);
      amount = Number(body.amount ?? 0);
    }

    if (!paymentId || isNaN(paymentId)) {
      throw new BadRequestException('Mã thanh toán không hợp lệ.');
    }

    await this.confirmPaymentSuccess({
      paymentId,
      provider: 'ZALOPAY',
      amount,
    });
    return { return_code: 1, return_message: 'success' };
  }
}
