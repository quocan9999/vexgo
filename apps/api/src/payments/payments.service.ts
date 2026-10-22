import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { generateUuidV1 } from '../common/uuid-v1.js';
import {
  BOOKING_PAYMENT_TTL_MS,
  getBookingPaymentDeadline,
} from '../common/booking-payment-deadline.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { PaymentSettlementService } from './payment-settlement.service.js';
import { lockPaymentOrder } from './payment-order-lock.js';
import type {
  MomoWebhookDto,
  VnpayWebhookDto,
  ZaloPayWebhookDto,
} from './dto/webhook.dto.js';

const BOOKING_ORDER_PENDING_STATUS = 'CHO_THANH_TOAN';

type SepayWebhookPayload = {
  id?: unknown;
  accountNumber?: unknown;
  code?: unknown;
  content?: unknown;
  transactionDate?: unknown;
  transferType?: unknown;
  transferAmount?: unknown;
  currency?: unknown;
};

const SEPAY_VIETNAM_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;

function parseSepayTransactionDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(
    value,
  );
  if (!match) return null;

  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map(Number);
  const vietnamWallClock = new Date(
    Date.UTC(year, month - 1, day, hour, minute, second),
  );
  if (
    vietnamWallClock.getUTCFullYear() !== year ||
    vietnamWallClock.getUTCMonth() !== month - 1 ||
    vietnamWallClock.getUTCDate() !== day ||
    vietnamWallClock.getUTCHours() !== hour ||
    vietnamWallClock.getUTCMinutes() !== minute ||
    vietnamWallClock.getUTCSeconds() !== second
  ) {
    return null;
  }

  return new Date(vietnamWallClock.getTime() - SEPAY_VIETNAM_UTC_OFFSET_MS);
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'P2002'
  );
}

function isSepayTransactionIdUniqueConstraintError(error: unknown): boolean {
  if (
    !isPrismaUniqueConstraintError(error) ||
    typeof error !== 'object' ||
    error === null ||
    !('meta' in error) ||
    typeof error.meta !== 'object' ||
    error.meta === null ||
    !('target' in error.meta)
  ) {
    return false;
  }

  const target = error.meta.target;
  const targets = Array.isArray(target) ? target : [target];
  return targets.some(
    (value) =>
      typeof value === 'string' &&
      (value.includes('maGiaoDichSePay') ||
        value.includes('ThanhToan_maGiaoDichSePay_key')),
  );
}

function sepayTransactionConflict(): ConflictException {
  return new ConflictException({
    error: 'SEPAY_TRANSACTION_ALREADY_PROCESSED',
    message: 'Mã giao dịch SePay đã được liên kết với một giao dịch khác.',
  });
}

function assertPaymentMatchesProvider(
  payment: { phuongThuc: string; soTien: unknown },
  provider: string,
  amount: number,
): void {
  if (payment.phuongThuc.toUpperCase() !== provider.toUpperCase()) {
    throw new BadRequestException({
      error: 'PAYMENT_PROVIDER_MISMATCH',
      message: `Phương thức thanh toán không khớp: mong đợi ${payment.phuongThuc}, nhận được ${provider}`,
    });
  }

  const expectedAmount = Number(payment.soTien);
  const receivedAmount = Number(amount);
  if (
    !Number.isSafeInteger(expectedAmount) ||
    expectedAmount <= 0 ||
    !Number.isSafeInteger(receivedAmount) ||
    receivedAmount <= 0 ||
    expectedAmount !== receivedAmount
  ) {
    throw new BadRequestException({
      error: 'PAYMENT_AMOUNT_MISMATCH',
      message: `Số tiền thanh toán không khớp: mong đợi ${expectedAmount}, nhận được ${receivedAmount}`,
    });
  }
}

@Injectable()
export class PaymentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PaymentsService.name);
  readonly isDemoMode: boolean;
  readonly momoSecretKey: string;
  readonly vnpayHashSecret: string;
  readonly zalopayKey2: string;
  private expiryTimer?: NodeJS.Timeout;

  private readonly paymentExpiryIntervalMs = 15_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
    private readonly settlementBoundary: PaymentSettlementService =
      new PaymentSettlementService(prisma),
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

  /** Kept as a method so deadline boundary tests can freeze settlement time. */
  private getCurrentTime(): Date {
    return new Date();
  }

  onModuleInit() {
    if (process.env.NODE_ENV === 'test') return;

    void this.expireExpiredBookings().catch((error: unknown) => {
      this.logger.error(
        'Không thể chạy lượt hết hạn đơn thanh toán khi API khởi động.',
        error instanceof Error ? error.stack : undefined,
      );
    });
    this.expiryTimer = setInterval(() => {
      void this.expireExpiredBookings().catch((error: unknown) => {
        this.logger.error(
          'Không thể xử lý đơn quá hạn thanh toán.',
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, this.paymentExpiryIntervalMs);
    this.expiryTimer.unref?.();
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  async expireExpiredBookings(now = new Date()): Promise<number> {
    const expiredBefore = new Date(now.getTime() - BOOKING_PAYMENT_TTL_MS);
    const bookingCandidates = await this.prisma.phieuDatVe.findMany({
      where: {
        trangThai: BOOKING_ORDER_PENDING_STATUS,
        donGiaoDich: {
          is: {
            ngayTao: { lte: expiredBefore },
            trangThai: BOOKING_ORDER_PENDING_STATUS,
          },
        },
      },
      select: { phieuDatVeId: true },
      orderBy: { donGiaoDich: { ngayTao: 'asc' } },
      take: 100,
    });
    const shipmentCandidates = await this.prisma.donGiaoDich.findMany({
      where: {
        ngayTao: { lte: expiredBefore },
        trangThai: BOOKING_ORDER_PENDING_STATUS,
        phieuDatVe: { is: null },
        phieuGuiHang: { isNot: null },
      },
      select: { phieuGuiHang: { select: { phieuGuiHangId: true } } },
      orderBy: { ngayTao: 'asc' },
      take: 100,
    });

    let expiredCount = 0;
    for (const candidate of bookingCandidates) {
      try {
        const expired = await this.prisma.$transaction((tx) =>
          this.expirePendingBookingInTransaction(
            tx,
            candidate.phieuDatVeId,
            now,
          ),
        );
        if (expired) expiredCount += 1;
      } catch (error) {
        this.logger.error(
          `Không thể hết hạn an toàn booking #${candidate.phieuDatVeId}; cần đối soát trạng thái liên quan.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    for (const candidate of shipmentCandidates) {
      const shipment = candidate.phieuGuiHang;
      if (!shipment) continue;
      try {
        const expired = await this.prisma.$transaction((tx) =>
          this.expirePendingShipmentInTransaction(
            tx,
            shipment.phieuGuiHangId,
            now,
          ),
        );
        if (expired) expiredCount += 1;
      } catch (error) {
        this.logger.error(
          `Không thể hết hạn an toàn phiếu gửi #${shipment.phieuGuiHangId}; cần đối soát trạng thái liên quan.`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
    return expiredCount;
  }

  async expireBookingIfExpired(
    bookingId: number,
    now = new Date(),
  ): Promise<boolean> {
    return this.prisma.$transaction((tx) =>
      this.expirePendingBookingInTransaction(tx, bookingId, now),
    );
  }

  private async expirePendingBookingInTransaction(
    tx: Prisma.TransactionClient,
    bookingId: number,
    deadlineCheckTime: Date,
    historyTimestamp = deadlineCheckTime,
  ): Promise<boolean> {
    const bookingIdentity = await tx.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      select: { phieuDatVeId: true, donGiaoDichId: true },
    });
    if (!bookingIdentity) return false;

    const hasOrder = await lockPaymentOrder(tx, bookingIdentity.donGiaoDichId);
    if (!hasOrder) return false;

    const booking = await tx.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: {
        donGiaoDich: { include: { phieuGuiHang: true } },
        ves: true,
      },
    });
    if (!booking || !booking.donGiaoDich) return false;

    if (
      getBookingPaymentDeadline(booking.donGiaoDich.ngayTao) >
        deadlineCheckTime ||
      booking.trangThai !== BOOKING_ORDER_PENDING_STATUS ||
      booking.donGiaoDich.trangThai !== BOOKING_ORDER_PENDING_STATUS
    ) {
      return false;
    }

    if (booking.ves.some((ticket) => ticket.trangThai === 'DA_THANH_TOAN')) {
      throw new ConflictException({
        error: 'BOOKING_EXPIRY_STATE_CONFLICT',
        message:
          'Đơn đang chờ thanh toán nhưng có vé đã thanh toán; cần đối soát trước khi giải phóng ghế.',
      });
    }

    const successfulPayment = await tx.thanhToan.findFirst({
      where: {
        donGiaoDichId: booking.donGiaoDichId,
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'THANH_CONG',
      },
      select: { thanhToanId: true },
    });
    if (successfulPayment) {
      throw new ConflictException({
        error: 'BOOKING_EXPIRY_PAYMENT_CONFLICT',
        message:
          'Đơn đang chờ thanh toán nhưng đã có giao dịch thành công; cần đối soát trước khi giải phóng ghế.',
      });
    }

    const shipment = booking.donGiaoDich.phieuGuiHang;
    if (shipment?.trangThai === 'DA_GIAO') {
      throw new ConflictException({
        error: 'BOOKING_EXPIRY_SHIPMENT_CONFLICT',
        message:
          'Đơn đang chờ thanh toán nhưng hàng đã giao; cần đối soát trước khi hết hạn booking.',
      });
    }

    const orderUpdate = await tx.donGiaoDich.updateMany({
      where: {
        donGiaoDichId: booking.donGiaoDichId,
        trangThai: BOOKING_ORDER_PENDING_STATUS,
      },
      data: { trangThai: 'DA_HUY' },
    });
    if (orderUpdate.count === 0) return false;

    const bookingUpdate = await tx.phieuDatVe.updateMany({
      where: {
        phieuDatVeId: booking.phieuDatVeId,
        trangThai: BOOKING_ORDER_PENDING_STATUS,
      },
      data: { trangThai: 'DA_HUY' },
    });
    if (bookingUpdate.count !== 1) {
      throw new ConflictException({
        error: 'BOOKING_EXPIRY_STATE_CHANGED',
        message: 'Trạng thái booking thay đổi trong khi xử lý hết hạn.',
      });
    }

    await tx.thanhToan.updateMany({
      where: {
        donGiaoDichId: booking.donGiaoDichId,
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'DANG_XU_LY',
      },
      data: { trangThai: 'THAT_BAI' },
    });

    const operationId = generateUuidV1();
    const timestamp = historyTimestamp;
    await tx.lichSuTrangThaiPhieuDatVe.create({
      data: {
        phieuDatVeId: booking.phieuDatVeId,
        trangThaiCu: booking.trangThai,
        trangThaiMoi: 'DA_HUY',
        thoiDiem: timestamp,
        nguonThayDoi: 'SYSTEM',
        taiKhoanId: null,
        lyDo: 'Hết thời hạn thanh toán 10 phút',
        laOverride: false,
        maThaoTac: operationId,
      },
    });

    const activeTickets = booking.ves.filter(
      (ticket) => !['DA_HUY', 'HUY'].includes(ticket.trangThai),
    );
    for (const ticket of activeTickets) {
      const ticketUpdate = await tx.ve.updateMany({
        where: { veId: ticket.veId, trangThai: ticket.trangThai },
        data: { trangThai: 'DA_HUY' },
      });
      if (ticketUpdate.count !== 1) {
        throw new ConflictException({
          error: 'BOOKING_EXPIRY_TICKET_STATE_CHANGED',
          message: 'Trạng thái vé thay đổi trong khi xử lý hết hạn.',
        });
      }
      await tx.lichSuTrangThaiVe.create({
        data: {
          veId: ticket.veId,
          trangThaiCu: ticket.trangThai,
          trangThaiMoi: 'DA_HUY',
          thoiDiem: timestamp,
          nguonThayDoi: 'SYSTEM',
          taiKhoanId: null,
          lyDo: 'Hết thời hạn thanh toán booking',
          laOverride: false,
          maThaoTac: operationId,
        },
      });
    }

    const seatIds = activeTickets.map((ticket) => ticket.gheChuyenXeId);
    if (seatIds.length > 0) {
      const releasedSeats = await tx.gheChuyenXe.updateMany({
        where: {
          gheChuyenXeId: { in: seatIds },
          trangThai: { in: ['DA_DAT', 'DANG_GIU', 'DANG_GIU_CHO'] },
        },
        data: { trangThai: 'TRONG', giuChoId: null },
      });
      if (releasedSeats.count !== seatIds.length) {
        throw new ConflictException({
          error: 'BOOKING_EXPIRY_SEAT_STATE_CHANGED',
          message: 'Một hoặc nhiều ghế thay đổi trạng thái trong khi hết hạn.',
        });
      }
    }

    if (shipment && shipment.trangThai !== 'DA_HUY') {
      const shipmentUpdate = await tx.phieuGuiHang.updateMany({
        where: {
          phieuGuiHangId: shipment.phieuGuiHangId,
          trangThai: shipment.trangThai,
        },
        data: { trangThai: 'DA_HUY' },
      });
      if (shipmentUpdate.count !== 1) {
        throw new ConflictException({
          error: 'BOOKING_EXPIRY_SHIPMENT_STATE_CHANGED',
          message: 'Trạng thái vận đơn thay đổi trong khi xử lý hết hạn.',
        });
      }
      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          phieuGuiHangId: shipment.phieuGuiHangId,
          trangThai: 'DA_HUY',
          thoiGian: timestamp,
          ghiChu: 'Hủy vận đơn do booking hết hạn thanh toán.',
          taiKhoanId: null,
        },
      });
    }

    return true;
  }

  private async expirePendingShipmentInTransaction(
    tx: Prisma.TransactionClient,
    shipmentId: number,
    deadlineCheckTime: Date,
    historyTimestamp = deadlineCheckTime,
  ): Promise<boolean> {
    const shipmentIdentity = await tx.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: shipmentId },
      select: { phieuGuiHangId: true, donGiaoDichId: true },
    });
    if (!shipmentIdentity) return false;

    const hasOrder = await lockPaymentOrder(tx, shipmentIdentity.donGiaoDichId);
    if (!hasOrder) return false;

    const shipment = await tx.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: shipmentId },
      include: { donGiaoDich: { include: { phieuDatVe: true } } },
    });
    const order = shipment?.donGiaoDich;
    if (
      !shipment ||
      !order ||
      order.phieuDatVe ||
      order.trangThai !== BOOKING_ORDER_PENDING_STATUS ||
      getBookingPaymentDeadline(order.ngayTao) > deadlineCheckTime
    ) {
      return false;
    }

    if (shipment.trangThai === 'DA_GIAO') {
      throw new ConflictException({
        error: 'SHIPMENT_EXPIRY_STATE_CONFLICT',
        message:
          'Đơn đang chờ thanh toán nhưng hàng đã giao; cần đối soát trước khi hết hạn.',
      });
    }

    const successfulPayment = await tx.thanhToan.findFirst({
      where: {
        donGiaoDichId: order.donGiaoDichId,
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'THANH_CONG',
      },
      select: { thanhToanId: true },
    });
    if (successfulPayment) {
      throw new ConflictException({
        error: 'SHIPMENT_EXPIRY_PAYMENT_CONFLICT',
        message:
          'Đơn đang chờ thanh toán nhưng đã có giao dịch thành công; cần đối soát trước khi hết hạn.',
      });
    }

    const orderUpdate = await tx.donGiaoDich.updateMany({
      where: {
        donGiaoDichId: order.donGiaoDichId,
        trangThai: BOOKING_ORDER_PENDING_STATUS,
      },
      data: { trangThai: 'DA_HUY' },
    });
    if (orderUpdate.count !== 1) return false;

    if (shipment.trangThai !== 'DA_HUY') {
      const shipmentUpdate = await tx.phieuGuiHang.updateMany({
        where: {
          phieuGuiHangId: shipment.phieuGuiHangId,
          trangThai: shipment.trangThai,
        },
        data: { trangThai: 'DA_HUY' },
      });
      if (shipmentUpdate.count !== 1) {
        throw new ConflictException({
          error: 'SHIPMENT_EXPIRY_STATE_CHANGED',
          message: 'Trạng thái phiếu gửi thay đổi trong khi xử lý hết hạn.',
        });
      }
      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          phieuGuiHangId: shipment.phieuGuiHangId,
          trangThai: 'DA_HUY',
          thoiGian: historyTimestamp,
          ghiChu: 'Hết thời hạn thanh toán 10 phút.',
          taiKhoanId: null,
        },
      });
    }

    await tx.thanhToan.updateMany({
      where: {
        donGiaoDichId: order.donGiaoDichId,
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'DANG_XU_LY',
      },
      data: { trangThai: 'THAT_BAI' },
    });

    return true;
  }

  async handleSepayWebhook(params: {
    rawBody?: Buffer;
    signature?: string;
    timestamp?: string;
  }) {
    const secret = this.configService?.get<string>('SEPAY_WEBHOOK_SECRET');
    if (typeof secret !== 'string' || !secret.trim()) {
      throw new ServiceUnavailableException({
        error: 'SEPAY_WEBHOOK_NOT_CONFIGURED',
        message: 'Webhook SePay chưa được cấu hình.',
      });
    }

    const timestamp = params.timestamp ?? '';
    const signatureMatch = /^sha256=([a-f\d]{64})$/i.exec(
      params.signature ?? '',
    );
    const timestampSeconds = Number(timestamp);
    const timestampIsValid =
      /^\d{10,12}$/.test(timestamp) &&
      Number.isSafeInteger(timestampSeconds) &&
      Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) <= 300;

    if (
      !Buffer.isBuffer(params.rawBody) ||
      !signatureMatch ||
      !timestampIsValid
    ) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED_WEBHOOK',
        message: 'Chữ ký SePay Webhook không hợp lệ.',
      });
    }

    const expectedBytes = createHmac('sha256', secret)
      .update(`${timestamp}.`, 'utf8')
      .update(params.rawBody)
      .digest();
    const actualBytes = Buffer.from(signatureMatch[1], 'hex');
    if (
      expectedBytes.length !== actualBytes.length ||
      !timingSafeEqual(expectedBytes, actualBytes)
    ) {
      throw new UnauthorizedException({
        error: 'UNAUTHORIZED_WEBHOOK',
        message: 'Chữ ký SePay Webhook không hợp lệ.',
      });
    }

    let payload: SepayWebhookPayload;
    try {
      const parsed: unknown = JSON.parse(params.rawBody.toString('utf8'));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('Payload must be an object.');
      }
      payload = parsed as SepayWebhookPayload;
    } catch {
      throw new BadRequestException({
        error: 'SEPAY_PAYLOAD_INVALID',
        message: 'Dữ liệu webhook SePay không hợp lệ.',
      });
    }

    const configuredAccountNumber = this.configService?.get<string>(
      'SEPAY_ACCOUNT_NUMBER',
    );
    if (
      typeof configuredAccountNumber !== 'string' ||
      configuredAccountNumber.trim().length === 0 ||
      /\s/.test(configuredAccountNumber)
    ) {
      throw new ServiceUnavailableException({
        error: 'SEPAY_ACCOUNT_NOT_CONFIGURED',
        message: 'Tài khoản nhận tiền SePay chưa được cấu hình hợp lệ ở máy chủ.',
      });
    }

    const accountNumber = payload.accountNumber;
    if (
      typeof accountNumber !== 'string' ||
      accountNumber.trim().length === 0 ||
      /\s/.test(accountNumber)
    ) {
      throw new BadRequestException({
        error: 'SEPAY_ACCOUNT_NUMBER_INVALID',
        message: 'Webhook SePay thiếu số tài khoản nhận hợp lệ.',
      });
    }
    if (accountNumber !== configuredAccountNumber) {
      throw new BadRequestException({
        error: 'SEPAY_ACCOUNT_MISMATCH',
        message: 'Giao dịch SePay không chuyển vào tài khoản nhận đã cấu hình.',
      });
    }

    const transactionId =
      typeof payload.id === 'number' &&
      Number.isSafeInteger(payload.id) &&
      payload.id > 0
        ? String(payload.id)
        : typeof payload.id === 'string' && /^[1-9]\d{0,99}$/.test(payload.id)
          ? payload.id
          : null;
    const content = typeof payload.content === 'string' ? payload.content : '';
    const paymentCode =
      typeof payload.code === 'string' && payload.code.length > 0
        ? payload.code
        : null;
    const paymentReference = paymentCode ?? content;
    const transferAmount = payload.transferAmount;

    if (
      !transactionId ||
      !paymentReference ||
      paymentReference !== paymentReference.trim() ||
      (payload.content !== undefined &&
        payload.content !== null &&
        typeof payload.content !== 'string') ||
      (payload.code !== undefined &&
        payload.code !== null &&
        typeof payload.code !== 'string') ||
      payload.transferType !== 'in' ||
      typeof transferAmount !== 'number' ||
      !Number.isSafeInteger(transferAmount) ||
      transferAmount <= 0 ||
      (payload.currency !== undefined &&
        (typeof payload.currency !== 'string' ||
          payload.currency.toUpperCase() !== 'VND'))
    ) {
      throw new BadRequestException({
        error: 'SEPAY_TRANSACTION_INVALID',
        message:
          'Webhook SePay phải có mã đơn chính xác, giao dịch tiền vào và số tiền VND nguyên dương.',
      });
    }

    const providerTransactionAt = parseSepayTransactionDate(
      payload.transactionDate,
    );
    if (!providerTransactionAt) {
      throw new BadRequestException({
        error: 'SEPAY_TRANSACTION_DATE_INVALID',
        message: 'Thời điểm giao dịch SePay không hợp lệ.',
      });
    }

    // SePay có thể nhận diện `code` không đầy đủ dù `content` chứa đúng mã đơn.
    // Chỉ tìm mã đầy đủ; mã legacy mất dấu '-' được khôi phục theo cấu trúc cố định.
    const references = new Set<string>();
    for (const reference of [content, paymentCode]) {
      if (!reference) continue;
      references.add(reference);
      const legacy = /^([A-Z0-9]{1,8})GD([A-F\d]{30})$/.exec(reference);
      if (legacy) references.add(`${legacy[1]}-GD-${legacy[2]}`);
    }
    const matchingOrders = (await Promise.all(
      [...references].map((reference) => this.prisma.donGiaoDich.findUnique({
        where: { maDonGiaoDich: reference },
        include: { phieuDatVe: true, phieuGuiHang: true },
      })),
    )).filter((candidate) => candidate !== null);
    const order = matchingOrders[0];
    if (matchingOrders.some((candidate) => candidate.donGiaoDichId !== order?.donGiaoDichId)) {
      throw new BadRequestException({
        error: 'SEPAY_REFERENCE_MISMATCH',
        message: 'Mã thanh toán và nội dung chuyển khoản trỏ tới các đơn khác nhau.',
      });
    }
    if (!order || (!order.phieuDatVe && !order.phieuGuiHang)) {
      throw new NotFoundException({
        error: 'SEPAY_ORDER_NOT_FOUND',
        message: 'Không tìm thấy đơn giao dịch khớp chính xác với mã chuyển khoản.',
      });
    }

    const existingEvent = await this.prisma.thanhToan.findUnique({
      where: { maGiaoDichSePay: transactionId },
      include: { donGiaoDich: true },
    });
    if (existingEvent) {
      if (
        existingEvent.phuongThuc !== 'SEPAY' ||
        existingEvent.loaiGiaoDich !== 'THANH_TOAN' ||
        existingEvent.donGiaoDichId !== order.donGiaoDichId ||
        Number(existingEvent.soTien) !== transferAmount
      ) {
        throw new ConflictException({
          error: 'SEPAY_TRANSACTION_ALREADY_PROCESSED',
          message: 'Mã giao dịch SePay đã được liên kết với một đơn khác.',
        });
      }
      if (
        existingEvent.trangThai === 'THANH_CONG' ||
        existingEvent.trangThai === 'CAN_DOI_SOAT'
      ) {
        return {
          success: true,
          message: 'Webhook SePay đã được ghi nhận trước đó.',
          ...(existingEvent.trangThai === 'CAN_DOI_SOAT'
            ? { requiresReconciliation: true }
            : {}),
        };
      }
    }

    const paymentFilter = {
      donGiaoDichId: order.donGiaoDichId,
      phuongThuc: 'SEPAY',
      loaiGiaoDich: 'THANH_TOAN',
    };
    const activePayment = await this.prisma.thanhToan.findFirst({
      where: { ...paymentFilter, trangThai: 'DANG_XU_LY' },
      orderBy: [{ createdAt: 'desc' }, { thanhToanId: 'desc' }],
    });
    const settledPayment = await this.prisma.thanhToan.findFirst({
      where: { ...paymentFilter, trangThai: 'THANH_CONG' },
      orderBy: [{ createdAt: 'desc' }, { thanhToanId: 'desc' }],
    });
    const payment =
      existingEvent ??
      activePayment ??
      settledPayment ??
      (await this.prisma.thanhToan.findFirst({
        where: paymentFilter,
        orderBy: [{ createdAt: 'desc' }, { thanhToanId: 'desc' }],
      }));

    if (!payment) {
      throw new ConflictException({
        error: 'SEPAY_PAYMENT_NOT_FOUND',
        message: 'Đơn giao dịch chưa có khoản thanh toán SePay hợp lệ.',
      });
    }

    const expectedOrderAmount = Number(order.tongTien);
    const expectedPaymentAmount = Number(payment.soTien);
    if (
      !Number.isSafeInteger(expectedOrderAmount) ||
      expectedOrderAmount <= 0 ||
      expectedOrderAmount !== expectedPaymentAmount ||
      expectedOrderAmount !== transferAmount
    ) {
      throw new BadRequestException({
        error: 'PAYMENT_AMOUNT_MISMATCH',
        message: 'Số tiền SePay nhận được không khớp chính xác với đơn hàng VND.',
      });
    }

    return this.confirmPaymentSuccess({
      paymentId: payment.thanhToanId,
      provider: 'SEPAY',
      amount: transferAmount,
      providerTransactionId: transactionId,
      providerTransactionAt,
    });
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

    const paymentCheckTime = this.getCurrentTime();
    if (
      booking.donGiaoDich?.ngayTao instanceof Date &&
      booking.trangThai === BOOKING_ORDER_PENDING_STATUS &&
      booking.donGiaoDich?.trangThai === BOOKING_ORDER_PENDING_STATUS &&
      getBookingPaymentDeadline(booking.donGiaoDich.ngayTao) <= paymentCheckTime
    ) {
      await this.prisma.$transaction((tx) =>
        this.expirePendingBookingInTransaction(
          tx,
          booking.phieuDatVeId,
          paymentCheckTime,
        ),
      );
      throw new ConflictException({
        error: 'BOOKING_PAYMENT_EXPIRED',
        message: 'Đơn đặt vé đã hết hạn thanh toán.',
      });
    }

    // 1. Kiểm tra trạng thái booking & transaction ban đầu (discussion_r4226248027)
    const isCancelledInitially =
      ['DA_HUY', 'HUY'].includes(booking.trangThai) ||
      (booking.donGiaoDich && ['DA_HUY', 'HUY'].includes(booking.donGiaoDich.trangThai));
    if (isCancelledInitially) {
      throw new ConflictException({
        error: 'BOOKING_CANCELLED',
        message: 'Đơn đặt vé đã bị hủy, không thể tạo giao dịch thanh toán.',
      });
    }

    const isAlreadyPaidInitially =
      booking.trangThai === 'DA_THANH_TOAN' ||
      (booking.donGiaoDich && booking.donGiaoDich.trangThai === 'DA_THANH_TOAN');
    if (isAlreadyPaidInitially) {
      throw new ConflictException({
        error: 'BOOKING_ALREADY_PAID',
        message: 'Đơn đặt vé đã được thanh toán thành công.',
      });
    }

    if (
      booking.trangThai !== BOOKING_ORDER_PENDING_STATUS ||
      booking.donGiaoDich?.trangThai !== BOOKING_ORDER_PENDING_STATUS
    ) {
      throw new ConflictException({
        error: 'INVALID_BOOKING_STATUS',
        message: 'Trạng thái đơn đặt vé không hợp lệ để tạo giao dịch thanh toán.',
      });
    }

    const cleanProvider = (provider || 'MOMO').toUpperCase();

    // Finding A [P1] (Production demo-mode bypass / discussion_r4220529077):
    // Fail-closed guard MUST run before checking/reusing any pending payments or entering transaction
    if (!this.isDemoMode) {
      throw new ServiceUnavailableException(
        `Cổng thanh toán ${cleanProvider} chưa được cấu hình cho môi trường thực tế. Vui lòng bật PAYMENT_DEMO_MODE=true để thử nghiệm.`,
      );
    }

    // Finding B [P1]: Atomic single active payment creation with transaction & row lock
    const paymentResult = await this.prisma.$transaction(async (tx) => {
      // 1. Khóa dòng DonGiaoDich bằng SELECT ... FOR UPDATE để serialize concurrent creation
      if (booking.donGiaoDichId && typeof tx.$executeRaw === 'function') {
        await tx.$executeRaw`SELECT donGiaoDichId FROM DonGiaoDich WHERE donGiaoDichId = ${booking.donGiaoDichId} FOR UPDATE`;
      }

      // 2. Đọc lại booking và transaction bên trong tx sau khi đã giữ lock
      const currentBooking = await tx.phieuDatVe.findUnique({
        where: { phieuDatVeId: Number(bookingId) },
        include: {
          donGiaoDich: true,
        },
      });

      if (!currentBooking || !currentBooking.donGiaoDich) {
        throw new NotFoundException(`Đơn đặt vé #${bookingId} không tồn tại.`);
      }

      const paymentCheckTime = this.getCurrentTime();
      if (
        currentBooking.trangThai === BOOKING_ORDER_PENDING_STATUS &&
        currentBooking.donGiaoDich.trangThai === BOOKING_ORDER_PENDING_STATUS &&
        getBookingPaymentDeadline(currentBooking.donGiaoDich.ngayTao) <= paymentCheckTime
      ) {
        await this.expirePendingBookingInTransaction(
          tx,
          currentBooking.phieuDatVeId,
          paymentCheckTime,
        );
        return { paymentExpired: true as const };
      }

      const isCancelled =
        ['DA_HUY', 'HUY'].includes(currentBooking.trangThai) ||
        ['DA_HUY', 'HUY'].includes(currentBooking.donGiaoDich.trangThai);
      if (isCancelled) {
        throw new ConflictException({
          error: 'BOOKING_CANCELLED',
          message: 'Đơn đặt vé đã bị hủy, không thể tạo giao dịch thanh toán.',
        });
      }

      const isAlreadyPaid =
        currentBooking.trangThai === 'DA_THANH_TOAN' ||
        currentBooking.donGiaoDich.trangThai === 'DA_THANH_TOAN';
      if (isAlreadyPaid) {
        throw new ConflictException({
          error: 'BOOKING_ALREADY_PAID',
          message: 'Đơn đặt vé đã được thanh toán thành công.',
        });
      }

      if (
        currentBooking.trangThai !== BOOKING_ORDER_PENDING_STATUS ||
        currentBooking.donGiaoDich.trangThai !== BOOKING_ORDER_PENDING_STATUS
      ) {
        throw new ConflictException({
          error: 'INVALID_BOOKING_STATUS',
          message: 'Trạng thái đơn đặt vé không hợp lệ để tạo giao dịch thanh toán.',
        });
      }

      // 3. Đọc tất cả active payment attempts (DANG_XU_LY) của donGiaoDich này
      const activePayments = await tx.thanhToan.findMany({
        where: {
          donGiaoDichId: currentBooking.donGiaoDichId,
          trangThai: 'DANG_XU_LY',
        },
        orderBy: { createdAt: 'desc' },
      });

      // Case A: Đã có active payment cùng provider -> reuse
      const sameProviderActive = activePayments.find(
        (p) => p.phuongThuc.toUpperCase() === cleanProvider,
      );

      if (sameProviderActive) {
        // Tái sử dụng sameProviderActive. Nếu DB có nhiều active payment cùng provider (dirty data),
        // chuyển các attempt thừa sang THAT_BAI để bảo đảm invariant tối đa 1 active payment attempt.
        const staleActiveIds = activePayments
          .filter((p) => p.thanhToanId !== sameProviderActive.thanhToanId)
          .map((p) => p.thanhToanId);

        if (staleActiveIds.length > 0) {
          await tx.thanhToan.updateMany({
            where: { thanhToanId: { in: staleActiveIds } },
            data: { trangThai: 'THAT_BAI' },
          });
          this.logger.log(
            `Superseded ${staleActiveIds.length} duplicate active payment attempt(s) for donGiaoDich #${currentBooking.donGiaoDichId} to THAT_BAI.`,
          );
        }

        const existingAmount = Number(sameProviderActive.soTien);
        const existingUrl = `https://sandbox.${cleanProvider.toLowerCase()}.vn/pay?id=${sameProviderActive.thanhToanId}&amount=${existingAmount}`;
        const existingDeeplink = `${cleanProvider.toLowerCase()}://app?id=${sameProviderActive.thanhToanId}`;

        return {
          paymentId: sameProviderActive.thanhToanId,
          bookingId: currentBooking.phieuDatVeId,
          provider: cleanProvider,
          amount: existingAmount,
          paymentUrl: existingUrl,
          deeplink: existingDeeplink,
          status: 'PENDING',
          mode: 'DEMO',
          createdAt:
            sameProviderActive.createdAt?.toISOString?.() ??
            new Date().toISOString(),
          paymentExpiresAt: getBookingPaymentDeadline(
            currentBooking.donGiaoDich.ngayTao,
          ).toISOString(),
        };
      }

      // Case B: Không có active payment cùng provider, nhưng có active payment khác provider (hoặc dirty data)
      // Supersede toàn bộ active attempts cũ sang THAT_BAI trước khi tạo payment mới
      if (activePayments.length > 0) {
        await tx.thanhToan.updateMany({
          where: {
            thanhToanId: { in: activePayments.map((p) => p.thanhToanId) },
          },
          data: { trangThai: 'THAT_BAI' },
        });
        this.logger.log(
          `Superseded ${activePayments.length} active payment attempt(s) of different provider(s) for donGiaoDich #${currentBooking.donGiaoDichId} to THAT_BAI before creating ${cleanProvider} attempt.`,
        );
      }

      // Case C: Tạo đúng 1 payment record mới với trạng thái DANG_XU_LY
      const payment = await tx.thanhToan.create({
        data: {
          soTien: currentBooking.donGiaoDich.tongTien,
          phuongThuc: cleanProvider,
          loaiGiaoDich: 'THANH_TOAN',
          thoiGian: new Date(),
          trangThai: 'DANG_XU_LY',
          donGiaoDichId: currentBooking.donGiaoDichId,
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
        bookingId: currentBooking.phieuDatVeId,
        provider: cleanProvider,
        amount,
        paymentUrl,
        deeplink,
        status: 'PENDING',
        mode: 'DEMO',
        createdAt:
          payment.createdAt?.toISOString?.() ?? new Date().toISOString(),
        paymentExpiresAt: getBookingPaymentDeadline(
          currentBooking.donGiaoDich.ngayTao,
        ).toISOString(),
      };
    });

    if ('paymentExpired' in paymentResult) {
      throw new ConflictException({
        error: 'BOOKING_PAYMENT_EXPIRED',
        message: 'Đơn đặt vé đã hết hạn thanh toán.',
      });
    }

    return paymentResult;
  }

  async getPaymentStatus(paymentId: number, principal?: AuthPrincipal) {
    const payment = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: Number(paymentId) },
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
    const booking = payment.donGiaoDich?.phieuDatVe;
    const shipment = payment.donGiaoDich?.phieuGuiHang;
    const paymentOrder = payment.donGiaoDich;
    const paymentCreatedAt = paymentOrder?.ngayTao;
    const paymentExpiresAt = paymentCreatedAt
      ? getBookingPaymentDeadline(paymentCreatedAt)
      : null;
    const bookingPaymentIsPending =
      paymentOrder?.trangThai === BOOKING_ORDER_PENDING_STATUS &&
      (!booking || booking.trangThai === BOOKING_ORDER_PENDING_STATUS) &&
      (!shipment || shipment.trangThai !== 'DA_HUY');
    const paymentHasExpired =
      bookingPaymentIsPending &&
      paymentExpiresAt !== null &&
      paymentExpiresAt <= new Date();
    const additionalSePayTransfer = paymentOrder
      ? await this.prisma.thanhToan.findFirst({
          where: {
            donGiaoDichId: paymentOrder.donGiaoDichId,
            phuongThuc: 'SEPAY',
            loaiGiaoDich: 'THANH_TOAN',
            trangThai: 'CAN_DOI_SOAT',
            maGiaoDichSePay: { not: null },
          },
          select: { thanhToanId: true },
        })
      : null;
    const status = paymentHasExpired
      ? 'EXPIRED'
      : isSuccess
        ? 'SUCCESS'
        : isFailed
          ? 'FAILED'
          : 'PENDING';
    const requiresReconciliation = Boolean(additionalSePayTransfer) ||
      (isSuccess &&
        (['DA_HUY', 'HUY'].includes(paymentOrder?.trangThai ?? '') ||
          ['DA_HUY', 'HUY'].includes(booking?.trangThai ?? '') ||
          shipment?.trangThai === 'DA_HUY'));

    return {
      paymentId: payment.thanhToanId,
      bookingId: booking?.phieuDatVeId ?? 0,
      orderId: paymentOrder?.donGiaoDichId ?? payment.donGiaoDichId,
      orderCode: paymentOrder?.maDonGiaoDich ?? null,
      orderStatus: paymentOrder?.trangThai ?? null,
      shipmentId: shipment?.phieuGuiHangId ?? null,
      shipmentStatus: shipment?.trangThai ?? null,
      provider: payment.phuongThuc,
      amount: Number(payment.soTien),
      status,
      paymentStatus: payment.trangThai,
      requiresReconciliation,
      bookingStatus: paymentHasExpired && booking
        ? 'HET_HAN'
        : (booking?.trangThai ?? null),
      paymentExpiresAt: paymentExpiresAt?.toISOString() ?? null,
      serverTime: new Date().toISOString(),
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
    providerTransactionId?: string;
    providerTransactionAt?: Date;
  }) {
    const paymentReference = await this.prisma.thanhToan.findUnique({
      where: { thanhToanId: Number(params.paymentId) },
      select: { phuongThuc: true, soTien: true },
    });
    if (!paymentReference) {
      throw new NotFoundException(
        `Giao dịch thanh toán #${params.paymentId} không tồn tại.`,
      );
    }
    assertPaymentMatchesProvider(
      paymentReference,
      params.provider,
      params.amount,
    );

    type SettlementOutcome =
      | 'settled'
      | 'already-claimed'
      | 'already-successful'
      | 'late-booking'
      | 'late-shipment'
      | 'duplicate-settlement'
      | 'additional-transfer';

    let outcome: SettlementOutcome;
    try {
      outcome = await this.settlementBoundary.withLockedPayment(
        Number(params.paymentId),
        async (tx, payment) => {
          assertPaymentMatchesProvider(payment, params.provider, params.amount);
          if (payment.loaiGiaoDich === 'HOAN_TIEN') {
            throw new ConflictException({
              error: 'PAYMENT_SETTLEMENT_NOT_ALLOWED',
              message: 'Không thể xác nhận khoản hoàn tiền như một khoản thanh toán.',
            });
          }

          const order = payment.donGiaoDich;
          const booking = order?.phieuDatVe;
          const shipment = order?.phieuGuiHang;
          const settlementTime = this.getCurrentTime();
          const financialTransactionTime =
            params.providerTransactionAt ?? settlementTime;
          const isCancelled =
            ['DA_HUY', 'HUY'].includes(order?.trangThai ?? '') ||
            ['DA_HUY', 'HUY'].includes(booking?.trangThai ?? '') ||
            shipment?.trangThai === 'DA_HUY';

          if (payment.trangThai === 'THANH_CONG') {
            if (params.providerTransactionId) {
              if (
                payment.maGiaoDichSePay !== null &&
                payment.maGiaoDichSePay !== params.providerTransactionId
              ) {
                if (params.provider !== 'SEPAY') {
                  throw sepayTransactionConflict();
                }

                const recordedTransfer = await tx.thanhToan.findUnique({
                  where: { maGiaoDichSePay: params.providerTransactionId },
                });
                if (recordedTransfer) {
                  if (
                    recordedTransfer.donGiaoDichId !== payment.donGiaoDichId ||
                    recordedTransfer.phuongThuc !== 'SEPAY' ||
                    recordedTransfer.loaiGiaoDich !== 'THANH_TOAN' ||
                    recordedTransfer.trangThai !== 'CAN_DOI_SOAT' ||
                    !recordedTransfer.soTien.equals(params.amount)
                  ) {
                    throw sepayTransactionConflict();
                  }
                  return 'additional-transfer';
                }

                await tx.thanhToan.create({
                  data: {
                    soTien: payment.soTien,
                    phuongThuc: 'SEPAY',
                    maGiaoDichSePay: params.providerTransactionId,
                    loaiGiaoDich: 'THANH_TOAN',
                    thoiGian: financialTransactionTime,
                    thoiDiemHoanTat: financialTransactionTime,
                    trangThai: 'CAN_DOI_SOAT',
                    laQuyetToanHopLe: false,
                    donGiaoDichId: payment.donGiaoDichId,
                  },
                });
                this.logger.warn(
                  `Additional SePay transfer ${params.providerTransactionId} was recorded for already-settled order #${payment.donGiaoDichId}; reconciliation is required.`,
                );
                return 'additional-transfer';
              }
              if (payment.maGiaoDichSePay === null) {
                const linked = await tx.thanhToan.updateMany({
                  where: {
                    thanhToanId: payment.thanhToanId,
                    trangThai: 'THANH_CONG',
                    maGiaoDichSePay: null,
                  },
                  data: { maGiaoDichSePay: params.providerTransactionId },
                });
                if (linked.count !== 1) {
                  const currentPayment = await tx.thanhToan.findUnique({
                    where: { thanhToanId: payment.thanhToanId },
                    select: { maGiaoDichSePay: true },
                  });
                  if (
                    currentPayment?.maGiaoDichSePay !==
                    params.providerTransactionId
                  ) {
                    throw sepayTransactionConflict();
                  }
                }
              }
            }

            if (isCancelled) return booking ? 'late-booking' : 'late-shipment';

            if (order?.trangThai === 'CHO_THANH_TOAN') {
              const orderUpdate = await tx.donGiaoDich.updateMany({
                where: {
                  donGiaoDichId: payment.donGiaoDichId,
                  trangThai: 'CHO_THANH_TOAN',
                },
                data: { trangThai: 'DA_THANH_TOAN' },
              });
              if (orderUpdate.count !== 1) {
                throw new ConflictException({
                  error: 'PAYMENT_ORDER_STATE_CHANGED',
                  message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
                });
              }
            } else if (order?.trangThai !== 'DA_THANH_TOAN') {
              throw new ConflictException({
                error: 'PAYMENT_ORDER_STATE_CHANGED',
                message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
              });
            }

            return 'already-successful';
          }

          if (!order) {
            throw new ConflictException({
              error: 'PAYMENT_ORDER_NOT_FOUND',
              message: 'Không tìm thấy đơn giao dịch của khoản thanh toán.',
            });
          }

          if (
            payment.trangThai !== 'THANH_CONG' &&
            order.trangThai === BOOKING_ORDER_PENDING_STATUS &&
            getBookingPaymentDeadline(order.ngayTao) <=
              financialTransactionTime
          ) {
            if (booking) {
              await this.expirePendingBookingInTransaction(
                tx,
                booking.phieuDatVeId,
                financialTransactionTime,
                settlementTime,
              );
            } else if (shipment) {
              await this.expirePendingShipmentInTransaction(
                tx,
                shipment.phieuGuiHangId,
                financialTransactionTime,
                settlementTime,
              );
            }
          }

          const paymentClaimWhere: Prisma.ThanhToanWhereInput = {
            thanhToanId: payment.thanhToanId,
            trangThai: { not: 'THANH_CONG' },
            thoiDiemHoanTat: null,
          };
          const paymentClaimData: Prisma.ThanhToanUpdateManyMutationInput = {
            trangThai: 'THANH_CONG',
            thoiDiemHoanTat: financialTransactionTime,
          };
          if (params.providerTransactionId) {
            paymentClaimWhere.maGiaoDichSePay = null;
            paymentClaimData.maGiaoDichSePay = params.providerTransactionId;
          }

          const claimResult = await tx.thanhToan.updateMany({
            where: paymentClaimWhere,
            data: paymentClaimData,
          });
          if (claimResult.count === 0) {
            if (params.providerTransactionId) {
              const currentPayment = await tx.thanhToan.findUnique({
                where: { thanhToanId: payment.thanhToanId },
                select: { maGiaoDichSePay: true },
              });
              if (currentPayment?.maGiaoDichSePay !== params.providerTransactionId) {
                throw sepayTransactionConflict();
              }
            }
            return 'already-claimed';
          }

          if (booking) {
            const currentOrder = await tx.donGiaoDich.findUnique({
              where: { donGiaoDichId: payment.donGiaoDichId },
            });
            const currentBooking = await tx.phieuDatVe.findUnique({
              where: { phieuDatVeId: booking.phieuDatVeId },
              include: { ves: true },
            });
            const bookingCancelled =
              ['DA_HUY', 'HUY'].includes(currentBooking?.trangThai ?? '') ||
              ['DA_HUY', 'HUY'].includes(currentOrder?.trangThai ?? '');

            if (bookingCancelled) {
              this.logger.warn(
                `Payment #${payment.thanhToanId} confirmed SUCCESS for ALREADY CANCELLED booking/transaction #${booking.phieuDatVeId}. Kept booking and tickets CANCELLED. Requires reconciliation.`,
              );
              return 'late-booking';
            }

            if (
              currentOrder?.trangThai === 'DA_THANH_TOAN' ||
              currentBooking?.trangThai === 'DA_THANH_TOAN'
            ) {
              this.logger.warn(
                `Payment #${payment.thanhToanId} confirmed SUCCESS via provider callback, but transaction #${payment.donGiaoDichId} / booking #${booking.phieuDatVeId} was ALREADY SETTLED. Requires reconciliation.`,
              );
              return 'duplicate-settlement';
            }

            if (currentOrder?.trangThai !== BOOKING_ORDER_PENDING_STATUS) {
              throw new ConflictException({
                error: 'PAYMENT_ORDER_STATE_CHANGED',
                message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
              });
            }

            const updateOrderResult = await tx.donGiaoDich.updateMany({
              where: {
                donGiaoDichId: payment.donGiaoDichId,
                trangThai: BOOKING_ORDER_PENDING_STATUS,
              },
              data: { trangThai: 'DA_THANH_TOAN' },
            });
            if (updateOrderResult.count !== 1) {
              const latestOrder = await tx.donGiaoDich.findUnique({
                where: { donGiaoDichId: payment.donGiaoDichId },
              });
              if (
                ['DA_HUY', 'HUY'].includes(latestOrder?.trangThai ?? '') ||
                ['DA_HUY', 'HUY'].includes(currentBooking?.trangThai ?? '')
              ) {
                return 'late-booking';
              }
              if (
                latestOrder?.trangThai === 'DA_THANH_TOAN' ||
                currentBooking?.trangThai === 'DA_THANH_TOAN'
              ) {
                return 'duplicate-settlement';
              }
              throw new ConflictException({
                error: 'PAYMENT_ORDER_STATE_CHANGED',
                message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
              });
            }

            const updateBookingResult = await tx.phieuDatVe.updateMany({
              where: {
                phieuDatVeId: booking.phieuDatVeId,
                trangThai: BOOKING_ORDER_PENDING_STATUS,
              },
              data: { trangThai: 'DA_THANH_TOAN' },
            });
            if (updateBookingResult.count === 0) {
              throw new ConflictException({
                error: 'BOOKING_STATE_CHANGED',
                message:
                  'Trạng thái đặt vé đã thay đổi; giao dịch thanh toán chưa được quyết toán.',
              });
            }

            let activeTickets: Array<{ veId: number }> = [];
            if (tx.ve) {
              await tx.ve.updateMany({
                where: {
                  phieuDatVeId: booking.phieuDatVeId,
                  trangThai: { notIn: ['DA_HUY', 'HUY'] },
                },
                data: { trangThai: 'DA_THANH_TOAN' },
              });
              activeTickets = await tx.ve.findMany({
                where: {
                  phieuDatVeId: booking.phieuDatVeId,
                  trangThai: 'DA_THANH_TOAN',
                },
              });
            }

            await tx.thanhToan.updateMany({
              where: {
                donGiaoDichId: payment.donGiaoDichId,
                thanhToanId: { not: payment.thanhToanId },
                trangThai: 'DANG_XU_LY',
              },
              data: { trangThai: 'THAT_BAI' },
            });

            const operationId = generateUuidV1();
            const timestamp = new Date();
            const providerName = payment.phuongThuc.toUpperCase();
            if (tx.lichSuTrangThaiPhieuDatVe) {
              await tx.lichSuTrangThaiPhieuDatVe.create({
                data: {
                  phieuDatVeId: booking.phieuDatVeId,
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
            await tx.thanhToan.update({
              where: { thanhToanId: payment.thanhToanId },
              data: { laQuyetToanHopLe: true },
            });
            return 'settled';
          }

          if (!shipment) {
            throw new ConflictException({
              error: 'PAYMENT_ORDER_NOT_SETTLEABLE',
              message: 'Đơn giao dịch không có booking hoặc phiếu gửi hàng hợp lệ.',
            });
          }

          const currentOrder = await tx.donGiaoDich.findUnique({
            where: { donGiaoDichId: payment.donGiaoDichId },
            include: { phieuGuiHang: true },
          });
          if (
            ['DA_HUY', 'HUY'].includes(currentOrder?.trangThai ?? '') ||
            currentOrder?.phieuGuiHang?.trangThai === 'DA_HUY'
          ) {
            return 'late-shipment';
          }
          if (currentOrder?.trangThai === 'DA_THANH_TOAN') {
            return 'duplicate-settlement';
          }
          if (currentOrder?.trangThai !== BOOKING_ORDER_PENDING_STATUS) {
            throw new ConflictException({
              error: 'PAYMENT_ORDER_STATE_CHANGED',
              message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
            });
          }

          const updateOrderResult = await tx.donGiaoDich.updateMany({
            where: {
              donGiaoDichId: payment.donGiaoDichId,
              trangThai: BOOKING_ORDER_PENDING_STATUS,
            },
            data: { trangThai: 'DA_THANH_TOAN' },
          });
          if (updateOrderResult.count !== 1) {
            const latestOrder = await tx.donGiaoDich.findUnique({
              where: { donGiaoDichId: payment.donGiaoDichId },
              include: { phieuGuiHang: true },
            });
            if (
              ['DA_HUY', 'HUY'].includes(latestOrder?.trangThai ?? '') ||
              latestOrder?.phieuGuiHang?.trangThai === 'DA_HUY'
            ) {
              return 'late-shipment';
            }
            if (latestOrder?.trangThai === 'DA_THANH_TOAN') {
              return 'duplicate-settlement';
            }
            throw new ConflictException({
              error: 'PAYMENT_ORDER_STATE_CHANGED',
              message: 'Trạng thái đơn giao dịch không cho phép xác nhận thanh toán.',
            });
          }
          await tx.thanhToan.updateMany({
            where: {
              donGiaoDichId: payment.donGiaoDichId,
              thanhToanId: { not: payment.thanhToanId },
              trangThai: 'DANG_XU_LY',
            },
            data: { trangThai: 'THAT_BAI' },
          });
          await tx.thanhToan.update({
            where: { thanhToanId: payment.thanhToanId },
            data: { laQuyetToanHopLe: true },
          });
          return 'settled';
        },
      );
    } catch (error) {
      if (isSepayTransactionIdUniqueConstraintError(error)) {
        throw sepayTransactionConflict();
      }
      throw error;
    }

    if (outcome === 'already-claimed' || outcome === 'already-successful') {
      this.logger.log(
        `Payment #${params.paymentId} was already claimed/confirmed by concurrent transaction.`,
      );
      return { success: true, message: 'Giao dịch đã được xác nhận trước đó.' };
    }
    if (outcome === 'late-booking') {
      return {
        success: true,
        isLatePayment: true,
        message:
          'Thanh toán thành công nhưng đơn đặt vé đã bị hủy trước đó. Cần hoàn tiền cho khách.',
      };
    }
    if (outcome === 'late-shipment') {
      return {
        success: true,
        isLatePayment: true,
        requiresReconciliation: true,
        message:
          'Thanh toán thành công nhưng phiếu gửi hàng đã bị hủy trước đó. Cần đối soát khoản thu.',
      };
    }
    if (outcome === 'duplicate-settlement') {
      return {
        success: true,
        isLatePayment: true,
        requiresReconciliation: true,
        message:
          'Thanh toán thành công nhưng giao dịch đã được thanh toán bởi phương thức khác. Cần đối soát/hoàn tiền.',
      };
    }
    if (outcome === 'additional-transfer') {
      return {
        success: true,
        requiresReconciliation: true,
        message:
          'Khoản chuyển khoản bổ sung đã được ghi nhận; đơn không được quyết toán lại và cần đối soát khoản thu.',
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
