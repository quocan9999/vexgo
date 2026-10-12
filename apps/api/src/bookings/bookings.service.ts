import {
  BadRequestException,
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
import { generateUuidV1 } from '../common/uuid-v1.js';
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

  async createBooking(arg1: any, arg2?: any) {
    let dto: CreateBookingDto;
    let principal: AuthPrincipal | undefined;
    let explicitTaiKhoanId: number | undefined;

    if (arg1 && typeof arg1 === 'object' && ('tripId' in arg1 || 'seatNumbers' in arg1 || 'seatIds' in arg1)) {
      dto = arg1 as CreateBookingDto;
      if (typeof arg2 === 'number') {
        explicitTaiKhoanId = arg2;
      } else if (arg2 && typeof arg2 === 'object' && 'taiKhoanId' in arg2) {
        principal = arg2 as AuthPrincipal;
      }
    } else {
      dto = arg2 as CreateBookingDto;
      if (typeof arg1 === 'number') {
        explicitTaiKhoanId = arg1;
      } else if (arg1 && typeof arg1 === 'object' && 'taiKhoanId' in arg1) {
        principal = arg1 as AuthPrincipal;
      }
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

    // Resolve customer ownership if principal or explicit user id is passed
    const taiKhoanId = principal?.taiKhoanId ?? explicitTaiKhoanId;
    let customer: { khachHangId: number; taiKhoanId: number | null } | null = null;
    if (taiKhoanId) {
      customer = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId },
        select: { khachHangId: true, taiKhoanId: true },
      });
      if (!customer && principal && (!dto.passenger && !dto.contact)) {
        throw new ForbiddenException('Tài khoản không phải là khách hàng hợp lệ.');
      }
    }

    // Resolve seats (support both seatIds numeric and seatNumbers strings)
    let tripSeats: any[] = [];
    if (Array.isArray(dto.seatIds) && dto.seatIds.length > 0) {
      const numericIds = dto.seatIds.map(Number).filter((n) => !isNaN(n) && n > 0);
      tripSeats = await this.prisma.gheChuyenXe.findMany({
        where: {
          chuyenXeId: trip.chuyenXeId,
          gheChuyenXeId: { in: numericIds },
        },
        include: { ghe: true },
      });
      if (tripSeats.length !== numericIds.length) {
        const byGheId = await this.prisma.gheChuyenXe.findMany({
          where: {
            chuyenXeId: trip.chuyenXeId,
            gheId: { in: numericIds },
          },
          include: { ghe: true },
        });
        if (byGheId.length === numericIds.length) {
          tripSeats = byGheId;
        }
      }
    } else if (Array.isArray(dto.seatNumbers) && dto.seatNumbers.length > 0) {
      const uniqueSeatNumbers = Array.from(new Set(dto.seatNumbers.map((s) => s.trim())));
      tripSeats = await this.prisma.gheChuyenXe.findMany({
        where: {
          chuyenXeId: trip.chuyenXeId,
          ghe: { soGhe: { in: uniqueSeatNumbers } },
        },
        include: { ghe: true },
      });
    }

    if (tripSeats.length === 0) {
      throw new ConflictException({
        error: 'INVALID_SEATS',
        message: 'Danh sách ghế không được để trống hoặc không tìm thấy trên chuyến xe.',
      });
    }

    const resolvedSeatIds = tripSeats.map((s) => s.gheChuyenXeId);
    const seatNames = tripSeats.map((s) => s.ghe.soGhe);

    for (const seat of tripSeats) {
      if (seat.trangThai === 'DA_DAT') {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${seat.ghe.soGhe} đã được đặt bởi khách hàng khác.`,
        });
      }
    }

    // Verify hold token if provided
    if (dto.holdToken) {
      this.seatHoldsService.verifyHold(
        dto.holdToken,
        trip.chuyenXeId,
        resolvedSeatIds,
        customer?.khachHangId,
      );
    }

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
      rate: { bangCuocGuiHangId: number; mucCuoc: Prisma.Decimal | number };
      itemFee: number;
    }> = [];

    let diemGuiId: number | null = null;
    let diemNhanId: number | null = null;

    if (hasCargo) {
      const routePoints = await this.prisma.diemGiaoNhanTuyenXe.findMany({
        where: { tuyenXeId: trip.tuyenXeId },
        include: { diemGiaoNhanHang: true },
      });

      const senderPoint = routePoints.find(
        (p) => p.vaiTro === 'GUI_HANG' || p.vaiTro === 'CA_HAI',
      );
      const receiverPoint = routePoints.find(
        (p) => p.vaiTro === 'NHAN_HANG' || p.vaiTro === 'CA_HAI',
      );

      if (!senderPoint || !receiverPoint) {
        throw new ConflictException({
          error: 'SHIPMENT_POINTS_NOT_CONFIGURED',
          message: 'Tuyến xe chưa được cấu hình điểm gửi/nhận hàng.',
        });
      }

      diemGuiId = senderPoint.diemGiaoNhanHangId;
      diemNhanId = receiverPoint.diemGiaoNhanHangId;

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
          loaiHang = allLoaiHang[0];
        }

        if (!loaiHang) {
          throw new ConflictException({
            error: 'CARGO_TYPE_NOT_FOUND',
            message: `Không tìm thấy loại hàng phù hợp cho món: ${item.name}`,
          });
        }

        const totalWeight = effectiveUnitWeight * item.quantity;
        let matchedRate = activeRates.find(
          (r) =>
            r.loaiHangHoaId === loaiHang!.loaiHangHoaId &&
            Number(r.khoiLuongTu) <= totalWeight &&
            (r.khoiLuongDen === null || Number(r.khoiLuongDen) >= totalWeight),
        );

        if (!matchedRate) {
          matchedRate = activeRates.find((r) => r.loaiHangHoaId === loaiHang!.loaiHangHoaId) || activeRates[0];
        }

        if (!matchedRate) {
          throw new ConflictException({
            error: 'CARGO_RATE_NOT_FOUND',
            message: `Chưa có bảng cước cho loại hàng ${loaiHang.tenLoai}.`,
          });
        }

        let itemLuggageFee = 0;
        if (isMotorbike) {
          itemLuggageFee = 250000 * item.quantity;
        } else if (isBicycle) {
          itemLuggageFee = 100000 * item.quantity;
        } else {
          if (totalWeight > 40) {
            throw new BadRequestException({
              error: 'CARGO_WEIGHT_EXCEEDED',
              message: `Hành lý "${item.name}" có khối lượng (${totalWeight}kg) vượt quá hạn mức tối đa 40kg đi kèm vé. Quý khách vui lòng tạo đơn gửi hàng riêng tại mục Gửi hàng bưu kiện.`,
            });
          }

          if (totalWeight <= 20) {
            itemLuggageFee = 0;
          } else {
            itemLuggageFee = 30000;
          }
        }

        shippingFee += itemLuggageFee;
        mappedCargoItems.push({
          itemDto: item,
          loaiHangHoa: loaiHang,
          rate: matchedRate,
          itemFee: itemLuggageFee,
        });
      }
    }

    const totalOrderAmount = quote.finalTotal + shippingFee;

    // Contact/Passenger normalization
    const contactName = (dto.passenger?.fullName ?? dto.contact?.fullName ?? '').trim();
    const rawPhone = dto.passenger?.phoneNumber ?? dto.contact?.phone ?? '';
    const contactPhone = normalizePhone(rawPhone);
    const contactEmail = (dto.passenger?.email ?? dto.contact?.email ?? '')?.trim() || null;
    const pickupPoint = dto.pickup ?? dto.pickupPoint ?? trip.tuyenXe?.diemDi ?? null;
    const dropoffPoint = dto.dropoffPoint ?? (trip.tuyenXe?.diemDen ? `Bến xe ${trip.tuyenXe.diemDen}` : null);

    // All-or-nothing database transaction
    const txResult = await this.prisma.$transaction(async (tx) => {
      // 1. Consume hold if present
      let activeGiuChoId: number | null = null;
      if (dto.holdToken) {
        const holdResult = await this.seatHoldsService.consumeHoldInTx(
          tx,
          dto.holdToken,
          trip.chuyenXeId,
          resolvedSeatIds,
          customer?.khachHangId,
        );
        activeGiuChoId = holdResult?.giuChoId ?? null;
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
      let resolvedCustomerId: number;
      if (customer) {
        resolvedCustomerId = customer.khachHangId;
      } else if (taiKhoanId) {
        const cust = await tx.khachHang.findUnique({
          where: { taiKhoanId },
          select: { khachHangId: true },
        });
        if (cust) {
          resolvedCustomerId = cust.khachHangId;
        } else {
          const count = await tx.khachHang.count();
          const newCust = await tx.khachHang.create({
            data: {
              maKhachHang: `KH-${Date.now()}-${count + 1}`,
              taiKhoanId,
            },
          });
          resolvedCustomerId = newCust.khachHangId;
        }
      } else {
        const existingAccount = await tx.taiKhoan.findUnique({
          where: { soDienThoai: contactPhone },
          include: { khachHang: true },
        });

        if (existingAccount?.khachHang) {
          resolvedCustomerId = existingAccount.khachHang.khachHangId;
        } else if (existingAccount) {
          const count = await tx.khachHang.count();
          const newCust = await tx.khachHang.create({
            data: {
              maKhachHang: `KH-${Date.now()}-${count + 1}`,
              taiKhoanId: existingAccount.taiKhoanId,
            },
          });
          resolvedCustomerId = newCust.khachHangId;
        } else {
          const guestCount = await tx.taiKhoan.count();
          const guestAccount = await tx.taiKhoan.create({
            data: {
              hoTen: contactName || 'Khách hàng',
              soDienThoai: contactPhone,
              matKhau: '$2b$10$DUMMY_PASSWORD_FOR_GUEST_BOOKING',
              email: contactEmail,
              daXacThucSoDienThoai: false,
              trangThai: 'HOAT_DONG',
            },
          });
          const newCust = await tx.khachHang.create({
            data: {
              maKhachHang: `KH-${Date.now()}-${guestCount + 1}`,
              taiKhoanId: guestAccount.taiKhoanId,
            },
          });
          resolvedCustomerId = newCust.khachHangId;
        }
      }

      // 4. Generate transaction codes
      const now = new Date();
      const opCode = trip.tuyenXe?.nhaXe?.maNhaXe || (trip.xe as any)?.nhaXe?.maNhaXe || 'VXG';
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const stamp = `${day}${month}${year}${hour}${minute}`;
      let sequence = String(randomInt(1000, 9999));
      if (typeof tx.donGiaoDich?.count === 'function') {
        try {
          const totalTxCount = await tx.donGiaoDich.count();
          sequence = String(totalTxCount + 1).padStart(4, '0');
        } catch {
          // ignore error and use random sequence
        }
      }


      const maDonGiaoDich = `${opCode}-GD-${stamp}-${sequence}`;
      const maPhieuDatVe = `${opCode}-PDV-${stamp}-${sequence}`;

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

      // 8. Update seats to DA_DAT atomically
      if (activeGiuChoId) {
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
      } else {
        const updatedSeats = await tx.gheChuyenXe.updateMany({
          where: {
            chuyenXeId: trip.chuyenXeId,
            gheChuyenXeId: { in: resolvedSeatIds },
            trangThai: { in: ['TRONG', 'DANG_GIU'] },
          },
          data: {
            trangThai: 'DA_DAT',
            giuChoId: null,
          },
        });

        if (updatedSeats.count !== resolvedSeatIds.length) {
          throw new ConflictException({
            error: 'SEAT_UNAVAILABLE',
            message: 'Một hoặc nhiều ghế đã được đặt hoặc không còn khả dụng.',
          });
        }
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
            nguonThayDoi: customer?.taiKhoanId ? 'CUSTOMER' : 'HE_THONG',
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
              nguonThayDoi: customer?.taiKhoanId ? 'CUSTOMER' : 'HE_THONG',
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
        const maVanDon = `${opCode}-VD-${stamp}-${sequence}`;
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

        const detailsMap = new Map<number, { rateId: number; totalWeight: number; fee: number }>();
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
              khoiLuong: new Prisma.Decimal(m.itemDto.weight),
              moTa: itemDescription || null,
              phieuGuiHangId: phieuGui.phieuGuiHangId,
              loaiHangHoaId: m.loaiHangHoa.loaiHangHoaId,
            },
          });

          const current = detailsMap.get(m.loaiHangHoa.loaiHangHoaId);
          const itemWeight = m.itemDto.weight * m.itemDto.quantity;
          if (current) {
            current.totalWeight += itemWeight;
            current.fee += m.itemFee;
          } else {
            detailsMap.set(m.loaiHangHoa.loaiHangHoaId, {
              rateId: m.rate.bangCuocGuiHangId,
              totalWeight: itemWeight,
              fee: m.itemFee,
            });
          }
        }

        for (const [loaiHangHoaId, detail] of detailsMap.entries()) {
          await tx.chiTietCuocGuiHang.create({
            data: {
              phieuGuiHangId: phieuGui.phieuGuiHangId,
              loaiHangHoaId,
              bangCuocGuiHangId: detail.rateId,
              khoiLuongTinhCuoc: new Prisma.Decimal(detail.totalWeight),
              soTienCuoc: new Prisma.Decimal(detail.fee),
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

  async confirmBookingPayment(bookingId: number, paymentMethod: string = 'CHUYEN_KHOAN') {
    const booking = await this.prisma.phieuDatVe.findUnique({
      where: { phieuDatVeId: bookingId },
      include: {
        donGiaoDich: true,
        ves: true,
      },
    });

    if (!booking) {
      throw new NotFoundException({
        error: 'BOOKING_NOT_FOUND',
        message: 'Không tìm thấy phiếu đặt vé.',
      });
    }

    if (booking.trangThai === 'DA_THANH_TOAN') {
      return this.findPublicBookingById(bookingId);
    }

    const now = new Date();
    const amount = booking.donGiaoDich.tongTien;

    await this.prisma.$transaction(async (tx) => {
      // 1. Cập nhật DonGiaoDich
      await tx.donGiaoDich.update({
        where: { donGiaoDichId: booking.donGiaoDichId },
        data: {
          trangThai: 'DA_THANH_TOAN',
        },
      });

      // 2. Cập nhật PhieuDatVe
      await tx.phieuDatVe.update({
        where: { phieuDatVeId: booking.phieuDatVeId },
        data: {
          trangThai: 'DA_THANH_TOAN',
        },
      });

      // 3. Cập nhật Ve sang DA_XAC_NHAN / DA_DAT
      await tx.ve.updateMany({
        where: { phieuDatVeId: booking.phieuDatVeId },
        data: {
          trangThai: 'DA_XAC_NHAN',
        },
      });

      // 4. Cập nhật PhieuGuiHang nếu có
      await tx.phieuGuiHang.updateMany({
        where: { donGiaoDichId: booking.donGiaoDichId },
        data: {
          trangThai: 'DA_TIEP_NHAN',
        },
      });

      // 5. Tạo bản ghi ThanhToan
      await tx.thanhToan.create({
        data: {
          soTien: amount,
          phuongThuc: paymentMethod,
          loaiGiaoDich: 'THANH_TOAN',
          thoiGian: now,
          trangThai: 'THANH_CONG',
          donGiaoDichId: booking.donGiaoDichId,
        },
      });
    });

    return this.findPublicBookingById(bookingId);
  }

  async findPublicBookingById(bookingId: number) {
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

    return this.mapBooking(booking);
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

    const shipment = booking.donGiaoDich?.phieuGuiHang;
    const cargoItems = (shipment?.hangHoas ?? []).map((h: any) => ({
      name: h.tenHang,
      quantity: h.soLuong,
      weight: Number(h.khoiLuong),
      category: h.loaiHangHoa?.nhomSucChua ?? 'HANG_NHE',
      categoryName: h.loaiHangHoa?.tenLoai ?? 'Hàng nhẹ',
    }));

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
      totalAmount: Number(
        booking.tongTienBanDau ?? booking.donGiaoDich?.tongTien ?? 0,
      ),
      ticketSubtotal: Number(booking.tongTienBanDau ?? 0),
      cargoFee: Number(shipment?.tongPhi ?? 0),
      cargoItems,
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
