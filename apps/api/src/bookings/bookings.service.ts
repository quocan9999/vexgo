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
import { SeatHoldsService } from '../seat-holds/seat-holds.service.js';
import { PromotionsService } from '../promotions/promotions.service.js';
import { generateUuidV1 } from '../common/uuid-v1.js';
import { getBookingPaymentDeadline } from '../common/booking-payment-deadline.js';
import {
  businessDateStartUtc,
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';
import type { CargoItemDto, CreateBookingDto } from './dto/create-booking.dto.js';
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
      throw new ConflictException({
        error: 'FARE_NOT_FOUND',
        message: 'Chưa có cấu hình giá vé áp dụng cho chuyến xe này.',
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

    let shippingFee = 0;
    let mappedCargoItems: Array<{
      itemDto: CargoItemDto;
      loaiHangHoa: { loaiHangHoaId: number; tenLoai: string; nhomSucChua: string };
      effectiveUnitWeight: number;
      totalWeight: number;
    }> = [];
    const categoryWeights = new Map<number, number>();
    const selectedRates = new Map<
      number,
      { bangCuocGuiHangId: number; totalWeight: number; fee: Prisma.Decimal }
    >();

    let diemGuiId: number | null = null;
    let diemNhanId: number | null = null;

    if (hasCargo) {
      const routePoints = await this.prisma.diemGiaoNhanTuyenXe.findMany({
        where: {
          tuyenXeId: trip.tuyenXeId,
          diemGiaoNhanHang: {
            nhaXeId: trip.nhaXeId,
            trangThai: 'HOAT_DONG',
          },
        },
        include: { diemGiaoNhanHang: true },
      });

      const senderCandidates = routePoints.filter(
        (point) =>
          (point.vaiTro === 'GUI_HANG' || point.vaiTro === 'CA_HAI') &&
          point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
          point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId,
      );
      const receiverCandidates = routePoints.filter(
        (point) =>
          (point.vaiTro === 'NHAN_HANG' || point.vaiTro === 'CA_HAI') &&
          point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
          point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId,
      );

      if (senderCandidates.length === 0 || receiverCandidates.length === 0) {
        throw new ConflictException({
          error: 'SHIPMENT_POINTS_NOT_CONFIGURED',
          message: 'Tuyến xe chưa được cấu hình điểm gửi/nhận hàng.',
        });
      }

      const resolveRoutePoint = (
        requestedId: number | undefined,
        candidates: typeof routePoints,
        role: 'gửi' | 'nhận',
      ) => {
        if (requestedId !== undefined) {
          const requestedPoint = candidates.find(
            (point) => point.diemGiaoNhanHangId === requestedId,
          );
          if (!requestedPoint) {
            throw new ConflictException({
              error: 'SHIPMENT_POINT_INVALID',
              message: `Điểm ${role} không thuộc tuyến và nhà xe của chuyến xe.`,
            });
          }
          return requestedPoint.diemGiaoNhanHangId;
        }
        if (candidates.length !== 1) {
          throw new ConflictException({
            error: 'SHIPMENT_POINT_REQUIRED',
            message: `Vui lòng chọn điểm ${role} hàng trên tuyến xe.`,
          });
        }
        return candidates[0].diemGiaoNhanHangId;
      };

      diemGuiId = resolveRoutePoint(
        dto.senderPointId,
        senderCandidates,
        'gửi',
      );
      diemNhanId = resolveRoutePoint(
        dto.receiverPointId,
        receiverCandidates,
        'nhận',
      );
      if (diemGuiId === diemNhanId) {
        throw new ConflictException({
          error: 'SHIPMENT_POINTS_MUST_DIFFER',
          message: 'Điểm gửi và điểm nhận hàng phải khác nhau.',
        });
      }

      const allLoaiHang = await this.prisma.loaiHangHoa.findMany({
        where: { trangThai: 'HOAT_DONG' },
      });

      const activeRates = await this.prisma.bangCuocGuiHang.findMany({
        where: {
          diemGuiId,
          diemNhanId,
          trangThai: 'HOAT_DONG',
          tuNgay: { lte: trip.ngayKhoiHanh },
          OR: [{ denNgay: null }, { denNgay: { gte: trip.ngayKhoiHanh } }],
        },
      });

      for (const item of dto.cargoItems!) {
        let loaiHang: (typeof allLoaiHang)[0] | undefined;
        const itemTypeUpper = (item.type || item.name || '').toUpperCase();
        const isMotorbike = itemTypeUpper.includes('XE MÁY') || itemTypeUpper.includes('MOTORCYCLE');
        const isBicycle = itemTypeUpper.includes('XE ĐẠP') || itemTypeUpper.includes('BICYCLE');
        const isVehicle = isMotorbike || isBicycle;

        if (!isVehicle) {
          if (
            (item.length && item.length > 150) ||
            (item.width && item.width > 80) ||
            (item.height && item.height > 80)
          ) {
            throw new BadRequestException({
              error: 'CARGO_DIMENSIONS_EXCEEDED',
              message: `Kích thước món "${item.name}" vượt quá quy định hầm xe khách (Dài ≤ 150cm, Rộng ≤ 80cm, Cao ≤ 80cm).`,
            });
          }
        }

        const volumetricWeight =
          !isVehicle && item.length && item.width && item.height
            ? Math.round(((item.length * item.width * item.height) / 5000) * 10) / 10
            : 0;
        const effectiveUnitWeight = isMotorbike
          ? (item.weight || 100)
          : isBicycle
            ? (item.weight || 15)
            : Math.max(item.weight, volumetricWeight);

        if (isMotorbike) {
          loaiHang = allLoaiHang.find((l) => l.nhomSucChua === 'XE_MAY');
        } else if (isBicycle || (effectiveUnitWeight >= 20 && effectiveUnitWeight <= 40)) {
          loaiHang = allLoaiHang.find((l) => l.nhomSucChua === 'HANG_CONG_KENH');
        } else {
          loaiHang = allLoaiHang.find((l) => l.nhomSucChua === 'HANG_NHE');
        }

        if (!loaiHang) {
          throw new ConflictException({
            error: 'CARGO_TYPE_NOT_FOUND',
            message: `Không tìm thấy loại hàng phù hợp cho món: ${item.name}`,
          });
        }

        const totalWeight = effectiveUnitWeight * item.quantity;
        if (!Number.isFinite(totalWeight) || totalWeight <= 0) {
          throw new BadRequestException({
            error: 'CARGO_WEIGHT_INVALID',
            message: `Khối lượng hàng "${item.name}" không hợp lệ.`,
          });
        }

        if (!isVehicle && totalWeight > 40) {
          throw new BadRequestException({
            error: 'CARGO_WEIGHT_EXCEEDED',
            message: `Hành lý "${item.name}" có khối lượng (${totalWeight}kg) vượt quá hạn mức tối đa 40kg đi kèm vé. Quý khách vui lòng tạo đơn gửi hàng riêng tại mục Gửi hàng bưu kiện.`,
          });
        }

        mappedCargoItems.push({
          itemDto: item,
          loaiHangHoa: loaiHang,
          effectiveUnitWeight,
          totalWeight,
        });
        categoryWeights.set(
          loaiHang.loaiHangHoaId,
          (categoryWeights.get(loaiHang.loaiHangHoaId) ?? 0) + totalWeight,
        );
      }

      for (const [loaiHangHoaId, totalWeight] of categoryWeights.entries()) {
        const matchingRates = activeRates.filter(
          (rate) =>
            rate.loaiHangHoaId === loaiHangHoaId &&
            Number(rate.khoiLuongTu) <= totalWeight &&
            (rate.khoiLuongDen === null ||
              Number(rate.khoiLuongDen) >= totalWeight),
        );
        if (matchingRates.length !== 1) {
          throw new ConflictException({
            error:
              matchingRates.length > 1
                ? 'CARGO_RATE_AMBIGUOUS'
                : 'CARGO_RATE_NOT_FOUND',
            message:
              matchingRates.length > 1
                ? 'Có nhiều mức cước phù hợp cho loại hàng và tổng khối lượng này.'
                : 'Chưa có mức cước phù hợp cho loại hàng và tổng khối lượng này.',
          });
        }

        const rate = matchingRates[0];
        const fee = new Prisma.Decimal(rate.mucCuoc);
        if (
          !fee.isFinite() ||
          fee.isNegative() ||
          !Number.isSafeInteger(fee.toNumber())
        ) {
          throw new ConflictException({
            error: 'CARGO_RATE_INVALID',
            message: 'Mức cước cấu hình không hợp lệ.',
          });
        }

        selectedRates.set(loaiHangHoaId, {
          bangCuocGuiHangId: rate.bangCuocGuiHangId,
          totalWeight,
          fee,
        });
        shippingFee += fee.toNumber();
      }
    }

    const totalOrderAmount = quote.finalTotal + shippingFee;

    // Contact/Passenger normalization
    const contactName = dto.contact.fullName.trim();
    const rawPhone = dto.contact.phone;
    const contactPhone = normalizePhone(rawPhone);
    const contactEmail = dto.contact.email?.trim() || null;
    const pickupPoint = dto.pickupPoint.trim();
    const dropoffPoint = dto.dropoffPoint.trim();

    // All-or-nothing database transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
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
        const activeShipments = await tx.hangHoa.findMany({
          where: {
            phieuGuiHang: {
              chuyenXeId: trip.chuyenXeId,
              trangThai: { notIn: ['DA_HUY', 'DA_GIAO'] },
            },
          },
          include: {
            loaiHangHoa: { select: { nhomSucChua: true } },
          },
        });

        let usedXeMay = 0;
        let usedCongKenh = 0;
        let usedNhe = 0;
        for (const itm of activeShipments) {
          if (itm.loaiHangHoa.nhomSucChua === 'XE_MAY') usedXeMay += itm.soLuong;
          else if (itm.loaiHangHoa.nhomSucChua === 'HANG_CONG_KENH') usedCongKenh += itm.soLuong;
          else if (itm.loaiHangHoa.nhomSucChua === 'HANG_NHE') usedNhe += itm.soLuong;
        }

        let newXeMay = 0;
        let newCongKenh = 0;
        let newNhe = 0;
        for (const m of mappedCargoItems) {
          if (m.loaiHangHoa.nhomSucChua === 'XE_MAY') newXeMay += m.itemDto.quantity;
          else if (m.loaiHangHoa.nhomSucChua === 'HANG_CONG_KENH') newCongKenh += m.itemDto.quantity;
          else if (m.loaiHangHoa.nhomSucChua === 'HANG_NHE') newNhe += m.itemDto.quantity;
        }

        if (usedXeMay + newXeMay > trip.sucChuaXeMay) {
          throw new ConflictException({
            error: 'CARGO_CAPACITY_EXCEEDED',
            message: 'Chuyến xe đã hết chỗ chở xe máy.',
          });
        }
        if (usedCongKenh + newCongKenh > trip.sucChuaHangCongKenh) {
          throw new ConflictException({
            error: 'CARGO_CAPACITY_EXCEEDED',
            message: 'Chuyến xe đã hết chỗ chứa hàng cồng kềnh.',
          });
        }
        if (usedNhe + newNhe > trip.sucChuaHangNhe) {
          throw new ConflictException({
            error: 'CARGO_CAPACITY_EXCEEDED',
            message: 'Chuyến xe đã hết chỗ chứa hàng nhẹ.',
          });
        }
      }

      // 3. Resolve customer ID
      const resolvedCustomerId = customer?.khachHangId ?? null;

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
          tongTien: new Prisma.Decimal(totalOrderAmount),
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: contactName,
          soDienThoaiKhachHang: contactPhone,
          emailKhachHang: contactEmail,
          khachHangId: resolvedCustomerId,
          nhaXeId: trip.nhaXeId,
          // Tạo payment chờ trong cùng transaction, trước khi trả booking/QR.
          // Guest dùng quyền tạo booking hiện có, không cần mở endpoint thanh toán công khai.
          thanhToans: {
            create: {
              phuongThuc: 'SEPAY',
              loaiGiaoDich: 'THANH_TOAN',
              trangThai: 'DANG_XU_LY',
              soTien: new Prisma.Decimal(totalOrderAmount),
              thoiGian: now,
            },
          },
        },
      });

      // 6. Create PhieuDatVe
      const phieuDatVe = await tx.phieuDatVe.create({
        data: {
          maPhieuDatVe,
          ngayDat: now,
          soLuongVeBanDau: resolvedSeatIds.length,
          tongTienBanDau: new Prisma.Decimal(quote.originalTotal),
          trangThai: 'CHO_THANH_TOAN',
          khuyenMaiId: promotionRecord?.khuyenMaiId ?? null,
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
      });

      // 7. Deterministic ticket pricing & remainder allocation
      const seatCount = resolvedSeatIds.length || 1;
      const baseTicketPrice = Math.floor(quote.finalTotal / seatCount);
      const remainder = quote.finalTotal % seatCount;

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

      for (let i = 0; i < tripSeats.length; i++) {
        const seat = tripSeats[i];
        const ticketSeq = String(i + 1).padStart(2, '0');
        const ticketCode = `${maPhieuDatVe}-VE-${ticketSeq}`;
        const actualTicketPrice = baseTicketPrice + (i < remainder ? 1 : 0);

        const newVe = await tx.ve.create({
          data: {
            maVe: ticketCode,
            diemDon: pickupPoint,
            giaNiemYet: quote.unitPrice,
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
          gia: actualTicketPrice,
          price: actualTicketPrice,
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
      if (hasCargo && diemGuiId && diemNhanId) {
        const maVanDon = `${codePrefix}-VD-${uniqueSuffix}`;
        const phieuGui = await tx.phieuGuiHang.create({
          data: {
            maVanDon,
            tenNguoiNhan: contactName,
            soDienThoaiNguoiNhan: contactPhone,
            ngayGui: now,
            cuocChinh: new Prisma.Decimal(shippingFee),
            phiDichVu: new Prisma.Decimal(0),
            soTienGiam: new Prisma.Decimal(0),
            tongPhi: new Prisma.Decimal(shippingFee),
            nguoiTraCuoc: 'NGUOI_GUI',
            ghiChu: 'Hành lý/hàng gửi kèm vé cùng chuyến',
            trangThai: 'MOI_TAO',
            chuyenXeId: trip.chuyenXeId,
            diemGuiId,
            diemNhanId,
            donGiaoDichId: donGiaoDich.donGiaoDichId,
          },
        });

        await tx.lichSuTrangThaiPhieuGuiHang.create({
          data: {
            trangThai: 'MOI_TAO',
            thoiGian: now,
            ghiChu: 'Tạo phiếu gửi hàng kèm đặt vé',
            phieuGuiHangId: phieuGui.phieuGuiHangId,
            taiKhoanId: taiKhoanId || null,
          },
        });

        for (const m of mappedCargoItems) {
          const vehicleModel = m.itemDto.motorbikeModel || m.itemDto.bicycleType;
          const itemDescription = [
            m.itemDto.note,
            vehicleModel ? `Loại phương tiện / Dòng xe: ${vehicleModel}` : null,
            m.itemDto.licensePlate ? `Biển số: ${m.itemDto.licensePlate}` : null,
          ].filter(Boolean).join(' | ');

          await tx.hangHoa.create({
            data: {
              tenHang: m.itemDto.name,
              soLuong: m.itemDto.quantity,
              khoiLuong: new Prisma.Decimal(m.effectiveUnitWeight),
              moTa: itemDescription || null,
              phieuGuiHangId: phieuGui.phieuGuiHangId,
              loaiHangHoaId: m.loaiHangHoa.loaiHangHoaId,
            },
          });
        }

        for (const [loaiHangHoaId, rate] of selectedRates.entries()) {
          await tx.chiTietCuocGuiHang.create({
            data: {
              phieuGuiHangId: phieuGui.phieuGuiHangId,
              loaiHangHoaId,
              bangCuocGuiHangId: rate.bangCuocGuiHangId,
              khoiLuongTinhCuoc: new Prisma.Decimal(rate.totalWeight),
              soTienCuoc: rate.fee,
            },
          });
        }

        createdShipment = {
          shipmentId: phieuGui.phieuGuiHangId,
          shipmentCode: maVanDon,
          shippingFee,
          itemCount: mappedCargoItems.length,
        };
      }

      return {
        donGiaoDich,
        phieuDatVe,
        createdTickets,
        createdShipment,
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
      ticketSubtotal: quote.finalTotal,
      shippingFee,
      totalAmount: totalOrderAmount,
      shipment: txResult.createdShipment,
      createdAt: txResult.phieuDatVe.createdAt ? txResult.phieuDatVe.createdAt.toISOString() : new Date().toISOString(),
      paymentExpiresAt: getBookingPaymentDeadline(
        txResult.phieuDatVe.createdAt,
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
    const paymentExpiresAt = getBookingPaymentDeadline(booking.createdAt);
    const bookingPaymentIsPending =
      ['CHO_THANH_TOAN', 'DANG_XU_LY'].includes(booking.trangThai) &&
      ['CHO_THANH_TOAN', 'DANG_XU_LY'].includes(
        booking.donGiaoDich?.trangThai ?? '',
      );
    const bookingPaymentHasExpired =
      bookingPaymentIsPending && paymentExpiresAt <= new Date();

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
      discountAmount: Math.max(0, originalTicketSubtotal - ticketSubtotal),
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
