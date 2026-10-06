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
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

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
    const validTripId = Number(tripId);
    if (!validTripId || isNaN(validTripId) || validTripId <= 0) {
      throw new NotFoundException('Mã chuyến xe không hợp lệ.');
    }

    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: validTripId },
      include: {
        xe: true,
      },
    });

    if (!trip) {
      throw new NotFoundException(`Chuyến xe #${tripId} không tồn tại.`);
    }

    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe không còn mở bán hoặc không ở trạng thái sẵn sàng.',
      });
    }

    const departureDateTime = combineDeparture(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
      this.businessTimeZone,
    );
    if (departureDateTime <= new Date()) {
      throw new ConflictException({
        error: 'TRIP_DEPARTED',
        message: 'Chuyến xe đã khởi hành hoặc đã qua giờ xuất bến.',
      });
    }

    const fare = await this.prisma.bangGia.findFirst({
      where: {
        nhaXeId: trip.nhaXeId,
        tuyenXeId: trip.tuyenXeId,
        loaiXeId: trip.xe.loaiXeId,
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: trip.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: trip.ngayKhoiHanh } }],
      },
      orderBy: {
        tuNgay: 'desc',
      },
    });

    if (!fare) {
      throw new NotFoundException('Không tìm thấy bảng giá áp dụng cho chuyến xe.');
    }

    const unitPrice = Number(fare.giaNiemYet);
    const seatCount = (seatIds || []).length;
    const originalTotal = unitPrice * seatCount;

    let discountAmount = 0;
    let appliedPromotionCode: string | null = null;

    if (promotionCode && promotionCode.trim().length > 0) {
      const promoResult = await this.promotionsService.validatePromotion({
        code: promotionCode,
        nhaXeId: trip.nhaXeId,
        tripId: validTripId,
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

  async createBooking(principal: AuthPrincipal, params: CreateBookingDto) {
    const validTripId = Number(params.tripId);
    if (!validTripId || isNaN(validTripId) || validTripId <= 0) {
      throw new NotFoundException('Mã chuyến xe không hợp lệ.');
    }

    // 1. Kiểm tra xác thực khách hàng (Customer Ownership)
    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId: principal.taiKhoanId },
    });
    if (!customer) {
      throw new ForbiddenException('Tài khoản không phải là khách hàng hợp lệ.');
    }
    const khachHangId = customer.khachHangId;

    const numericIds = (params.seatIds || [])
      .map((s) => Number(s))
      .filter((n) => !isNaN(n) && n > 0);

    if (numericIds.length === 0) {
      throw new ConflictException({
        error: 'INVALID_SEATS',
        message: 'Danh sách ghế không được để trống.',
      });
    }

    // 2. Kiểm tra chuyến xe tồn tại, trạng thái CHUA_KHOI_HANH và giờ chưa qua
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: validTripId },
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
      throw new NotFoundException('Chuyến xe không tồn tại.');
    }

    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe không còn mở bán hoặc không ở trạng thái sẵn sàng.',
      });
    }

    const departureDateTime = combineDeparture(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
      this.businessTimeZone,
    );
    if (departureDateTime <= new Date()) {
      throw new ConflictException({
        error: 'TRIP_DEPARTED',
        message: 'Chuyến xe đã khởi hành hoặc đã qua giờ xuất bến.',
      });
    }

    const effectiveTripId = trip.chuyenXeId;

    // 3. Khớp chính xác danh sách ghế: hỗ trợ gheChuyenXeId (tripSeatId) và fallback gheId
    let tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: effectiveTripId,
        gheChuyenXeId: { in: numericIds },
      },
      include: {
        ghe: true,
      },
    });

    if (tripSeats.length !== numericIds.length) {
      const byGheId = await this.prisma.gheChuyenXe.findMany({
        where: {
          chuyenXeId: effectiveTripId,
          gheId: { in: numericIds },
        },
        include: {
          ghe: true,
        },
      });
      if (byGheId.length === numericIds.length) {
        tripSeats = byGheId;
      }
    }

    if (tripSeats.length !== numericIds.length) {
      throw new ConflictException({
        error: 'SEATS_NOT_FOUND',
        message: 'Một hoặc nhiều ghế được chọn không tồn tại trên chuyến xe này.',
      });
    }

    const resolvedSeatIds = tripSeats.map((s) => s.gheChuyenXeId);

    for (const seat of tripSeats) {
      if (seat.trangThai === 'DA_DAT') {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${seat.ghe.soGhe} đã được đặt bởi khách hàng khác.`,
        });
      }
    }

    // 4. Bắt buộc kiểm tra mã giữ chỗ (Hold Ownership)
    this.seatHoldsService.verifyHold(
      params.holdToken,
      effectiveTripId,
      resolvedSeatIds,
      customer.khachHangId,
    );

    // 5. Tính giá và kiểm tra bảng giá chính xác
    const quote = await this.getBookingQuote(
      effectiveTripId,
      resolvedSeatIds,
      params.promotionCode,
    );

    let promotionRecord: any = null;
    if (quote.appliedPromotionCode) {
      promotionRecord = await this.prisma.khuyenMai.findFirst({
        where: {
          maKhuyenMai: quote.appliedPromotionCode,
          nhaXeId: trip.nhaXeId,
          trangThai: 'HOAT_DONG',
        },
      });
    }

    const fare = await this.prisma.bangGia.findFirst({
      where: {
        nhaXeId: trip.nhaXeId,
        tuyenXeId: trip.tuyenXeId,
        loaiXeId: trip.xe.loaiXeId,
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: trip.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: trip.ngayKhoiHanh } }],
      },
      orderBy: {
        tuNgay: 'desc',
      },
    });

    if (!fare) {
      throw new NotFoundException('Không tìm thấy bảng giá áp dụng cho chuyến xe.');
    }
    const bangGiaId = fare.bangGiaId;

    const timeStamp = Date.now().toString().slice(-6);
    const seq = randomInt(100, 999);
    const transactionCode = `VXG-GD-${timeStamp}-${seq}`;
    const bookingCode = `VXG-PDV-${timeStamp}-${seq}`;

    // 6. Tạo đơn giao dịch, phiếu đặt vé và các vé trong transaction
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
          soLuongVeBanDau: resolvedSeatIds.length,
          tongTienBanDau: quote.originalTotal,
          trangThai: 'CHO_THANH_TOAN',
          khuyenMaiId: promotionRecord?.khuyenMaiId ?? null,
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
      });

      const seatCount = resolvedSeatIds.length || 1;
      const baseTicketPrice = Math.floor(quote.finalTotal / seatCount);
      const remainder = quote.finalTotal % seatCount;

      for (let i = 0; i < tripSeats.length; i++) {
        const seat = tripSeats[i];
        const ticketCode = `${bookingCode}-${seat.ghe.soGhe}`;
        const actualTicketPrice = baseTicketPrice + (i < remainder ? 1 : 0);

        await tx.ve.create({
          data: {
            maVe: ticketCode,
            diemDon: params.pickupPoint,
            giaNiemYet: quote.unitPrice,
            giaThucTe: actualTicketPrice,
            trangThai: 'DA_DAT',
            phieuDatVeId: phieuDatVe.phieuDatVeId,
            gheChuyenXeId: seat.gheChuyenXeId,
            bangGiaApDungId: bangGiaId,
          },
        });
      }

      // CAS update trong transaction: Chuyển ghế từ DANG_GIU sang DA_DAT
      const updatedSeats = await tx.gheChuyenXe.updateMany({
        where: {
          chuyenXeId: effectiveTripId,
          gheChuyenXeId: { in: resolvedSeatIds },
          trangThai: 'DANG_GIU',
        },
        data: { trangThai: 'DA_DAT' },
      });

      if (updatedSeats.count !== resolvedSeatIds.length) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: 'Một hoặc nhiều ghế đã không còn ở trạng thái giữ chỗ hợp lệ.',
        });
      }

      return { donGiaoDich, phieuDatVe };
    });

    // 7. Tiêu thụ token giữ chỗ sau khi đặt vé thành công
    this.seatHoldsService.consumeHold(
      params.holdToken,
      effectiveTripId,
      resolvedSeatIds,
      customer.khachHangId,
    );

    const seatNames = tripSeats.map((s) => s.ghe.soGhe);

    this.logger.log(
      `Created real booking #${result.phieuDatVe.phieuDatVeId} (${bookingCode}) in MySQL for customer #${khachHangId} with ${seatNames.length} seats.`,
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
