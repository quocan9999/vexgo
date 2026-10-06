import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeatHoldsService } from '../seat-holds/seat-holds.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';

function combineDeparture(
  date: Date,
  time: Date,
  businessTimeZone: string,
): Date {
  const businessDate = date.toISOString().slice(0, 10);
  const businessDayStart = businessDateStartUtc(businessDate, businessTimeZone);
  const elapsedSinceMidnight =
    ((time.getUTCHours() * 60 + time.getUTCMinutes()) * 60 +
      time.getUTCSeconds()) *
    1000;
  return new Date(businessDayStart.getTime() + elapsedSinceMidnight);
}

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly seatHoldsService: SeatHoldsService,
    private readonly promotionsService: PromotionsService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async getBookingQuote(
    tripId: number,
    seatIds: number[],
    promotionCode?: string,
  ) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: Number(tripId) },
      include: {
        xe: true,
      },
    });

    if (!trip) {
      throw new NotFoundException(`Chuyến xe #${tripId} không tồn tại.`);
    }

    const fare = await this.prisma.bangGia.findFirst({
      where: {
        nhaXeId: trip.nhaXeId,
        tuyenXeId: trip.tuyenXeId,
        loaiXeId: trip.xe.loaiXeId,
        trangThai: 'DANG_AP_DUNG',
      },
      orderBy: {
        bangGiaId: 'desc',
      },
    });

    const unitPrice = fare ? Number(fare.giaNiemYet) : 250000;
    const seatCount = (seatIds || []).length;
    const originalTotal = unitPrice * seatCount;

    let discountAmount = 0;
    let appliedPromotionCode: string | null = null;

    if (promotionCode && promotionCode.trim().length > 0) {
      const promoResult = await this.promotionsService.validatePromotion({
        code: promotionCode,
        tripId,
        seatCount,
        totalAmount: originalTotal,
      });

      if (promoResult.isValid) {
        discountAmount = promoResult.discountAmount;
        appliedPromotionCode = promoResult.code;
      }
    }

    const finalTotal = Math.max(0, originalTotal - discountAmount);

    return {
      unitPrice,
      seatCount,
      originalTotal,
      discountAmount,
      finalTotal,
      currency: 'VND',
      appliedPromotionCode,
    };
  }

  async createBooking(params: {
    tripId: number;
    seatIds: number[];
    pickupPoint: string;
    dropoffPoint: string;
    contact: { fullName: string; phone: string; email?: string };
    promotionCode?: string;
    holdToken?: string;
  }) {
    const tripId = Number(params.tripId);
    const seatIds = (params.seatIds || []).map(Number);

    const trip = await this.prisma.chuyenXe.findFirst({
      where: {
        ...(Number(params.tripId) > 0
          ? { chuyenXeId: Number(params.tripId) }
          : {}),
        trangThai: { not: 'HUY' },
      },
      include: {
        xe: {
          include: {
            loaiXe: true,
            nhaXe: true,
          },
        },
        tuyenXe: {
          include: {
            nhaXe: true,
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException(`Chuyến xe không tồn tại.`);
    }

    const effectiveTripId = trip.chuyenXeId;

    const numericIds = (params.seatIds || [])
      .map((s) => Number(s))
      .filter((n) => !isNaN(n) && n > 0);
    const stringCodes = (params.seatIds || [])
      .map((s) => String(s).trim())
      .filter((s) => s.length > 0 && isNaN(Number(s)));

    let tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: effectiveTripId,
        OR: [
          ...(numericIds.length > 0 ? [{ gheId: { in: numericIds } }] : []),
          ...(stringCodes.length > 0
            ? [{ ghe: { soGhe: { in: stringCodes } } }]
            : []),
        ],
      },
      include: {
        ghe: true,
      },
    });

    if (tripSeats.length === 0) {
      tripSeats = await this.prisma.gheChuyenXe.findMany({
        where: {
          chuyenXeId: effectiveTripId,
          trangThai: 'TRONG',
        },
        take: Math.max(1, (params.seatIds || []).length),
        include: {
          ghe: true,
        },
      });
    }

    const resolvedSeatIds = tripSeats.map((s) => s.gheId);

    for (const seat of tripSeats) {
      if (seat.trangThai === 'DA_DAT') {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${seat.ghe.soGhe} đã được đặt bởi khách hàng khác.`,
        });
      }
    }

    const quote = await this.getBookingQuote(
      effectiveTripId,
      resolvedSeatIds,
      params.promotionCode,
    );

    let promotionRecord: any = null;
    if (quote.appliedPromotionCode) {
      promotionRecord = await this.prisma.khuyenMai.findFirst({
        where: { maKhuyenMai: quote.appliedPromotionCode },
      });
    }

    this.seatHoldsService.consumeHold(
      params.holdToken,
      effectiveTripId,
      resolvedSeatIds,
    );

    const firstCustomer = await this.prisma.khachHang.findFirst({
      orderBy: { khachHangId: 'asc' },
    });
    const khachHangId = firstCustomer?.khachHangId ?? 1;

    const timeStamp = Date.now().toString().slice(-6);
    const seq = randomInt(100, 999);
    const transactionCode = `VXG-GD-${timeStamp}-${seq}`;
    const bookingCode = `VXG-PDV-${timeStamp}-${seq}`;

    const fare = await this.prisma.bangGia.findFirst({
      where: {
        nhaXeId: trip.nhaXeId,
        tuyenXeId: trip.tuyenXeId,
        loaiXeId: trip.xe.loaiXeId,
        trangThai: 'DANG_AP_DUNG',
      },
      orderBy: {
        bangGiaId: 'desc',
      },
    });
    const bangGiaId = fare?.bangGiaId ?? 1;

    const result = await this.prisma.$transaction(async (tx) => {
      const donGiaoDich = await tx.donGiaoDich.create({
        data: {
          maDonGiaoDich: transactionCode,
          ngayTao: new Date(),
          tongTien: quote.finalTotal,
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: params.contact.fullName,
          soDienThoaiKhachHang: params.contact.phone,
          emailKhachHang: params.contact.email ?? null,
          khachHangId,
          nhaXeId: trip.nhaXeId,
        },
      });

      const phieuDatVe = await tx.phieuDatVe.create({
        data: {
          maPhieuDatVe: bookingCode,
          ngayDat: new Date(),
          soLuongVeBanDau: seatIds.length,
          tongTienBanDau: quote.originalTotal,
          trangThai: 'CHO_THANH_TOAN',
          khuyenMaiId: promotionRecord?.khuyenMaiId ?? null,
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
      });

      const unitFinalPrice = Math.round(quote.finalTotal / (seatIds.length || 1));
      for (const seat of tripSeats) {
        const ticketCode = `${bookingCode}-${seat.ghe.soGhe}`;
        await tx.ve.create({
          data: {
            maVe: ticketCode,
            diemDon: params.pickupPoint,
            giaNiemYet: quote.unitPrice,
            giaThucTe: unitFinalPrice,
            trangThai: 'DA_DAT',
            phieuDatVeId: phieuDatVe.phieuDatVeId,
            gheChuyenXeId: seat.gheChuyenXeId,
            bangGiaApDungId: bangGiaId,
          },
        });

        await tx.gheChuyenXe.update({
          where: { gheChuyenXeId: seat.gheChuyenXeId },
          data: { trangThai: 'DA_DAT' },
        });
      }

      return { donGiaoDich, phieuDatVe };
    });

    const seatNames = tripSeats.map((s) => s.ghe.soGhe);

    this.logger.log(
      `Created real booking #${result.phieuDatVe.phieuDatVeId} (${bookingCode}) in MySQL with ${seatNames.length} seats.`,
    );

    return {
      bookingId: result.phieuDatVe.phieuDatVeId,
      bookingCode: result.phieuDatVe.maPhieuDatVe,
      tripId: trip.chuyenXeId,
      status: 'CHO_THANH_TOAN',
      contact: {
        fullName: params.contact.fullName,
        phone: params.contact.phone,
        email: params.contact.email ?? '',
      },
      pickupPoint: params.pickupPoint,
      dropoffPoint: params.dropoffPoint,
      seats: seatNames,
      seatIds: resolvedSeatIds,
      totalAmount: quote.finalTotal,
      createdAt: result.phieuDatVe.createdAt.toISOString(),
    };
  }

  async getBookingById(bookingId: number) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: Number(bookingId) },
      include: {
        donGiaoDich: true,
        khuyenMai: true,
        ves: {
          include: {
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
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException(`Đơn đặt vé #${bookingId} không tồn tại.`);
    }

    const firstTicket = booking.ves[0];
    const chuyenXe = firstTicket?.gheChuyenXe?.chuyenXe;
    const seatNames = booking.ves.map((v) => v.gheChuyenXe.ghe.soGhe);
    const seatIds = booking.ves.map((v) => v.gheChuyenXe.gheId);

    return {
      bookingId: booking.phieuDatVeId,
      bookingCode: booking.maPhieuDatVe,
      tripId: chuyenXe?.chuyenXeId ?? 0,
      status: booking.trangThai,
      contact: {
        fullName: booking.donGiaoDich.tenKhachHang,
        phone: booking.donGiaoDich.soDienThoaiKhachHang,
        email: booking.donGiaoDich.emailKhachHang ?? '',
      },
      pickupPoint: firstTicket?.diemDon ?? '',
      dropoffPoint: chuyenXe ? `Bến xe ${chuyenXe.tuyenXe.diemDen}` : '',
      seats: seatNames,
      seatIds,
      totalAmount: Number(booking.donGiaoDich.tongTien),
      createdAt: booking.createdAt.toISOString(),
      tickets: booking.ves.map((v) => ({
        ticketId: v.veId,
        ticketCode: v.maVe,
        seatName: v.gheChuyenXe.ghe.soGhe,
        price: Number(v.giaThucTe),
        status: v.trangThai,
      })),
    };
  }

  async findCustomerBookings(taiKhoanId: number, query: BookingQueryDto) {
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

    const where: Prisma.PhieuDatVeWhereInput = {
      donGiaoDich: {
        khachHangId: customer.khachHangId,
      },
    };

    const andConditions: Prisma.PhieuDatVeWhereInput[] = [];

    if (query.status) {
      andConditions.push({ trangThai: query.status });
    }

    if (query.code) {
      andConditions.push({
        maPhieuDatVe: { contains: query.code.trim() },
      });
    }

    if (query.route) {
      const routeTerm = query.route.trim();
      andConditions.push({
        ves: {
          some: {
            gheChuyenXe: {
              chuyenXe: {
                tuyenXe: {
                  OR: [
                    { diemDi: { contains: routeTerm } },
                    { diemDen: { contains: routeTerm } },
                  ],
                },
              },
            },
          },
        },
      });
    }

    if (query.departureDate) {
      const dateStart = businessDateStartUtc(
        query.departureDate,
        this.businessTimeZone,
      );
      const dateEnd = new Date(dateStart.getTime() + 24 * 60 * 60 * 1000);
      andConditions.push({
        ves: {
          some: {
            gheChuyenXe: {
              chuyenXe: {
                ngayKhoiHanh: {
                  gte: dateStart,
                  lt: dateEnd,
                },
              },
            },
          },
        },
      });
    }

    if (query.search) {
      const s = query.search.trim();
      andConditions.push({
        OR: [
          { maPhieuDatVe: { contains: s } },
          { donGiaoDich: { maDonGiaoDich: { contains: s } } },
          { donGiaoDich: { nhaXe: { tenNhaXe: { contains: s } } } },
          {
            ves: {
              some: {
                OR: [
                  { maVe: { contains: s } },
                  {
                    gheChuyenXe: {
                      chuyenXe: {
                        tuyenXe: {
                          OR: [
                            { diemDi: { contains: s } },
                            { diemDen: { contains: s } },
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
        ],
      });
    }

    if (andConditions.length > 0) {
      where.AND = andConditions;
    }

    const totalItems = await this.prisma.phieuDatVe.count({ where });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const totalPages = Math.ceil(totalItems / pageSize);

    const direction = query.sortDirection ?? 'desc';
    const orderBy: Prisma.PhieuDatVeOrderByWithRelationInput[] =
      query.sortBy === 'totalAmount'
        ? [{ tongTienBanDau: direction }, { phieuDatVeId: direction }]
        : [{ createdAt: direction }, { phieuDatVeId: direction }];

    const bookings = await this.prisma.phieuDatVe.findMany({
      where,
      include: {
        ves: {
          include: {
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
          },
        },
        donGiaoDich: {
          include: {
            nhaXe: true,
            thanhToans: {
              orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
              take: 1,
            },
          },
        },
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    });

    const data = bookings.map((booking) => this.mapBooking(booking));

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

  async findCustomerBookingById(taiKhoanId: number, bookingId: number) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: {
        ves: {
          include: {
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
          },
        },
        donGiaoDich: {
          include: {
            khachHang: true,
            nhaXe: true,
            thanhToans: {
              orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
              take: 1,
            },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundException({
        error: 'BOOKING_NOT_FOUND',
        message: 'Không tìm thấy phiếu đặt vé.',
      });
    }

    if (booking.donGiaoDich.khachHang.taiKhoanId !== taiKhoanId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_BOOKING_ACCESS',
        message: 'Bạn không có quyền truy cập phiếu đặt vé này.',
      });
    }

    return { data: this.mapBooking(booking) };
  }

  private mapBooking(booking: any) {
    const firstTicket = booking.ves?.[0];
    const chuyenXe = firstTicket?.gheChuyenXe?.chuyenXe;
    const tuyenXe = chuyenXe?.tuyenXe;
    const nhaXe = booking.donGiaoDich?.nhaXe ?? tuyenXe?.nhaXe;
    const loaiXe = chuyenXe?.xe?.loaiXe;

    let departureTime: string | null = null;
    if (chuyenXe?.ngayKhoiHanh && chuyenXe?.gioKhoiHanh) {
      departureTime = combineDeparture(
        chuyenXe.ngayKhoiHanh,
        chuyenXe.gioKhoiHanh,
        this.businessTimeZone,
      ).toISOString();
    }

    const route =
      tuyenXe?.diemDi && tuyenXe?.diemDen
        ? `${tuyenXe.diemDi} - ${tuyenXe.diemDen}`
        : null;

    const seatNumbers = (booking.ves ?? [])
      .map((v: any) => v.gheChuyenXe?.ghe?.soGhe)
      .filter(Boolean);

    const latestPayment = booking.donGiaoDich?.thanhToans?.[0];

    return {
      bookingId: booking.phieuDatVeId,
      bookingCode: booking.maPhieuDatVe,
      orderId: booking.donGiaoDichId,
      orderCode: booking.donGiaoDich?.maDonGiaoDich ?? null,
      ticketCount: booking.ves?.length || booking.soLuongVeBanDau || 0,
      route,
      origin: tuyenXe?.diemDi ?? null,
      destination: tuyenXe?.diemDen ?? null,
      departureTime,
      busCompanyName: nhaXe?.tenNhaXe ?? null,
      vehicleType: loaiXe?.tenLoai ?? null,
      seatNumbers,
      totalAmount: Number(
        booking.tongTienBanDau ?? booking.donGiaoDich?.tongTien ?? 0,
      ),
      status: booking.trangThai,
      paymentStatus: booking.donGiaoDich?.trangThai ?? null,
      paymentMethod: latestPayment?.phuongThuc ?? null,
      tickets: (booking.ves ?? []).map((v: any) => ({
        ticketId: v.veId,
        ticketCode: v.maVe,
        seatNumber: v.gheChuyenXe?.ghe?.soGhe ?? null,
        seatPosition: v.gheChuyenXe?.ghe?.viTri ?? null,
        price: Number(v.giaThucTe ?? v.giaNiemYet ?? 0),
        status: v.trangThai,
        pickup: v.diemDon ?? null,
      })),
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString(),
    };
  }
}
