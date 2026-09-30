import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { SeatHoldsService } from '../seat-holds/seat-holds.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly seatHoldsService: SeatHoldsService,
    private readonly promotionsService: PromotionsService,
  ) {}

  async getBookingQuote(tripId: number, seatIds: number[], promotionCode?: string) {
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
        ...(Number(params.tripId) > 0 ? { chuyenXeId: Number(params.tripId) } : {}),
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

    // Check seat availability in database
    let tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: effectiveTripId,
        OR: [
          ...(numericIds.length > 0 ? [{ gheId: { in: numericIds } }] : []),
          ...(stringCodes.length > 0 ? [{ ghe: { soGhe: { in: stringCodes } } }] : []),
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

    // Get pricing
    const quote = await this.getBookingQuote(effectiveTripId, resolvedSeatIds, params.promotionCode);

    // Get promotion record if applied
    let promotionRecord: any = null;
    if (quote.appliedPromotionCode) {
      promotionRecord = await this.prisma.khuyenMai.findFirst({
        where: { maKhuyenMai: quote.appliedPromotionCode },
      });
    }

    // Consume the hold if provided
    this.seatHoldsService.consumeHold(params.holdToken, effectiveTripId, resolvedSeatIds);

    // Find default customer or first customer in DB
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

    // Run database transaction to persist DonGiaoDich, PhieuDatVe, Ve, and update GheChuyenXe
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Create DonGiaoDich
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

      // 2. Create PhieuDatVe
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

      // 3. Create individual Ve for each seat
      const unitFinalPrice = Math.round(quote.finalTotal / seatIds.length);
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

        // 4. Update seat status to DA_DAT in GheChuyenXe
        await tx.gheChuyenXe.update({
          where: { gheChuyenXeId: seat.gheChuyenXeId },
          data: { trangThai: 'DA_DAT' },
        });
      }

      return { donGiaoDich, phieuDatVe };
    });

    const seatNames = tripSeats.map((s) => s.ghe.soGhe);

    this.logger.log(`Created real booking #${result.phieuDatVe.phieuDatVeId} (${bookingCode}) in MySQL with ${seatNames.length} seats.`);

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
                    tuyenXe: {
                      include: {
                        nhaXe: true,
                      },
                    },
                    xe: {
                      include: {
                        loaiXe: true,
                        nhaXe: true,
                      },
                    },
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

  async getMyBookings(params: { page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(params.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(params.pageSize) || 10));
    const skip = (page - 1) * pageSize;

    const [bookings, total] = await Promise.all([
      this.prisma.phieuDatVe.findMany({
        skip,
        take: pageSize,
        orderBy: { phieuDatVeId: 'desc' },
        include: {
          donGiaoDich: true,
          ves: {
            include: {
              gheChuyenXe: {
                include: {
                  ghe: true,
                  chuyenXe: {
                    include: {
                      tuyenXe: {
                        include: {
                          nhaXe: true,
                        },
                      },
                      xe: {
                        include: {
                          loaiXe: true,
                          nhaXe: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.phieuDatVe.count(),
    ]);

    return bookings.map((b) => {
      const firstTicket = b.ves[0];
      const chuyenXe = firstTicket?.gheChuyenXe?.chuyenXe;
      const seatNames = b.ves.map((v) => v.gheChuyenXe.ghe.soGhe);
      const seatIds = b.ves.map((v) => v.gheChuyenXe.gheId);

      return {
        bookingId: b.phieuDatVeId,
        bookingCode: b.maPhieuDatVe,
        tripId: chuyenXe?.chuyenXeId ?? 0,
        status: b.trangThai,
        contact: {
          fullName: b.donGiaoDich.tenKhachHang,
          phone: b.donGiaoDich.soDienThoaiKhachHang,
          email: b.donGiaoDich.emailKhachHang ?? '',
        },
        pickupPoint: firstTicket?.diemDon ?? '',
        dropoffPoint: chuyenXe ? `Bến xe ${chuyenXe.tuyenXe.diemDen}` : '',
        seats: seatNames,
        seatIds,
        totalAmount: Number(b.donGiaoDich.tongTien),
        createdAt: b.createdAt.toISOString(),
      };
    });
  }
}
