import { randomUUID } from 'node:crypto';
import {
  ForbiddenException,
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  combineBusinessDateAndTime,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';
import type { QuoteBookingDto } from './dto/quote-booking.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import { FarePricesService } from '../fare-prices/fare-prices.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { SeatHoldsService } from '../seat-holds/seat-holds.service.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

function isPrismaConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'P2002' || error.code === 'P2034')
  );
}

@Injectable()
export class BookingsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly farePrices: FarePricesService,
    private readonly promotions: PromotionsService,
    private readonly seatHolds: SeatHoldsService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async quote(dto: QuoteBookingDto, principal: AuthPrincipal) {
    if (
      !Array.isArray(dto.seatIds) ||
      dto.seatIds.length === 0 ||
      new Set(dto.seatIds).size !== dto.seatIds.length
    ) {
      throw new BadRequestException({
        error: 'SEAT_SELECTION_INVALID',
        message: 'Danh sách ghế không hợp lệ.',
      });
    }

    const customer = await this.prisma.khachHang.findUnique({
      where: { taiKhoanId: principal.taiKhoanId },
      select: { khachHangId: true },
    });
    if (!customer) {
      throw new NotFoundException({
        error: 'CUSTOMER_PROFILE_NOT_FOUND',
        message: 'Không tìm thấy hồ sơ khách hàng.',
      });
    }

    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: dto.tripId },
      select: {
        chuyenXeId: true,
        ngayKhoiHanh: true,
        gioKhoiHanh: true,
        trangThai: true,
        nhaXeId: true,
        tuyenXeId: true,
        tuyenXe: {
          select: {
            diemDi: true,
            diemDen: true,
            nhaXe: { select: { tenNhaXe: true } },
          },
        },
        xe: {
          select: { loaiXeId: true, loaiXe: { select: { tenLoai: true } } },
        },
      },
    });
    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const now = new Date();
    const departureAt = combineBusinessDateAndTime(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
      this.businessTimeZone,
    );
    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }
    if (departureAt <= now) {
      throw new ConflictException({
        error: 'TRIP_ALREADY_DEPARTED',
        message: 'Chuyến xe này đã khởi hành.',
      });
    }

    const validHold = dto.holdToken
      ? await this.seatHolds.assertValidHold({
          token: dto.holdToken,
          principal,
          tripId: dto.tripId,
          tripSeatIds: dto.seatIds,
          now,
        })
      : null;
    const seats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: dto.tripId,
        gheChuyenXeId: { in: dto.seatIds },
      },
      select: {
        gheChuyenXeId: true,
        trangThai: true,
        ghe: { select: { soGhe: true } },
        giuChoGhe: {
          select: {
            giuCho: {
              select: {
                giuChoId: true,
                hetHanLuc: true,
              },
            },
          },
        },
      },
    });
    if (seats.length !== dto.seatIds.length) {
      throw new BadRequestException({
        error: 'SEAT_SELECTION_INVALID',
        message: 'Ghế phải tồn tại và thuộc chuyến xe đã chọn.',
      });
    }
    if (seats.some(({ trangThai }) => trangThai !== 'TRONG')) {
      throw new ConflictException({
        error: 'SEAT_UNAVAILABLE',
        message: 'Một hoặc nhiều ghế không còn trống.',
      });
    }
    if (
      seats.some(({ giuChoGhe }) => {
        const hold = giuChoGhe?.giuCho;
        return (
          hold !== undefined &&
          hold.hetHanLuc > now &&
          hold.giuChoId !== validHold?.giuChoId
        );
      })
    ) {
      throw new ConflictException({
        error: 'SEAT_UNAVAILABLE',
        message: 'Một hoặc nhiều ghế đang được giữ.',
      });
    }

    const fare = await this.farePrices.resolveForTrip({
      nhaXeId: trip.nhaXeId,
      routeId: trip.tuyenXeId,
      vehicleTypeId: trip.xe.loaiXeId,
      date: trip.ngayKhoiHanh.toISOString().slice(0, 10),
    });
    const subtotal = fare.listedPrice.mul(dto.seatIds.length);
    const promotion = await this.promotions.resolveBookingPromotion({
      nhaXeId: trip.nhaXeId,
      subtotal,
      businessDate: getBusinessDate(this.businessTimeZone, now),
      promotionCode: dto.promotionCode,
    });

    return {
      data: {
        tripId: trip.chuyenXeId,
        route: `${trip.tuyenXe.diemDi} - ${trip.tuyenXe.diemDen}`,
        busCompanyName: trip.tuyenXe.nhaXe.tenNhaXe,
        vehicleType: trip.xe.loaiXe.tenLoai,
        departureTime: departureAt.toISOString(),
        seatIds: [...dto.seatIds],
        seatNumbers: seats.map(({ ghe }) => ghe.soGhe),
        seatCount: dto.seatIds.length,
        farePriceId: fare.farePriceId,
        unitPrice: fare.listedPrice.toFixed(2),
        currency: 'VND' as const,
        subtotal: promotion.subtotal.toFixed(2),
        promotion:
          promotion.promotionId === null
            ? null
            : {
                promotionId: promotion.promotionId,
                code: promotion.promotionCode,
                name: promotion.promotionName,
              },
        discountAmount: promotion.discountAmount.toFixed(2),
        totalAmount: promotion.totalAmount.toFixed(2),
      },
    };
  }

  async create(dto: CreateBookingDto, principal: AuthPrincipal) {
    if (
      !Array.isArray(dto.seatIds) ||
      dto.seatIds.length === 0 ||
      new Set(dto.seatIds).size !== dto.seatIds.length
    ) {
      throw new BadRequestException({
        error: 'SEAT_SELECTION_INVALID',
        message: 'Danh sách ghế không hợp lệ.',
      });
    }

    const now = new Date();
    const sortedSeatIds = [...dto.seatIds].sort((left, right) => left - right);

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize hold and booking writes for one trip, then lock seats in ID order.
        await tx.$queryRaw<Array<{ chuyenXeId: number }>>(Prisma.sql`
          SELECT chuyenXeId
          FROM ChuyenXe
          WHERE chuyenXeId = ${dto.tripId}
          FOR UPDATE
        `);

        const trip = await tx.chuyenXe.findUnique({
          where: { chuyenXeId: dto.tripId },
          select: {
            chuyenXeId: true,
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            trangThai: true,
            nhaXeId: true,
            tuyenXeId: true,
            tuyenXe: {
              select: {
                diemDi: true,
                diemDen: true,
                nhaXe: { select: { tenNhaXe: true } },
              },
            },
            xe: {
              select: { loaiXeId: true, loaiXe: { select: { tenLoai: true } } },
            },
          },
        });
        if (!trip) {
          throw new NotFoundException({
            error: 'TRIP_NOT_FOUND',
            message: 'Không tìm thấy chuyến xe.',
          });
        }

        const departureAt = combineBusinessDateAndTime(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          this.businessTimeZone,
        );
        if (trip.trangThai !== 'CHUA_KHOI_HANH') {
          throw new ConflictException({
            error: 'TRIP_NOT_AVAILABLE',
            message: 'Chuyến xe này hiện không mở bán.',
          });
        }
        if (departureAt <= now) {
          throw new ConflictException({
            error: 'TRIP_ALREADY_DEPARTED',
            message: 'Chuyến xe này đã khởi hành.',
          });
        }

        const customer = await tx.khachHang.findUnique({
          where: { taiKhoanId: principal.taiKhoanId },
          select: {
            khachHangId: true,
            taiKhoan: {
              select: {
                hoTen: true,
                soDienThoai: true,
                email: true,
                trangThai: true,
              },
            },
          },
        });
        if (!customer) {
          throw new NotFoundException({
            error: 'CUSTOMER_PROFILE_NOT_FOUND',
            message: 'Không tìm thấy hồ sơ khách hàng.',
          });
        }
        if (customer.taiKhoan.trangThai !== 'HOAT_DONG') {
          throw new ForbiddenException({
            error: 'CUSTOMER_ACCOUNT_INACTIVE',
            message: 'Tài khoản khách hàng hiện không hoạt động.',
          });
        }

        const lockedSeats = await tx.$queryRaw<
          Array<{ gheChuyenXeId: number }>
        >(Prisma.sql`
          SELECT gheChuyenXeId
          FROM GheChuyenXe
          WHERE chuyenXeId = ${dto.tripId}
            AND gheChuyenXeId IN (${Prisma.join(sortedSeatIds)})
          ORDER BY gheChuyenXeId
          FOR UPDATE
        `);
        if (lockedSeats.length !== sortedSeatIds.length) {
          throw new BadRequestException({
            error: 'SEAT_SELECTION_INVALID',
            message: 'Ghế phải tồn tại và thuộc chuyến xe đã chọn.',
          });
        }

        const seats = await tx.gheChuyenXe.findMany({
          where: {
            chuyenXeId: dto.tripId,
            gheChuyenXeId: { in: sortedSeatIds },
          },
          select: {
            gheChuyenXeId: true,
            trangThai: true,
            ghe: { select: { soGhe: true } },
            giuChoGhe: {
              select: {
                giuCho: {
                  select: { giuChoId: true, hetHanLuc: true },
                },
              },
            },
          },
        });

        const validHold = await this.seatHolds.assertValidHold(
          {
            token: dto.holdToken,
            principal,
            tripId: dto.tripId,
            tripSeatIds: dto.seatIds,
            now,
          },
          tx,
        );

        if (seats.some(({ trangThai }) => trangThai !== 'TRONG')) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: 'Một hoặc nhiều ghế không còn trống.',
          });
        }
        if (
          seats.some(({ giuChoGhe }) => {
            const hold = giuChoGhe?.giuCho;
            return (
              hold !== undefined &&
              hold.hetHanLuc > now &&
              hold.giuChoId !== validHold.giuChoId
            );
          })
        ) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: 'Một hoặc nhiều ghế đang được giữ bởi lượt khác.',
          });
        }
        if (
          seats.some(
            ({ giuChoGhe }) =>
              giuChoGhe?.giuCho.giuChoId !== validHold.giuChoId,
          )
        ) {
          throw new ConflictException({
            error: 'SEAT_HOLD_MISMATCH',
            message: 'Lượt giữ ghế không bao gồm đầy đủ ghế đã chọn.',
          });
        }

        const fare = await this.farePrices.resolveForTrip(
          {
            nhaXeId: trip.nhaXeId,
            routeId: trip.tuyenXeId,
            vehicleTypeId: trip.xe.loaiXeId,
            date: trip.ngayKhoiHanh.toISOString().slice(0, 10),
          },
          tx,
        );
        const subtotal = fare.listedPrice.mul(dto.seatIds.length);
        const promotion = await this.promotions.resolveBookingPromotion(
          {
            nhaXeId: trip.nhaXeId,
            subtotal,
            businessDate: getBusinessDate(this.businessTimeZone, now),
            promotionCode: dto.promotionCode,
          },
          tx,
        );

        const seatUpdate = await tx.gheChuyenXe.updateMany({
          where: {
            chuyenXeId: dto.tripId,
            gheChuyenXeId: { in: sortedSeatIds },
            trangThai: 'TRONG',
          },
          data: { trangThai: 'DA_DAT' },
        });
        if (seatUpdate.count !== sortedSeatIds.length) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: 'Một hoặc nhiều ghế vừa được đặt bởi người khác.',
          });
        }

        const suffix = randomUUID();
        const order = await tx.donGiaoDich.create({
          data: {
            maDonGiaoDich: `GD-${suffix}`,
            ngayTao: now,
            tongTien: promotion.totalAmount,
            trangThai: 'CHO_THANH_TOAN',
            tenKhachHang: customer.taiKhoan.hoTen,
            soDienThoaiKhachHang: customer.taiKhoan.soDienThoai,
            emailKhachHang: customer.taiKhoan.email,
            khachHangId: customer.khachHangId,
            nhaXeId: trip.nhaXeId,
          },
          select: {
            donGiaoDichId: true,
            maDonGiaoDich: true,
          },
        });
        const booking = await tx.phieuDatVe.create({
          data: {
            maPhieuDatVe: `PDV-${suffix}`,
            ngayDat: now,
            soLuongVeBanDau: dto.seatIds.length,
            tongTienBanDau: promotion.subtotal,
            trangThai: 'CHO_THANH_TOAN',
            khuyenMaiId: promotion.promotionId,
            donGiaoDichId: order.donGiaoDichId,
          },
          select: {
            phieuDatVeId: true,
            maPhieuDatVe: true,
          },
        });

        const seatById = new Map(
          seats.map((seat) => [seat.gheChuyenXeId, seat]),
        );
        const tickets = [];
        for (const seatId of dto.seatIds) {
          const seat = seatById.get(seatId);
          if (!seat) {
            throw new Error(
              `Locked seat disappeared during booking creation. tripId=${dto.tripId} seatId=${seatId}`,
            );
          }
          const ticket = await tx.ve.create({
            data: {
              maVe: `VE-${randomUUID()}`,
              diemDon: trip.tuyenXe.diemDi,
              giaNiemYet: fare.listedPrice,
              giaThucTe: fare.listedPrice,
              trangThai: 'DA_DAT',
              phieuDatVeId: booking.phieuDatVeId,
              gheChuyenXeId: seatId,
              bangGiaApDungId: fare.farePriceId,
            },
            select: {
              veId: true,
              maVe: true,
            },
          });
          tickets.push({
            ticketId: ticket.veId,
            ticketCode: ticket.maVe,
            seatId,
            seatNumber: seat.ghe.soGhe,
            price: fare.listedPrice.toFixed(2),
            status: 'DA_DAT',
          });
        }

        const consumedHold = await tx.giuCho.deleteMany({
          where: {
            giuChoId: validHold.giuChoId,
            taiKhoanId: principal.taiKhoanId,
            sessionId: principal.sessionId,
            hetHanLuc: { gt: now },
          },
        });
        if (consumedHold.count !== 1) {
          throw new NotFoundException({
            error: 'SEAT_HOLD_NOT_FOUND',
            message: 'Lượt giữ ghế đã hết hạn hoặc không còn khả dụng.',
          });
        }

        return {
          data: {
            orderId: order.donGiaoDichId,
            orderCode: order.maDonGiaoDich,
            bookingId: booking.phieuDatVeId,
            bookingCode: booking.maPhieuDatVe,
            tripId: trip.chuyenXeId,
            route: `${trip.tuyenXe.diemDi} - ${trip.tuyenXe.diemDen}`,
            busCompanyName: trip.tuyenXe.nhaXe.tenNhaXe,
            vehicleType: trip.xe.loaiXe.tenLoai,
            departureTime: departureAt.toISOString(),
            seatIds: [...dto.seatIds],
            seatNumbers: tickets.map(({ seatNumber }) => seatNumber),
            seatCount: dto.seatIds.length,
            farePriceId: fare.farePriceId,
            unitPrice: fare.listedPrice.toFixed(2),
            currency: 'VND' as const,
            subtotal: promotion.subtotal.toFixed(2),
            promotion:
              promotion.promotionId === null
                ? null
                : {
                    promotionId: promotion.promotionId,
                    code: promotion.promotionCode,
                    name: promotion.promotionName,
                  },
            discountAmount: promotion.discountAmount.toFixed(2),
            totalAmount: promotion.totalAmount.toFixed(2),
            status: 'CHO_THANH_TOAN',
            paymentStatus: 'CHO_THANH_TOAN',
            tickets,
            createdAt: now.toISOString(),
          },
        };
      });
    } catch (error) {
      if (isPrismaConflict(error)) {
        throw new ConflictException({
          error: 'BOOKING_CONFLICT',
          message: 'Đơn đặt vé vừa thay đổi. Vui lòng kiểm tra lại ghế.',
        });
      }
      throw error;
    }
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
      andConditions.push({
        OR: [
          { trangThai: { equals: query.status } },
          { donGiaoDich: { trangThai: { equals: query.status } } },
        ],
      });
    }

    if (query.code) {
      andConditions.push({
        OR: [
          { maPhieuDatVe: { contains: query.code } },
          { donGiaoDich: { maDonGiaoDich: { contains: query.code } } },
          { ves: { some: { maVe: { contains: query.code } } } },
        ],
      });
    }

    if (query.route) {
      andConditions.push({
        ves: {
          some: {
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
          },
        },
      });
    }

    if (query.departureDate) {
      const targetDate = new Date(`${query.departureDate}T00:00:00.000Z`);
      const nextDate = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000);
      andConditions.push({
        ves: {
          some: {
            gheChuyenXe: {
              chuyenXe: {
                ngayKhoiHanh: {
                  gte: targetDate,
                  lt: nextDate,
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
        ? [
            { donGiaoDich: { tongTien: direction } },
            { phieuDatVeId: direction },
          ]
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
      departureTime = combineBusinessDateAndTime(
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
        booking.donGiaoDich?.tongTien ?? booking.tongTienBanDau ?? 0,
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
