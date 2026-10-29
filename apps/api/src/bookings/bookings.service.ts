import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createSepayPaymentAttempt } from '../payments/payment-attempt.js';
import { SeatHoldsService } from '../seat-holds/seat-holds.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { CargoPricingService } from '../cargo-pricing/cargo-pricing.service.js';
import { CargoCapacityService } from '../cargo-capacity/cargo-capacity.service.js';
import type { CargoCapacityGroup } from '../cargo-capacity/cargo-capacity.service.js';
import { ShipmentPersistenceService } from '../shipments/shipment-persistence.service.js';
import { generateUuidV1 } from '../common/uuid-v1.js';
import { getBookingPaymentDeadline } from '../common/booking-payment-deadline.js';
import {
  businessDateStartUtc,
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';
import type { CreateBookingDto } from './dto/create-booking.dto.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
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
    private readonly cargoPricingService: CargoPricingService,
    private readonly cargoCapacityService: CargoCapacityService,
    private readonly shipmentPersistenceService: ShipmentPersistenceService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async getBookingQuote(
    tripId: number,
    seatIds: number[],
    promotionCode?: string,
    contactPhone?: string,
    principal?: AuthPrincipal,
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

    if (
      !Array.isArray(seatIds) ||
      seatIds.length === 0 ||
      new Set(seatIds).size !== seatIds.length ||
      seatIds.some((seatId) => !Number.isInteger(seatId) || seatId <= 0)
    ) {
      throw new BadRequestException({
        error: 'INVALID_SEATS',
        message: 'Danh sách ghế phải có ít nhất một mã ghế hợp lệ và không trùng.',
      });
    }

    if (seatIds.length > 5) {
      throw new BadRequestException({
        error: 'MAX_SEATS_EXCEEDED',
        message: 'Mỗi chuyến xe chỉ được đặt tối đa 5 ghế.',
      });
    }

    const tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: validTripId,
        gheChuyenXeId: { in: seatIds },
      },
      select: { gheChuyenXeId: true },
    });
    if (tripSeats.length !== seatIds.length) {
      throw new ConflictException({
        error: 'INVALID_SEATS',
        message: 'Một hoặc nhiều ghế không thuộc chuyến xe đã chọn.',
      });
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

    const unitPrice = new Prisma.Decimal(fare.giaNiemYet.toString());
    const seatCount = (seatIds || []).length;
    const originalTotal = unitPrice.mul(seatCount);

    let discountAmount = new Prisma.Decimal(0);
    let appliedPromotionCode: string | null = null;
    let identityChecked = false;

    if (promotionCode && promotionCode.trim().length > 0) {
      let khachHangId: number | null = null;
      let phoneNormalized: string | null = null;
      if (principal) {
        const customer = await this.prisma.khachHang.findUnique({
          where: { taiKhoanId: principal.taiKhoanId },
          select: {
            khachHangId: true,
            taiKhoan: {
              select: {
                soDienThoai: true,
                daXacThucSoDienThoai: true,
              },
            },
          },
        });
        if (!customer) {
          throw new ForbiddenException({
            error: 'CUSTOMER_PROFILE_REQUIRED',
            message: 'Tài khoản không có hồ sơ khách hàng hợp lệ.',
          });
        }
        khachHangId = customer.khachHangId;
        if (customer.taiKhoan.daXacThucSoDienThoai) {
          phoneNormalized = normalizePhone(customer.taiKhoan.soDienThoai);
        }
      } else if (contactPhone) {
        phoneNormalized = normalizePhone(contactPhone);
      }

      const promoQuote = await this.promotionsService.quotePromotion({
        code: promotionCode,
        nhaXeId: trip.nhaXeId,
        ticketOriginalTotal: originalTotal,
        khachHangId,
        phoneNormalized,
      });
      discountAmount = promoQuote.discountAmount;
      appliedPromotionCode = promoQuote.code;
      identityChecked = promoQuote.identityChecked;
    }

    const finalTotal = originalTotal.sub(discountAmount);

    return {
      unitPrice: unitPrice.toFixed(2),
      seatCount,
      originalTotal: originalTotal.toFixed(2),
      discountAmount: discountAmount.toFixed(2),
      finalTotal: finalTotal.toFixed(2),
      currency: 'VND',
      appliedPromotionCode,
      identityChecked,
      phoneEligibilityChecked: Boolean(principal || contactPhone),
      requiresPhoneBeforeBooking:
        Boolean(promotionCode?.trim()) && !principal && !contactPhone,
    };
  }

  async createBooking(
    dto: CreateBookingDto,
    principal?: AuthPrincipal,
  ) {
    if (!dto?.holdToken?.trim()) {
      throw new ConflictException({
        error: 'HOLD_REQUIRED',
        message: 'Yêu cầu mã giữ chỗ (holdToken) hợp lệ để thực hiện đặt vé.',
      });
    }

    if (
      !Array.isArray(dto.seatIds) ||
      dto.seatIds.length === 0 ||
      dto.seatIds.some((seatId) => !Number.isInteger(seatId) || seatId <= 0) ||
      new Set(dto.seatIds).size !== dto.seatIds.length
    ) {
      throw new BadRequestException({
        error: 'INVALID_SEATS',
        message: 'Danh sách seatIds phải gồm các mã ghế chuyến xe hợp lệ, không trùng.',
      });
    }

    if (dto.seatIds.length > 5) {
      throw new BadRequestException({
        error: 'MAX_SEATS_EXCEEDED',
        message: 'Mỗi chuyến xe chỉ được đặt tối đa 5 ghế.',
      });
    }

    if (!dto.contact || !dto.pickupPoint?.trim() || !dto.dropoffPoint?.trim()) {
      throw new BadRequestException({
        error: 'INVALID_BOOKING_CONTACT',
        message: 'Thông tin liên hệ, điểm đón và điểm trả là bắt buộc.',
      });
    }

    const validTripId = Number(dto.tripId);
    if (!validTripId || isNaN(validTripId) || validTripId <= 0) {
      throw new NotFoundException('Mã chuyến xe không hợp lệ.');
    }

    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: validTripId },
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true, nhaXe: true } },
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
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

    // A principal establishes ownership; contact details are only booking snapshots.
    const taiKhoanId = principal?.taiKhoanId;
    let customer: { khachHangId: number; taiKhoanId: number | null } | null = null;
    if (taiKhoanId) {
      customer = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId },
        select: { khachHangId: true, taiKhoanId: true },
      });
      if (!customer) {
        throw new ForbiddenException({
          error: 'CUSTOMER_PROFILE_REQUIRED',
          message: 'Tài khoản không có hồ sơ khách hàng hợp lệ.',
        });
      }
    }

    const tripSeats = await this.prisma.gheChuyenXe.findMany({
      where: {
        chuyenXeId: trip.chuyenXeId,
        gheChuyenXeId: { in: dto.seatIds },
      },
      include: { ghe: true },
    });

    if (tripSeats.length !== dto.seatIds.length) {
      throw new ConflictException({
        error: 'INVALID_SEATS',
        message: 'Một hoặc nhiều seatIds không thuộc chuyến xe đã chọn.',
      });
    }

    const resolvedSeatIds = tripSeats.map((s) => s.gheChuyenXeId);
    const seatNames = tripSeats.map((s) => s.ghe.soGhe);

    for (const seat of tripSeats) {
      if (seat.trangThai !== 'DANG_GIU') {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${seat.ghe.soGhe} không còn được giữ hợp lệ.`,
        });
      }
    }

    this.seatHoldsService.verifyHold(
      dto.holdToken,
      trip.chuyenXeId,
      resolvedSeatIds,
      customer?.khachHangId ?? null,
    );

    // Calculate fare & promotions quote
    const quote = await this.getBookingQuote(
      trip.chuyenXeId,
      resolvedSeatIds,
      dto.promotionCode,
      dto.contact.phone,
      principal,
    );
    const unitPrice = new Prisma.Decimal(quote.unitPrice);
    const originalTotal = new Prisma.Decimal(quote.originalTotal);

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
      throw new ConflictException({
        error: 'FARE_NOT_FOUND',
        message: 'Chưa có cấu hình giá vé áp dụng cho chuyến xe này.',
      });
    }
    if (!unitPrice.eq(fare.giaNiemYet)) {
      throw new ConflictException({
        error: 'FARE_CHANGED',
        message: 'Giá vé vừa thay đổi. Vui lòng kiểm tra lại báo giá.',
      });
    }
    const bangGiaId = fare.bangGiaId;

    // Optional cargo handling
    const hasCargo = Array.isArray(dto.cargoItems) && dto.cargoItems.length > 0;
    if (hasCargo && !trip.nhanGuiHang) {
      throw new ConflictException({
        error: 'TRIP_DOES_NOT_ACCEPT_CARGO',
        message: 'Chuyến xe này không nhận chở hàng hóa/xe máy.',
      });
    }

    // Contact/Passenger normalization
    const contactName = dto.contact.fullName.trim();
    const rawPhone = dto.contact.phone;
    const contactPhone = normalizePhone(rawPhone);
    const contactEmail = dto.contact.email?.trim() || null;
    const pickupPoint = dto.pickupPoint.trim();
    const dropoffPoint = dto.dropoffPoint.trim();

    // All-or-nothing database transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
      if (hasCargo) {
        await this.cargoCapacityService.lockTrip(tx, trip.chuyenXeId);
      }

      const cargoPricing = hasCargo
        ? await this.cargoPricingService.calculate(
            tx,
            {
              chuyenXeId: trip.chuyenXeId,
              tuyenXeId: trip.tuyenXeId,
              nhaXeId: trip.nhaXeId,
              ngayKhoiHanh: trip.ngayKhoiHanh,
            },
            {
              senderPointId: dto.senderPointId,
              receiverPointId: dto.receiverPointId,
              bookingLimits: {
                maxNonVehiclePackageWeightKg: 40,
                maxNonVehicleDimensionsCm: {
                  length: 150,
                  width: 80,
                  height: 80,
                },
              },
              items: dto.cargoItems!.map((item) => ({
                name: item.name,
                physicalType: item.type,
                quantity: item.quantity,
                weight: item.weight,
                loaiHangHoaId: item.loaiHangHoaId,
                length: item.length,
                width: item.width,
                height: item.height,
                serviceType:
                  item.category === 'fragile'
                    ? 'FRAGILE'
                    : item.category === 'valuable'
                      ? 'VALUABLE'
                      : 'NORMAL',
              })),
            },
          )
        : null;
      const shippingFee = cargoPricing?.totalFee ?? new Prisma.Decimal(0);
      const diemGuiId = cargoPricing?.senderPointId ?? null;
      const diemNhanId = cargoPricing?.receiverPointId ?? null;
      const mappedCargoItems = cargoPricing?.items.map((item, index) => ({
        itemDto: dto.cargoItems![index],
        loaiHangHoa: item.loaiHangHoa,
        effectiveUnitWeight: item.effectiveUnitWeight.toNumber(),
        totalWeight: item.totalWeight.toNumber(),
      })) ?? [];
      // 1. Consume hold if present
      let activeGiuChoId: number | null = null;
      const holdResult = await this.seatHoldsService.consumeHoldInTx(
        tx,
        dto.holdToken,
        trip.chuyenXeId,
        resolvedSeatIds,
        customer?.khachHangId ?? null,
      );
      activeGiuChoId = holdResult.giuChoId;
      if (!activeGiuChoId) {
        throw new ConflictException({
          error: 'HOLD_INVALID',
          message: 'Mã giữ chỗ không còn hợp lệ để đặt vé.',
        });
      }

      // 2. Validate cargo capacity if cargo present
      if (hasCargo) {
        const snapshot = await this.cargoCapacityService.getSnapshot(
          tx,
          trip.chuyenXeId,
        );
        if (!snapshot) {
          throw new NotFoundException({
            error: 'TRIP_NOT_FOUND',
            message: 'Không tìm thấy chuyến xe.',
          });
        }
        this.cargoCapacityService.assertAvailable(
          snapshot,
          mappedCargoItems.map((item) => ({
            group: item.loaiHangHoa.nhomSucChua as CargoCapacityGroup,
            quantity: item.itemDto.quantity,
          })),
        );
      }

      // 3. Resolve trusted booking identity and revalidate the promotion under a row lock.
      const bookingCustomer = taiKhoanId && dto.promotionCode?.trim()
        ? await tx.khachHang.findUnique({
            where: { taiKhoanId },
            select: {
              khachHangId: true,
              taiKhoan: {
                select: {
                  soDienThoai: true,
                  daXacThucSoDienThoai: true,
                },
              },
            },
          })
        : null;
      if (taiKhoanId && dto.promotionCode?.trim() && !bookingCustomer) {
        throw new ForbiddenException({
          error: 'CUSTOMER_PROFILE_REQUIRED',
          message: 'Tài khoản không có hồ sơ khách hàng hợp lệ.',
        });
      }
      const resolvedCustomerId =
        bookingCustomer?.khachHangId ?? customer?.khachHangId ?? null;
      const identityPhone = bookingCustomer
        ? bookingCustomer.taiKhoan.daXacThucSoDienThoai
          ? normalizePhone(bookingCustomer.taiKhoan.soDienThoai)
          : null
        : taiKhoanId
          ? null
          : contactPhone;
      const promotionQuote = dto.promotionCode?.trim()
        ? await this.promotionsService.lockPromotionForBooking(tx, {
            code: dto.promotionCode,
            nhaXeId: trip.nhaXeId,
            ticketOriginalTotal: originalTotal,
            khachHangId: resolvedCustomerId,
            phoneNormalized: identityPhone,
          })
        : null;
      const discountAmount =
        promotionQuote?.discountAmount ?? new Prisma.Decimal(0);
      const finalTicketTotal = originalTotal.sub(discountAmount);
      // Check under the promotion row lock before persisting any order/payment.
      // The client's quote is an expectation, never a source for charged amounts.
      if (promotionQuote) {
        const expected = dto.expectedPromotionQuote;
        if (!expected) {
          throw new BadRequestException({
            error: 'PROMOTION_QUOTE_REQUIRED',
            message: 'Vui lòng kiểm tra báo giá khuyến mãi trước khi đặt vé.',
          });
        }
        if (
          !originalTotal.eq(new Prisma.Decimal(expected.originalTotal)) ||
          !discountAmount.eq(new Prisma.Decimal(expected.discountAmount)) ||
          !finalTicketTotal.eq(new Prisma.Decimal(expected.finalTotal))
        ) {
          throw new ConflictException({
            error: 'PROMOTION_QUOTE_CHANGED',
            message: 'Ưu đãi hoặc giá vé vừa thay đổi. Vui lòng áp dụng lại mã và kiểm tra tổng tiền trước khi thanh toán.',
          });
        }
      }
      const totalOrderAmount = finalTicketTotal.add(shippingFee);

      const requiresPayment = totalOrderAmount.gt(0);

      // 4. Generate transaction codes
      const now = new Date();
      const opCode = trip.tuyenXe?.nhaXe?.maNhaXe || (trip.xe as any)?.nhaXe?.maNhaXe || 'VXG';
      const uniqueSuffix = randomUUID()
        .replaceAll('-', '')
        .slice(0, 30)
        .toUpperCase();
      const codePrefix = opCode.slice(0, 8);
      // Nội dung chuyển khoản cần giữ nguyên qua ngân hàng; tránh dấu phân cách.
      const paymentCodePrefix = (codePrefix.replace(/[^A-Za-z0-9]/g, '') || 'VXG').toUpperCase();
      const maDonGiaoDich = `${paymentCodePrefix}GD${uniqueSuffix}`;
      const maPhieuDatVe = `${codePrefix}-PDV-${uniqueSuffix}`;

      // 5. Create DonGiaoDich
      const donGiaoDich = await tx.donGiaoDich.create({
        data: {
          maDonGiaoDich,
          ngayTao: now,
          tongTien: totalOrderAmount,
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: contactName,
          soDienThoaiKhachHang: contactPhone,
          emailKhachHang: contactEmail,
          khachHangId: resolvedCustomerId,
          nhaXeId: trip.nhaXeId,
        },
      });
      // Only positive orders need the shared bank attempt; zero-total orders settle below.
      if (requiresPayment) {
        await createSepayPaymentAttempt(tx, {
          donGiaoDichId: donGiaoDich.donGiaoDichId,
          amount: totalOrderAmount,
          createdAt: donGiaoDich.ngayTao,
        });
      }

      // 6. Create PhieuDatVe
      const phieuDatVe = await tx.phieuDatVe.create({
        data: {
          maPhieuDatVe,
          ngayDat: now,
          soLuongVeBanDau: resolvedSeatIds.length,
          tongTienBanDau: originalTotal,
          trangThai: 'CHO_THANH_TOAN',
          khuyenMaiId: promotionQuote?.promotionId ?? null,
          soTienGiamKhuyenMai: discountAmount,
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
      });

      // 7. Deterministic ticket pricing & remainder allocation
      const orderedSeats = [...tripSeats].sort(
        (left, right) => left.gheChuyenXeId - right.gheChuyenXeId,
      );
      let allocatedDiscount = new Prisma.Decimal(0);

      const createdTickets: Array<{
        veId: number;
        maVe: string;
        soGhe: string;
        seatNumber: string;
        seatName: string;
        gia: number;
        price: number;
        status: string;
      }> = [];

      for (let i = 0; i < orderedSeats.length; i++) {
        const seat = orderedSeats[i];
        const ticketSeq = String(i + 1).padStart(2, '0');
        const ticketCode = `${maPhieuDatVe}-VE-${ticketSeq}`;
        const ticketDiscount =
          i === orderedSeats.length - 1
            ? discountAmount.sub(allocatedDiscount)
            : originalTotal.gt(0)
              ? unitPrice
                  .mul(discountAmount)
                  .div(originalTotal)
                  .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
              : new Prisma.Decimal(0);
        allocatedDiscount = allocatedDiscount.add(ticketDiscount);
        const actualTicketPrice = unitPrice.sub(ticketDiscount);

        const newVe = await tx.ve.create({
          data: {
            maVe: ticketCode,
            diemDon: pickupPoint,
            giaNiemYet: unitPrice,
            giaThucTe: actualTicketPrice,
            trangThai: 'DA_DAT',
            phieuDatVeId: phieuDatVe.phieuDatVeId,
            gheChuyenXeId: seat.gheChuyenXeId,
            bangGiaApDungId: bangGiaId,
          },
        });

        createdTickets.push({
          veId: newVe.veId,
          maVe: ticketCode,
          soGhe: seat.ghe.soGhe,
          seatNumber: seat.ghe.soGhe,
          seatName: seat.ghe.soGhe,
          gia: actualTicketPrice.toNumber(),
          price: actualTicketPrice.toNumber(),
          status: 'DA_DAT',
        });
      }

      // 8. Update only seats owned by the hold consumed in this transaction.
      const updatedSeats = await tx.gheChuyenXe.updateMany({
        where: {
          chuyenXeId: trip.chuyenXeId,
          gheChuyenXeId: { in: resolvedSeatIds },
          trangThai: 'DANG_GIU',
          giuChoId: activeGiuChoId,
        },
        data: {
          trangThai: 'DA_DAT',
          giuChoId: null,
        },
      });

      if (updatedSeats.count !== resolvedSeatIds.length) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: 'Một hoặc nhiều ghế đã không còn ở trạng thái giữ chỗ hợp lệ.',
        });
      }

      // 9. Status history recording
      const operationId = generateUuidV1();
      const operationTime = now;

      if ((tx as any).lichSuTrangThaiPhieuDatVe) {
        await (tx as any).lichSuTrangThaiPhieuDatVe.create({
          data: {
            phieuDatVeId: phieuDatVe.phieuDatVeId,
            trangThaiCu: null,
            trangThaiMoi: 'CHO_THANH_TOAN',
            thoiDiem: operationTime,
            nguonThayDoi: customer?.taiKhoanId ? 'CUSTOMER' : 'SYSTEM',
            taiKhoanId: customer?.taiKhoanId ?? null,
            lyDo: 'Khởi tạo đặt vé',
            laOverride: false,
            maThaoTac: operationId,
          },
        });
      }

      if ((tx as any).lichSuTrangThaiVe) {
        for (const ticket of createdTickets) {
          await (tx as any).lichSuTrangThaiVe.create({
            data: {
              veId: ticket.veId,
              trangThaiCu: null,
              trangThaiMoi: 'DA_DAT',
              thoiDiem: operationTime,
              nguonThayDoi: customer?.taiKhoanId ? 'CUSTOMER' : 'SYSTEM',
              taiKhoanId: customer?.taiKhoanId ?? null,
              lyDo: 'Khởi tạo vé',
              laOverride: false,
              maThaoTac: operationId,
            },
          });
        }
      }

      // 10. Shipment creation if cargo requested
      let createdShipment: any = null;
      if (hasCargo) {
        if (!cargoPricing || diemGuiId === null || diemNhanId === null) {
          throw new ConflictException({
            error: 'CARGO_POINTS_REQUIRED',
            message: 'Không thể tạo hàng gửi kèm vé khi chưa xác định đủ điểm gửi và điểm nhận.',
          });
        }

        const maVanDon = `${codePrefix}-VD-${uniqueSuffix}`;
        const cargoPersistence = await this.shipmentPersistenceService.persistInTransaction(
          tx,
          {
            waybillCode: maVanDon,
            recipientName: contactName,
            recipientPhone: contactPhone,
            sentAt: now,
            baseFee: cargoPricing.baseFee,
            serviceFee: cargoPricing.serviceFee,
            discount: 0,
            totalFee: cargoPricing.totalFee,
            note: 'Hành lý/hàng gửi kèm vé cùng chuyến',
            tripId: trip.chuyenXeId,
            senderPointId: diemGuiId,
            receiverPointId: diemNhanId,
            orderId: donGiaoDich.donGiaoDichId,
            actorAccountId: taiKhoanId ?? null,
            historyNote: 'Tạo phiếu gửi hàng kèm đặt vé',
            items: cargoPricing.items.map((resolvedItem, index) => {
              const item = dto.cargoItems![index];
              const vehicleModel = item.motorbikeModel || item.bicycleType;
              const description = [
                item.note?.trim(),
                vehicleModel ? `Loại phương tiện / Dòng xe: ${vehicleModel}` : null,
                item.licensePlate ? `Biển số: ${item.licensePlate}` : null,
              ]
                .filter(Boolean)
                .join(' | ');

              return {
                name: item.name.trim(),
                quantity: item.quantity,
                unitWeight: resolvedItem.effectiveUnitWeight,
                length: item.length || null,
                width: item.width || null,
                height: item.height || null,
                description: description || null,
                cargoTypeId: resolvedItem.loaiHangHoa.loaiHangHoaId,
              };
            }),
            rates: cargoPricing.rates.map((rate) => ({
              cargoTypeId: rate.loaiHangHoaId,
              rateId: rate.bangCuocGuiHangId,
              billableWeight: rate.totalWeight,
              fee: rate.fee,
            })),
          },
        );

        createdShipment = {
          shipmentId: cargoPersistence.shipment.phieuGuiHangId,
          shipmentCode: maVanDon,
          shippingFee: shippingFee.toNumber(),
          itemCount: cargoPersistence.items.length,
        };
      }

      if (promotionQuote) {
        const commitPromotionQuote = await this.promotionsService.lockPromotionForBooking(
          tx,
          {
            code: promotionQuote.code,
            nhaXeId: trip.nhaXeId,
            ticketOriginalTotal: originalTotal,
            khachHangId: resolvedCustomerId,
            phoneNormalized: identityPhone,
          },
        );
        if (
          !commitPromotionQuote.discountAmount.eq(discountAmount) ||
          commitPromotionQuote.promotionId !== promotionQuote.promotionId
        ) {
          throw new ConflictException({
            error: 'PROMOTION_UNAVAILABLE',
            message: 'Mã khuyến mãi vừa thay đổi. Vui lòng kiểm tra lại.',
          });
        }
        await this.promotionsService.recordUsageInTransaction(tx, {
          promotionId: commitPromotionQuote.promotionId,
          bookingId: phieuDatVe.phieuDatVeId,
          customerId: resolvedCustomerId,
          phoneNormalized: identityPhone,
          discountAmount,
          quotaLimit: commitPromotionQuote.quotaLimit,
        });
      }

      // A zero-total order is settled internally; no bank payment or provider event exists.
      // Keep both lifecycle transitions in this transaction so any failure rolls back the hold,
      // seats, booking, histories, and promotion usage together.
      if (!requiresPayment) {
        const completion = {
          thoiDiem: now,
          nguonThayDoi: 'SYSTEM',
          taiKhoanId: null,
          lyDo: 'Đơn 0đ – miễn thanh toán',
          laOverride: false,
          maThaoTac: generateUuidV1(),
        };
        await tx.donGiaoDich.update({
          where: { donGiaoDichId: donGiaoDich.donGiaoDichId },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
        await tx.phieuDatVe.update({
          where: { phieuDatVeId: phieuDatVe.phieuDatVeId },
          data: { trangThai: 'DA_THANH_TOAN' },
        });
        await tx.lichSuTrangThaiPhieuDatVe.create({
          data: {
            ...completion,
            phieuDatVeId: phieuDatVe.phieuDatVeId,
            trangThaiCu: 'CHO_THANH_TOAN',
            trangThaiMoi: 'DA_THANH_TOAN',
          },
        });
        for (const ticket of createdTickets) {
          await tx.ve.update({
            where: { veId: ticket.veId },
            data: { trangThai: 'DA_THANH_TOAN' },
          });
          await tx.lichSuTrangThaiVe.create({
            data: {
              ...completion,
              veId: ticket.veId,
              trangThaiCu: 'DA_DAT',
              trangThaiMoi: 'DA_THANH_TOAN',
            },
          });
          ticket.status = 'DA_THANH_TOAN';
        }
        donGiaoDich.trangThai = 'DA_THANH_TOAN';
        phieuDatVe.trangThai = 'DA_THANH_TOAN';
      }

      return {
        donGiaoDich,
        phieuDatVe,
        createdTickets,
        createdShipment,
        shippingFee,
        totalOrderAmount,
        originalTotal,
        discountAmount,
        finalTicketTotal,
        promotionCode: promotionQuote?.code ?? null,
      };
    });

    this.logger.log(
      `Created booking #${txResult.phieuDatVe.phieuDatVeId} (${txResult.phieuDatVe.maPhieuDatVe}) with ${seatNames.length} seats.`,
    );

    return {
      bookingId: txResult.phieuDatVe.phieuDatVeId,
      bookingCode: txResult.phieuDatVe.maPhieuDatVe,
      orderId: txResult.donGiaoDich.donGiaoDichId,
      orderCode: txResult.donGiaoDich.maDonGiaoDich,
      tripId: trip.chuyenXeId,
      status: txResult.phieuDatVe.trangThai,
      contact: {
        fullName: contactName,
        phone: contactPhone,
        email: contactEmail ?? '',
      },
      passenger: {
        fullName: contactName,
        phoneNumber: contactPhone,
        email: contactEmail ?? '',
      },
      pickupPoint,
      dropoffPoint,
      seats: seatNames,
      seatIds: resolvedSeatIds,
      ticketCount: resolvedSeatIds.length,
      tickets: txResult.createdTickets,
      originalTicketSubtotal: txResult.originalTotal.toNumber(),
      discountAmount: txResult.discountAmount.toNumber(),
      promotionCode: txResult.promotionCode,
      ticketSubtotal: txResult.finalTicketTotal.toNumber(),
      shippingFee: txResult.shippingFee.toNumber(),
      totalAmount: txResult.totalOrderAmount.toNumber(),
      shipment: txResult.createdShipment,
      createdAt: txResult.phieuDatVe.createdAt ? txResult.phieuDatVe.createdAt.toISOString() : new Date().toISOString(),
      paymentExpiresAt: getBookingPaymentDeadline(
        txResult.donGiaoDich.ngayTao,
      ).toISOString(),
      serverTime: new Date().toISOString(),
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
        donGiaoDich: {
          include: {
            nhaXe: true,
            thanhToans: {
              orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
              take: 1,
            },
            phieuGuiHang: {
              include: {
                hangHoas: {
                  include: { loaiHangHoa: true },
                },
              },
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

  async findPublicBookingById(
    bookingId: number,
    principal?: AuthPrincipal,
    bookingCode?: string,
    phoneNumber?: string,
  ) {
    const booking = await this.loadBookingForPublicDetail(bookingId);

    if (booking.donGiaoDich.khachHangId != null) {
      if (booking.donGiaoDich.khachHang?.taiKhoanId !== principal?.taiKhoanId) {
        throw new ForbiddenException({
          error: 'FORBIDDEN_BOOKING_ACCESS',
          message: 'Bạn không có quyền truy cập phiếu đặt vé này.',
        });
      }
    } else if (
      !/-PDV-[A-F\d]{30}$/i.test(booking.maPhieuDatVe) ||
      !bookingCode?.trim() ||
      booking.maPhieuDatVe !== bookingCode.trim() ||
      !phoneNumber?.trim() ||
      normalizePhone(booking.donGiaoDich.soDienThoaiKhachHang) !==
        normalizePhone(phoneNumber)
    ) {
      throw new NotFoundException({
        error: 'BOOKING_NOT_FOUND',
        message: 'Không tìm thấy phiếu đặt vé.',
      });
    }

    return this.mapBooking(booking);
  }

  private async loadBookingForPublicDetail(bookingId: number) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: {
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
        donGiaoDich: {
          include: {
            khachHang: true,
            nhaXe: true,
            thanhToans: {
              orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
              take: 1,
            },
            phieuGuiHang: {
              include: {
                hangHoas: {
                  include: {
                    loaiHangHoa: true,
                  },
                },
              },
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

    return booking;
  }

  async findCustomerBookingById(taiKhoanId: number, bookingId: number) {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: {
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
        donGiaoDich: {
          include: {
            khachHang: true,
            nhaXe: true,
            thanhToans: {
              orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
              take: 1,
            },
            phieuGuiHang: {
              include: {
                hangHoas: {
                  include: { loaiHangHoa: true },
                },
              },
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

    if (booking.donGiaoDich.khachHang?.taiKhoanId !== taiKhoanId) {
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

    const activeSeatNumbers = (booking.ves ?? [])
      .filter((v: any) => v.trangThai !== 'HUY')
      .map((v: any) => v.gheChuyenXe?.ghe?.soGhe)
      .filter(Boolean);

    const cancelledSeatNumbers = (booking.ves ?? [])
      .filter((v: any) => v.trangThai === 'HUY')
      .map((v: any) => v.gheChuyenXe?.ghe?.soGhe)
      .filter(Boolean);

    const tickets = (booking.ves ?? []).map((v: any) => ({
      ticketId: v.veId,
      ticketCode: v.maVe,
      seatNumber: v.gheChuyenXe?.ghe?.soGhe ?? null,
      seatPosition: v.gheChuyenXe?.ghe?.viTri ?? null,
      price: Number(v.giaThucTe ?? v.giaNiemYet ?? 0),
      status: v.trangThai,
    }));

    const latestPayment = booking.donGiaoDich?.thanhToans?.[0];

    const shipment = booking.donGiaoDich?.phieuGuiHang;
    const cargoItems = (shipment?.hangHoas ?? []).map((h: any) => ({
      name: h.tenHang,
      quantity: h.soLuong,
      weight: Number(h.khoiLuong),
      category: h.loaiHangHoa?.nhomSucChua ?? 'HANG_NHE',
      categoryName: h.loaiHangHoa?.tenLoai ?? 'Hàng nhẹ',
    }));
    const ticketSubtotal = (booking.ves ?? []).reduce(
      (sum: number, ticket: any) =>
        sum + Number(ticket.giaThucTe ?? ticket.giaNiemYet ?? 0),
      0,
    );
    const originalTicketSubtotal = Number(booking.tongTienBanDau ?? 0);
    const paymentExpiresAt = getBookingPaymentDeadline(booking.donGiaoDich.ngayTao);
    const bookingPaymentIsPending =
      booking.trangThai === 'CHO_THANH_TOAN' &&
      booking.donGiaoDich?.trangThai === 'CHO_THANH_TOAN';
    const bookingPaymentHasExpired =
      bookingPaymentIsPending && paymentExpiresAt <= new Date();

    return {
      bookingId: booking.phieuDatVeId,
      bookingCode: booking.maPhieuDatVe,
      orderId: booking.donGiaoDichId,
      orderCode: booking.donGiaoDich?.maDonGiaoDich ?? null,
      tripId: chuyenXe?.chuyenXeId ?? null,
      ticketCount: booking.ves?.length || booking.soLuongVeBanDau || 0,
      activeTicketCount: activeSeatNumbers.length,
      route,
      origin: tuyenXe?.diemDi ?? null,
      destination: tuyenXe?.diemDen ?? null,
      departureTime,
      busCompanyName: nhaXe?.tenNhaXe ?? null,
      vehicleType: loaiXe?.tenLoai ?? null,
      seatNumbers,
      activeSeatNumbers,
      cancelledSeatNumbers,
      passenger: {
        fullName: booking.donGiaoDich?.tenKhachHang || booking.donGiaoDich?.khachHang?.hoTen || null,
        phoneNumber: booking.donGiaoDich?.soDienThoaiKhachHang || null,
        email: booking.donGiaoDich?.emailKhachHang || null,
      },
      pickup: firstTicket?.diemDon || tuyenXe?.diemDi || null,
      dropoff: tuyenXe?.diemDen || null,
      totalAmount: Number(booking.donGiaoDich?.tongTien ?? 0),
      ticketSubtotal,
      originalTicketSubtotal,
      discountAmount: Number(booking.soTienGiamKhuyenMai ?? 0),
      promotionCode: booking.khuyenMai?.maKhuyenMai ?? null,
      cargoFee: Number(shipment?.tongPhi ?? 0),
      cargoItems,
      status: bookingPaymentHasExpired ? 'HET_HAN' : booking.trangThai,
      paymentStatus: bookingPaymentHasExpired
        ? 'HET_HAN'
        : (booking.donGiaoDich?.trangThai ?? null),
      paymentExpiresAt: paymentExpiresAt.toISOString(),
      serverTime: new Date().toISOString(),
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
