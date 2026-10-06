import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { MomoPaymentProvider } from './providers/momo-payment.provider.js';
import { VnpayPaymentProvider } from './providers/vnpay-payment.provider.js';
import type { CreatePaymentDto } from './dto/create-payment.dto.js';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly momoProvider: MomoPaymentProvider,
    private readonly vnpayProvider: VnpayPaymentProvider,
  ) {}

  async createPayment(dto: CreatePaymentDto, clientIp?: string) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: Number(dto.bookingId) },
      include: {
        donGiaoDich: true,
      },
    });

    if (!booking) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'BOOKING_NOT_FOUND',
        message: `Đơn đặt vé #${dto.bookingId} không tồn tại.`,
      });
    }

    if (booking.trangThai === 'DA_THANH_TOAN') {
      throw new BadRequestException({
        statusCode: 400,
        error: 'BOOKING_ALREADY_PAID',
        message: 'Đơn đặt vé này đã được thanh toán thành công.',
      });
    }

    if (booking.trangThai === 'DA_HUY') {
      throw new BadRequestException({
        statusCode: 400,
        error: 'BOOKING_CANCELLED',
        message: 'Đơn đặt vé đã bị hủy, không thể thanh toán.',
      });
    }

    const cleanProvider = (dto.provider || 'MOMO').toUpperCase();
    const amount = Number(booking.donGiaoDich.tongTien);

    // Lưu bản ghi ThanhToan trạng thái DANG_XU_LY
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

    const paymentParams = {
      paymentId: payment.thanhToanId,
      amount,
      orderInfo: `Thanh toan ve xe VexGo #${booking.maPhieuDatVe || payment.thanhToanId}`,
      returnUrl: dto.returnUrl,
      clientIp: clientIp || '127.0.0.1',
      extraData: dto.extraData,
    };

    let result;
    if (cleanProvider === 'MOMO') {
      result = await this.momoProvider.createPayment(paymentParams);
    } else if (cleanProvider === 'VNPAY') {
      result = await this.vnpayProvider.createPayment(paymentParams);
    } else {
      throw new BadRequestException({
        statusCode: 400,
        error: 'UNSUPPORTED_PAYMENT_PROVIDER',
        message: `Cổng thanh toán ${cleanProvider} chưa được hỗ trợ.`,
      });
    }

    return {
      data: {
        paymentId: payment.thanhToanId,
        bookingId: booking.phieuDatVeId,
        provider: cleanProvider,
        amount,
        paymentUrl: result.paymentUrl,
        qrCodeUrl: result.qrCodeUrl || null,
        deeplink: result.deeplink || null,
        status: payment.trangThai,
        createdAt: payment.createdAt.toISOString(),
      },
    };
  }

  async completeBookingPayment(paymentId: number, transactionNo?: string) {
    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.thanhToan.findUnique({
        where: { thanhToanId: Number(paymentId) },
        include: {
          donGiaoDich: {
            include: {
              phieuDatVe: {
                include: {
                  ves: true,
                },
              },
            },
          },
        },
      });

      if (!payment) {
        throw new NotFoundException(`Giao dịch thanh toán #${paymentId} không tồn tại.`);
      }

      // Idempotency check: nếu đã hoàn tất thì bỏ qua
      if (payment.trangThai === 'THANH_CONG') {
        this.logger.log(`Payment #${paymentId} already THANH_CONG (idempotent).`);
        return payment;
      }

      // 1. Cập nhật ThanhToan
      const updatedPayment = await tx.thanhToan.update({
        where: { thanhToanId: payment.thanhToanId },
        data: {
          trangThai: 'THANH_CONG',
          thoiGian: new Date(),
        },
      });

      // 2. Cập nhật DonGiaoDich và PhieuDatVe
      const booking = payment.donGiaoDich?.phieuDatVe;
      if (payment.donGiaoDich) {
        await tx.donGiaoDich.update({
          where: { donGiaoDichId: payment.donGiaoDichId },
          data: { trangThai: 'DA_THANH_TOAN' },
        });

        if (booking) {
          await tx.phieuDatVe.update({
            where: { phieuDatVeId: booking.phieuDatVeId },
            data: { trangThai: 'DA_THANH_TOAN' },
          });

          // 3. Khóa ghế chính thức: chuyển Ve và GheChuyenXe sang DA_DAT
          if (booking.ves && booking.ves.length > 0) {
            await tx.ve.updateMany({
              where: { phieuDatVeId: booking.phieuDatVeId },
              data: { trangThai: 'DA_DAT' },
            });

            const gheChuyenXeIds = booking.ves.map((v) => v.gheChuyenXeId);
            await tx.gheChuyenXe.updateMany({
              where: {
                gheChuyenXeId: { in: gheChuyenXeIds },
              },
              data: {
                trangThai: 'DA_DAT',
              },
            });
          }

          // 4. Sinh Hóa Đơn (HoaDon) nếu chưa có
          await tx.hoaDon.upsert({
            where: { donGiaoDichId: payment.donGiaoDichId },
            create: {
              maHoaDon: `HD-${payment.donGiaoDichId}-${Date.now().toString().slice(-6)}`,
              ngayLap: new Date(),
              tongTien: payment.soTien,
              trangThai: 'DA_THANH_TOAN',
              donGiaoDichId: payment.donGiaoDichId,
            },
            update: {
              trangThai: 'DA_THANH_TOAN',
            },
          });
        }
      }

      this.logger.log(
        `Payment #${paymentId} confirmed SUCCESS. Booking #${booking?.phieuDatVeId} marked DA_THANH_TOAN. TransactionNo: ${transactionNo || 'N/A'}`,
      );

      return updatedPayment;
    });
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
      throw new NotFoundException({
        statusCode: 404,
        error: 'PAYMENT_NOT_FOUND',
        message: `Giao dịch thanh toán #${paymentId} không tồn tại.`,
      });
    }

    return {
      data: {
        paymentId: payment.thanhToanId,
        bookingId: payment.donGiaoDich?.phieuDatVe?.phieuDatVeId ?? 0,
        provider: payment.phuongThuc,
        amount: Number(payment.soTien),
        status: payment.trangThai,
        paidAt:
          payment.trangThai === 'THANH_CONG'
            ? payment.thoiGian.toISOString()
            : null,
      },
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
      throw new NotFoundException({
        statusCode: 404,
        error: 'PAYMENT_NOT_FOUND',
        message: `Giao dịch thanh toán #${paymentId} không tồn tại.`,
      });
    }

    return {
      data: {
        paymentId: payment.thanhToanId,
        bookingId: payment.donGiaoDich?.phieuDatVe?.phieuDatVeId ?? 0,
        provider: payment.phuongThuc,
        amount: Number(payment.soTien),
        status: payment.trangThai,
        createdAt: payment.createdAt.toISOString(),
        updatedAt: payment.updatedAt.toISOString(),
      },
    };
  }

  async handleMomoIpn(body: any) {
    this.logger.log(`Received MoMo IPN: orderId=${body?.orderId}, resultCode=${body?.resultCode}`);
    const verify = await this.momoProvider.verifyIpn(body);

    if (!verify.isValid) {
      this.logger.warn(`MoMo IPN signature invalid for orderId=${body?.orderId}`);
      return { resultCode: 99, message: 'Invalid signature' };
    }

    if (verify.isSuccess && verify.paymentId) {
      await this.completeBookingPayment(verify.paymentId, verify.transactionNo);
      return { resultCode: 0, message: 'Received' };
    }

    // Giao dịch không thành công
    if (verify.paymentId) {
      await this.prisma.thanhToan.updateMany({
        where: { thanhToanId: verify.paymentId, trangThai: 'DANG_XU_LY' },
        data: { trangThai: 'THAT_BAI' },
      });
    }

    return { resultCode: 0, message: 'Received' };
  }

  async handleVnpayIpn(query: any) {
    this.logger.log(`Received VNPay IPN: txnRef=${query?.vnp_TxnRef}, responseCode=${query?.vnp_ResponseCode}`);
    const verify = await this.vnpayProvider.verifyIpn(query);

    if (!verify.isValid) {
      this.logger.warn(`VNPay IPN signature invalid for txnRef=${query?.vnp_TxnRef}`);
      return { RspCode: '97', Message: 'Invalid Checksum' };
    }

    if (verify.isSuccess && verify.paymentId) {
      await this.completeBookingPayment(verify.paymentId, verify.transactionNo);
      return { RspCode: '00', Message: 'Confirm Success' };
    }

    // Giao dịch không thành công
    if (verify.paymentId) {
      await this.prisma.thanhToan.updateMany({
        where: { thanhToanId: verify.paymentId, trangThai: 'DANG_XU_LY' },
        data: { trangThai: 'THAT_BAI' },
      });
    }

    return { RspCode: '00', Message: 'Confirm Success' };
  }

  async handleVnpayReturn(query: any) {
    const verify = await this.vnpayProvider.verifyIpn(query);
    if (verify.isSuccess && verify.paymentId) {
      await this.completeBookingPayment(verify.paymentId, verify.transactionNo);
    }
    return {
      data: {
        paymentId: verify.paymentId,
        isValid: verify.isValid,
        isSuccess: verify.isSuccess,
        amount: verify.amount,
        transactionNo: verify.transactionNo || null,
      },
    };
  }
}
