import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { RefundProcessorService } from '../payments/refund-processor.service.js';
import {
  combineDeparture,
  computeArrival,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { TicketQueryDto } from './dto/ticket-query.dto.js';
import type { TicketLookupQueryDto } from './dto/ticket-lookup-query.dto.js';
import type { CancelTicketDto } from './dto/cancel-ticket.dto.js';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}

function phonesMatch(phone1: string, phone2: string): boolean {
  const d1 = normalizePhone(phone1);
  const d2 = normalizePhone(phone2);
  if (!d1 || !d2) return false;
  return (
    d1 === d2 ||
    (d1.length >= 9 && d2.length >= 9 && d1.slice(-9) === d2.slice(-9))
  );
}

const TICKET_INCLUDE = {
  phieuDatVe: {
    include: {
      donGiaoDich: {
        include: {
          khachHang: true,
          nhaXe: true,
          thanhToans: {
            where: {
              loaiGiaoDich: 'THANH_TOAN',
              trangThai: 'THANH_CONG',
            },
            orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
            take: 1,
          },
        },
      },
    },
  },
  gheChuyenXe: {
    include: {
      ghe: true,
      chuyenXe: {
        include: {
          tuyenXe: { include: { nhaXe: true } },
          xe: { include: { loaiXe: true } },
        },
      },
    },
  },
} satisfies Prisma.VeInclude;

type TicketRecord = Prisma.VeGetPayload<{ include: typeof TICKET_INCLUDE }>;

type CancellationReason =
  | 'ALREADY_CANCELLED'
  | 'ALREADY_DEPARTED'
  | 'LESS_THAN_12_HOURS'
  | 'DEPARTURE_TIME_UNAVAILABLE';

type CancellationQuote = {
  eligible: boolean;
  reason?: CancellationReason;
  cancelFeeRate: number;
  cancelFee: Prisma.Decimal;
  refundAmount: Prisma.Decimal;
};

function getCancellationQuote(
  ticket: TicketRecord,
  businessTimeZone: string,
  now = new Date(),
): CancellationQuote {
  const price = new Prisma.Decimal(ticket.giaThucTe ?? ticket.giaNiemYet ?? 0);
  const zero = new Prisma.Decimal(0);

  if (ticket.trangThai === 'HUY') {
    return {
      eligible: false,
      reason: 'ALREADY_CANCELLED',
      cancelFeeRate: 0,
      cancelFee: zero,
      refundAmount: zero,
    };
  }

  const trip = ticket.gheChuyenXe?.chuyenXe;
  if (!trip?.ngayKhoiHanh || !trip?.gioKhoiHanh) {
    return {
      eligible: false,
      reason: 'DEPARTURE_TIME_UNAVAILABLE',
      cancelFeeRate: 0,
      cancelFee: zero,
      refundAmount: zero,
    };
  }

  const departure = combineDeparture(
    trip.ngayKhoiHanh,
    trip.gioKhoiHanh,
    businessTimeZone,
  );
  const hoursUntilDeparture =
    (departure.getTime() - now.getTime()) / (60 * 60 * 1000);

  if (hoursUntilDeparture <= 0) {
    return {
      eligible: false,
      reason: 'ALREADY_DEPARTED',
      cancelFeeRate: 0,
      cancelFee: zero,
      refundAmount: zero,
    };
  }

  if (hoursUntilDeparture < 12) {
    return {
      eligible: false,
      reason: 'LESS_THAN_12_HOURS',
      cancelFeeRate: 0,
      cancelFee: zero,
      refundAmount: zero,
    };
  }

  const cancelFeeRate = hoursUntilDeparture <= 24 ? 0.2 : 0.1;
  const cancelFee = price.mul(cancelFeeRate.toString()).toDecimalPlaces(0);

  return {
    eligible: true,
    cancelFeeRate,
    cancelFee,
    refundAmount: price.minus(cancelFee),
  };
}

function serializeCancellationQuote(quote: CancellationQuote) {
  return {
    eligible: quote.eligible,
    reason: quote.reason,
    cancelFeeRate: quote.cancelFeeRate,
    cancelFee: Number(quote.cancelFee.toString()),
    refundAmount: Number(quote.refundAmount.toString()),
  };
}

@Injectable()
export class TicketsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly refundProcessor: RefundProcessorService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async findCustomerTickets(taiKhoanId: number, query: TicketQueryDto) {
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId },
      select: { khachHangId: true },
    });

    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }

    const where: Prisma.VeWhereInput = {
      phieuDatVe: {
        donGiaoDich: {
          khachHangId: customer.khachHangId,
        },
      },
    };

    const andConditions: Prisma.VeWhereInput[] = [];

    if (query.status) {
      andConditions.push({
        trangThai: { equals: query.status },
      });
    }

    if (query.code) {
      andConditions.push({
        OR: [
          { maVe: { contains: query.code } },
          { phieuDatVe: { maPhieuDatVe: { contains: query.code } } },
        ],
      });
    }

    if (query.route) {
      andConditions.push({
        gheChuyenXe: {
          chuyenXe: {
            tuyenXe: {
              OR: [
                { diemDi: { contains: query.route } },
                { diemDen: { contains: query.route } },
              ],
            },
          },
        },
      });
    }

    if (query.departureDate) {
      const targetDate = new Date(`${query.departureDate}T00:00:00.000Z`);
      const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
      andConditions.push({
        gheChuyenXe: {
          chuyenXe: {
            ngayKhoiHanh: {
              gte: targetDate,
              lt: nextDate,
            },
          },
        },
      });
    }

    if (query.search) {
      const s = query.search.trim();
      andConditions.push({
        OR: [
          { maVe: { contains: s } },
          { phieuDatVe: { maPhieuDatVe: { contains: s } } },
          {
            gheChuyenXe: {
              chuyenXe: {
                tuyenXe: {
                  OR: [
                    { diemDi: { contains: s } },
                    { diemDen: { contains: s } },
                    { nhaXe: { tenNhaXe: { contains: s } } },
                  ],
                },
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const totalItems = await this.prisma.ve.count({ where });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const totalPages = Math.ceil(totalItems / pageSize);

    const direction = query.sortDirection ?? 'desc';
    let orderBy: Prisma.VeOrderByWithRelationInput[];
    if (query.sortBy === 'price') {
      orderBy = [{ giaThucTe: direction }, { veId: direction }];
    } else if (query.sortBy === 'departureTime') {
      orderBy = [
        { gheChuyenXe: { chuyenXe: { ngayKhoiHanh: direction } } },
        { gheChuyenXe: { chuyenXe: { gioKhoiHanh: direction } } },
        { veId: direction },
      ];
    } else {
      orderBy = [{ createdAt: direction }, { veId: direction }];
    }

    const tickets = await this.prisma.ve.findMany({
      where,
      include: TICKET_INCLUDE,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });

    const data = tickets.map((t) => this.mapTicket(t));

    return {
      data,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async findCustomerTicketById(taiKhoanId: number, ticketId: number) {
    const ticket = await this.prisma.ve.findUnique({
      where: { veId: ticketId },
      include: TICKET_INCLUDE,
    });

    if (!ticket) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé.',
      });
    }

    if (ticket.phieuDatVe.donGiaoDich.khachHang.taiKhoanId !== taiKhoanId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_TICKET_ACCESS',
        message: 'Bạn không có quyền truy cập vé này.',
      });
    }

    return { data: this.mapTicket(ticket) };
  }

  async lookupTicket(query: TicketLookupQueryDto) {
    const rawCode = query.ticketCode.trim();
    let ticket = await this.prisma.ve.findUnique({
      where: { maVe: rawCode },
      include: TICKET_INCLUDE,
    });

    if (!ticket && typeof this.prisma.ve.findFirst === 'function') {
      ticket = await this.prisma.ve.findFirst({
        where: {
          OR: [
            { phieuDatVe: { maPhieuDatVe: rawCode } },
            { phieuDatVe: { donGiaoDich: { maDonGiaoDich: rawCode } } },
          ],
        },
        include: TICKET_INCLUDE,
      });
    }

    if (!ticket) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      });
    }

    const customerPhone =
      ticket.phieuDatVe.donGiaoDich.soDienThoaiKhachHang || '';
    if (!phonesMatch(customerPhone, query.phoneNumber)) {
      throw new NotFoundException({
        error: 'TICKET_NOT_FOUND',
        message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
      });
    }

    return { data: this.mapTicket(ticket) };
  }

  async cancelTicket(dto: CancelTicketDto) {
    try {
      const result = await this.prisma.$transaction(
        async (tx) => {
          const rawCode = dto.ticketCode.trim();
          let ticket = await tx.ve.findUnique({
            where: { maVe: rawCode },
            include: TICKET_INCLUDE,
          });

          if (!ticket && typeof tx.ve.findFirst === 'function') {
            ticket = await tx.ve.findFirst({
              where: {
                OR: [
                  { phieuDatVe: { maPhieuDatVe: rawCode } },
                  { phieuDatVe: { donGiaoDich: { maDonGiaoDich: rawCode } } },
                ],
              },
              include: TICKET_INCLUDE,
            });
          }

          if (!ticket) {
            throw new NotFoundException({
              error: 'TICKET_NOT_FOUND',
              message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
            });
          }

          const customerPhone =
            ticket.phieuDatVe.donGiaoDich.soDienThoaiKhachHang || '';
          if (!phonesMatch(customerPhone, dto.phoneNumber)) {
            throw new NotFoundException({
              error: 'TICKET_NOT_FOUND',
              message: 'Không tìm thấy vé hoặc thông tin xác minh không khớp.',
            });
          }

          const quote = getCancellationQuote(
            ticket,
            this.businessTimeZone,
            new Date(),
          );
          if (!quote.eligible) {
            const errors: Record<
              CancellationReason,
              { error: string; message: string }
            > = {
              ALREADY_CANCELLED: {
                error: 'TICKET_ALREADY_CANCELLED',
                message: 'Vé này đã được hủy trước đó.',
              },
              ALREADY_DEPARTED: {
                error: 'TRIP_ALREADY_DEPARTED',
                message: 'Không thể hủy vé sau khi chuyến xe đã khởi hành.',
              },
              LESS_THAN_12_HOURS: {
                error: 'CANCELLATION_CUTOFF_PASSED',
                message:
                  'Chỉ có thể hủy vé trước giờ khởi hành ít nhất 12 tiếng.',
              },
              DEPARTURE_TIME_UNAVAILABLE: {
                error: 'DEPARTURE_TIME_UNAVAILABLE',
                message: 'Không thể xác định giờ khởi hành để hủy vé.',
              },
            };
            throw new BadRequestException(errors[quote.reason!]);
          }

          if (quote.cancelFeeRate !== dto.expectedCancelFeeRate) {
            throw new ConflictException({
              error: 'CANCELLATION_QUOTE_EXPIRED',
              message: `Mức phí hủy vé đã thay đổi (từ ${Math.round(dto.expectedCancelFeeRate * 100)}% thành ${Math.round(quote.cancelFeeRate * 100)}%) do thời gian đến lúc khởi hành đã thay đổi. Vui lòng xác nhận lại mức hoàn tiền mới.`,
              details: {
                previousRate: dto.expectedCancelFeeRate,
                currentQuote: serializeCancellationQuote(quote),
              },
            });
          }

          const originalPayment = ticket.phieuDatVe.donGiaoDich.thanhToans[0];
          if (!originalPayment) {
            throw new BadRequestException({
              error: 'REFUND_SOURCE_NOT_FOUND',
              message:
                'Không tìm thấy giao dịch thanh toán thành công để hoàn tiền.',
            });
          }

          const updateResult = await tx.ve.updateMany({
            where: { veId: ticket.veId, trangThai: { not: 'HUY' } },
            data: { trangThai: 'HUY' },
          });
          if (updateResult.count !== 1) {
            throw new ConflictException({
              error: 'TICKET_ALREADY_CANCELLED',
              message: 'Vé đã được hủy bởi một yêu cầu khác.',
            });
          }

          await tx.gheChuyenXe.update({
            where: { gheChuyenXeId: ticket.gheChuyenXeId },
            data: { trangThai: 'TRONG' },
          });

          const remainingActiveTickets = await tx.ve.count({
            where: {
              phieuDatVeId: ticket.phieuDatVeId,
              trangThai: { not: 'HUY' },
            },
          });

          if (remainingActiveTickets === 0) {
            await tx.phieuDatVe.update({
              where: { phieuDatVeId: ticket.phieuDatVeId },
              data: { trangThai: 'DA_HUY' },
            });
            await tx.donGiaoDich.update({
              where: { donGiaoDichId: ticket.phieuDatVe.donGiaoDichId },
              data: { trangThai: 'DA_HUY' },
            });
          }

          const refund = await tx.thanhToan.create({
            data: {
              soTien: quote.refundAmount,
              phuongThuc: originalPayment.phuongThuc,
              loaiGiaoDich: 'HOAN_TIEN',
              thoiGian: new Date(),
              trangThai: 'DANG_XU_LY',
              donGiaoDichId: ticket.phieuDatVe.donGiaoDichId,
              veId: ticket.veId,
            },
          });

          const serializedQuote = serializeCancellationQuote(quote);
          return {
            refundId: refund.thanhToanId,
            response: {
              data: {
                ticketId: ticket.veId,
                ticketCode: ticket.maVe,
                status: 'HUY',
                cancelFeeRate: serializedQuote.cancelFeeRate,
                cancelFee: serializedQuote.cancelFee,
                refundAmount: serializedQuote.refundAmount,
                message:
                  'Hủy vé thành công. Yêu cầu hoàn tiền đang được xử lý.',
              },
            },
          };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      this.refundProcessor.enqueueRefund(result.refundId);
      return result.response;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2034'
      ) {
        throw new ConflictException({
          error: 'TICKET_CANCELLATION_CONFLICT',
          message:
            'Vé đang được xử lý bởi một yêu cầu khác. Vui lòng kiểm tra lại.',
        });
      }
      throw error;
    }
  }

  private mapTicket(ticket: TicketRecord) {
    const chuyenXe = ticket.gheChuyenXe?.chuyenXe;
    const tuyenXe = chuyenXe?.tuyenXe;
    const nhaXe = ticket.phieuDatVe?.donGiaoDich?.nhaXe ?? tuyenXe?.nhaXe;
    const loaiXe = chuyenXe?.xe?.loaiXe;

    let departureTime: string | null = null;
    let arrivalTime: string | null = null;
    if (chuyenXe?.ngayKhoiHanh && chuyenXe?.gioKhoiHanh) {
      departureTime = combineDeparture(
        chuyenXe.ngayKhoiHanh,
        chuyenXe.gioKhoiHanh,
        this.businessTimeZone,
      ).toISOString();

      arrivalTime = computeArrival(
        chuyenXe.ngayKhoiHanh,
        chuyenXe.gioKhoiHanh,
        tuyenXe?.thoiGianChayPhut,
        chuyenXe.gioDen,
        this.businessTimeZone,
      );
    }

    const route =
      tuyenXe?.diemDi && tuyenXe?.diemDen
        ? `${tuyenXe.diemDi} - ${tuyenXe.diemDen}`
        : null;

    const order = ticket.phieuDatVe?.donGiaoDich;
    const latestPayment = order?.thanhToans?.[0];

    return {
      ticketId: ticket.veId,
      ticketCode: ticket.maVe,
      bookingId: ticket.phieuDatVeId,
      bookingCode: ticket.phieuDatVe?.maPhieuDatVe ?? null,
      route,
      origin: tuyenXe?.diemDi ?? null,
      destination: tuyenXe?.diemDen ?? null,
      busCompanyName: nhaXe?.tenNhaXe ?? null,
      vehicleType: loaiXe?.tenLoai ?? null,
      departureTime,
      arrivalTime,
      seatNumber: ticket.gheChuyenXe?.ghe?.soGhe ?? null,
      seatPosition: ticket.gheChuyenXe?.ghe?.viTri ?? null,
      price: Number(ticket.giaThucTe ?? ticket.giaNiemYet ?? 0),
      status: ticket.trangThai,
      bookingStatus: ticket.phieuDatVe?.trangThai ?? null,
      paymentStatus: order?.trangThai ?? null,
      paymentMethod: latestPayment?.phuongThuc ?? null,
      pickup: ticket.diemDon ?? null,
      dropoff: tuyenXe?.diemDen ?? null,
      passengerName: order?.tenKhachHang ?? null,
      passengerPhone: order?.soDienThoaiKhachHang ?? null,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      cancellation: serializeCancellationQuote(
        getCancellationQuote(ticket, this.businessTimeZone),
      ),
    };
  }
}
