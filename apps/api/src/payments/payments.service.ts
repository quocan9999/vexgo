import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
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
  readonly isDemoMode: boolean;
  readonly momoSecretKey: string;
  readonly vnpayHashSecret: string;
  readonly zalopayKey2: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.isDemoMode = this.configService?.get<string>('PAYMENT_DEMO_MODE') !== 'false';
    this.momoSecretKey =
      this.configService?.get<string>('MOMO_SECRET_KEY') ||
      'vexgo_momo_demo_secret';
    this.vnpayHashSecret =
      this.configService?.get<string>('VNPAY_HASH_SECRET') ||
      'vexgo_vnpay_demo_secret';
    this.zalopayKey2 =
      this.configService?.get<string>('ZALOPAY_KEY2') ||
      'vexgo_zalopay_demo_key2';
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

    const cleanProvider = (provider || 'MOMO').toUpperCase();

    // Check production mode configuration (Finding 9)
    if (!this.isDemoMode) {
      const hasSecret =
        (cleanProvider === 'MOMO' && !!this.configService?.get('MOMO_SECRET_KEY')) ||
        (cleanProvider === 'VNPAY' && !!this.configService?.get('VNPAY_HASH_SECRET')) ||
        (cleanProvider === 'ZALOPAY' && !!this.configService?.get('ZALOPAY_KEY2'));
      if (!hasSecret) {
        throw new BadRequestException(
          `Cổng thanh toán ${cleanProvider} chưa được cấu hình cho môi trường sản xuất.`,
        );
      }
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

    if (this.isDemoMode) {
      this.logger.warn(
        `[DEMO MODE] Generated sandbox payment URL for payment #${payment.thanhToanId} via ${cleanProvider}`,
      );
    } else {
      this.logger.log(
        `Created payment #${payment.thanhToanId} via ${cleanProvider} for booking #${bookingId}, amount: ${amount}đ`,
      );
    }

    return {
      paymentId: payment.thanhToanId,
      bookingId: booking.phieuDatVeId,
      provider: cleanProvider,
      amount,
      paymentUrl,
      deeplink,
      status: 'PENDING',
      ...(this.isDemoMode ? { mode: 'DEMO' } : {}),
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

  verifyMomoSignature(body: MomoWebhookDto): boolean {
    if (!body.signature) return false;
    const raw = `accessKey=${body.accessKey ?? ''}&amount=${body.amount ?? ''}&extraData=${body.extraData ?? ''}&message=${body.message ?? ''}&orderId=${body.orderId ?? ''}&orderInfo=${body.orderInfo ?? ''}&orderType=${body.orderType ?? ''}&partnerCode=${body.partnerCode ?? ''}&payType=${body.payType ?? ''}&requestId=${body.requestId ?? ''}&responseTime=${body.responseTime ?? ''}&resultCode=${body.resultCode ?? ''}&transId=${body.transId ?? ''}`;
    const expectedSig = createHmac('sha256', this.momoSecretKey)
      .update(raw)
      .digest('hex');
    return body.signature === expectedSig;
  }

  verifyVnpaySignature(queryOrBody: VnpayWebhookDto): boolean {
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
    if (!body.mac || !body.data) return false;
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

    await this.confirmPaymentSuccess(paymentId);
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

    await this.confirmPaymentSuccess(paymentId);
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
    if (body.data) {
      try {
        const parsed = JSON.parse(body.data);
        paymentId = Number(parsed.app_trans_id || parsed.paymentId);
      } catch {
        // ignore parse error, fallback
      }
    }
    if (!paymentId) {
      paymentId = Number(body.app_trans_id || body.paymentId);
    }

    if (!paymentId || isNaN(paymentId)) {
      throw new BadRequestException('Mã thanh toán không hợp lệ.');
    }

    await this.confirmPaymentSuccess(paymentId);
    return { return_code: 1, return_message: 'success' };
  }
}
