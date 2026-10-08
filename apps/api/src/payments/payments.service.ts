import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
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
      (this.isDemoMode ? 'vexgo_momo_demo_secret' : '');
    this.vnpayHashSecret =
      this.configService?.get<string>('VNPAY_HASH_SECRET') ||
      (this.isDemoMode ? 'vexgo_vnpay_demo_secret' : '');
    this.zalopayKey2 =
      this.configService?.get<string>('ZALOPAY_KEY2') ||
      (this.isDemoMode ? 'vexgo_zalopay_demo_key2' : '');
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

        const phieuDatVe = payment.donGiaoDich.phieuDatVe;
        if (phieuDatVe) {
          await tx.phieuDatVe.update({
            where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
            data: { trangThai: 'DA_THANH_TOAN' },
          });

          // Cập nhật tất cả vé sang DA_THANH_TOAN
          let tickets: any[] = [];
          if (tx.ve) {
            await tx.ve.updateMany({
              where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
              data: { trangThai: 'DA_THANH_TOAN' },
            });
            tickets = await tx.ve.findMany({
              where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
            });
          }

          const operationId = generateUuidV1();
          const timestamp = new Date();
          const providerName = payment.phuongThuc.toUpperCase();

          if (tx.lichSuTrangThaiPhieuDatVe) {
            await tx.lichSuTrangThaiPhieuDatVe.create({
              data: {
                phieuDatVeId: phieuDatVe.phieuDatVeId,
                trangThaiCu: phieuDatVe.trangThai || 'CHO_THANH_TOAN',
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
            for (const ticket of tickets) {
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
