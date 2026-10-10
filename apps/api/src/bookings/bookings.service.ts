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
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { BookingQueryDto } from './dto/booking-query.dto.js';
import type { CargoItemDto, CreateBookingDto } from './dto/create-booking.dto.js';

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

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('84') && digits.length >= 11) {
    return '0' + digits.slice(2);
  }
  return digits;
}

@Injectable()
export class BookingsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async createBooking(dto: CreateBookingDto, taiKhoanId?: number) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: dto.tripId },
      include: {
        tuyenXe: { include: { nhaXe: true } },
        xe: { include: { loaiXe: true } },
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
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }

    const departureAt = combineDeparture(
      trip.ngayKhoiHanh,
      trip.gioKhoiHanh,
      this.businessTimeZone,
    );
    if (departureAt <= new Date()) {
      throw new ConflictException({
        error: 'TRIP_ALREADY_DEPARTED',
        message: 'Chuyến xe này đã khởi hành.',
      });
    }

    const bangGia = await this.prisma.bangGia.findFirst({
      where: {
        trangThai: 'HOAT_DONG',
        nhaXeId: trip.nhaXeId,
        tuyenXeId: trip.tuyenXeId,
        loaiXeId: trip.xe.loaiXeId,
        tuNgay: { lte: trip.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: trip.ngayKhoiHanh } }],
      },
    });

    if (!bangGia) {
      throw new ConflictException({
        error: 'FARE_NOT_FOUND',
        message: 'Chưa có cấu hình giá vé áp dụng cho chuyến xe này.',
      });
    }

    const unitPrice = Number(bangGia.giaNiemYet);
    const uniqueSeatNumbers = Array.from(new Set(dto.seatNumbers));
    const ticketCount = uniqueSeatNumbers.length;
    const ticketSubtotal = unitPrice * ticketCount;

    // Optional cargo handling
    const hasCargo = Array.isArray(dto.cargoItems) && dto.cargoItems.length > 0;
    if (hasCargo && !trip.nhanGuiHang) {
      throw new ConflictException({
        error: 'TRIP_DOES_NOT_ACCEPT_CARGO',
        message: 'Chuyến xe này không nhận chở hàng hóa/xe máy.',
      });
    }

    // Prepare cargo rate lookup if cargo exists
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
      // Find endpoints for shipment on this route
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
          // Cước xe máy theo chuyến: 250.000đ/xe
          itemLuggageFee = 250000 * item.quantity;
        } else if (isBicycle) {
          // Cước xe đạp theo chuyến: 100.000đ/xe
          itemLuggageFee = 100000 * item.quantity;
        } else {
          // Chính sách phụ phí hành lý theo vé:
          // <= 20kg: Miễn phí | 20-40kg: 30.000đ | > 40kg: Không nhận kèm vé (yêu cầu gửi hàng riêng)
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

    const totalOrderAmount = ticketSubtotal + shippingFee;

    // Transaction execution (All-or-Nothing)
    return this.prisma.$transaction(async (tx) => {
      // 1. Claim seats
      const seats = await tx.gheChuyenXe.findMany({
        where: {
          chuyenXeId: dto.tripId,
          ghe: { soGhe: { in: uniqueSeatNumbers } },
        },
        include: { ghe: true },
      });

      if (seats.length !== uniqueSeatNumbers.length) {
        throw new NotFoundException({
          error: 'SEAT_NOT_FOUND',
          message: 'Một hoặc nhiều ghế được chọn không tồn tại trên chuyến này.',
        });
      }

      const unavailableSeats = seats.filter(
        (s) => s.trangThai !== 'TRONG' && s.trangThai !== 'DANG_GIU',
      );
      if (unavailableSeats.length > 0) {
        throw new ConflictException({
          error: 'SEAT_UNAVAILABLE',
          message: `Ghế ${unavailableSeats.map((s) => s.ghe.soGhe).join(', ')} đã có người đặt.`,
        });
      }

      // 2. Validate cargo capacity if cargo present
      if (hasCargo) {
        const activeShipments = await tx.hangHoa.findMany({
          where: {
            phieuGuiHang: {
              chuyenXeId: dto.tripId,
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

      // 3. Resolve Customer record
      let customerId: number;
      if (taiKhoanId) {
        const cust = await tx.khachHang.findUnique({
          where: { taiKhoanId },
          select: { khachHangId: true },
        });
        if (cust) {
          customerId = cust.khachHangId;
        } else {
          const count = await tx.khachHang.count();
          const newCust = await tx.khachHang.create({
            data: {
              maKhachHang: `KH-${Date.now()}-${count + 1}`,
              taiKhoanId,
            },
          });
          customerId = newCust.khachHangId;
        }
      } else {
        // Public/guest booking: check by phone
        const normalizedPhone = normalizePhone(dto.passenger.phoneNumber);
        const existingAccount = await tx.taiKhoan.findUnique({
          where: { soDienThoai: normalizedPhone },
          include: { khachHang: true },
        });

        if (existingAccount?.khachHang) {
          customerId = existingAccount.khachHang.khachHangId;
        } else if (existingAccount) {
          const count = await tx.khachHang.count();
          const newCust = await tx.khachHang.create({
            data: {
              maKhachHang: `KH-${Date.now()}-${count + 1}`,
              taiKhoanId: existingAccount.taiKhoanId,
            },
          });
          customerId = newCust.khachHangId;
        } else {
          // Create guest account + profile
          const guestCount = await tx.taiKhoan.count();
          const guestAccount = await tx.taiKhoan.create({
            data: {
              hoTen: dto.passenger.fullName.trim(),
              soDienThoai: normalizedPhone,
              matKhau: '$2b$10$DUMMY_PASSWORD_FOR_GUEST_BOOKING',
              email: dto.passenger.email.trim(),
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
          customerId = newCust.khachHangId;
        }
      }

      // 4. Generate transaction codes
      const now = new Date();
      const opCode = trip.tuyenXe.nhaXe.maNhaXe;
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const hour = String(now.getHours()).padStart(2, '0');
      const minute = String(now.getMinutes()).padStart(2, '0');
      const stamp = `${day}${month}${year}${hour}${minute}`;
      const totalTxCount = await tx.donGiaoDich.count();
      const sequence = String(totalTxCount + 1).padStart(4, '0');

      const maDonGiaoDich = `${opCode}-GD-${stamp}-${sequence}`;
      const maPhieuDatVe = `${opCode}-PDV-${stamp}-${sequence}`;

      // 5. Create DonGiaoDich
      const donGiaoDich = await tx.donGiaoDich.create({
        data: {
          maDonGiaoDich,
          ngayTao: now,
          tongTien: new Prisma.Decimal(totalOrderAmount),
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: dto.passenger.fullName.trim(),
          soDienThoaiKhachHang: dto.passenger.phoneNumber.trim(),
          emailKhachHang: dto.passenger.email.trim(),
          khachHangId: customerId,
          nhaXeId: trip.nhaXeId,
        },
      });

      // 6. Create PhieuDatVe
      const phieuDatVe = await tx.phieuDatVe.create({
        data: {
          maPhieuDatVe,
          ngayDat: now,
          soLuongVeBanDau: ticketCount,
          tongTienBanDau: new Prisma.Decimal(ticketSubtotal),
          trangThai: 'CHO_THANH_TOAN',
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
      });

      // 7. Create Ve records and mark seats DA_DAT
      const createdTickets: Array<{
        veId: number;
        maVe: string;
        soGhe: string;
        gia: number;
      }> = [];

      for (let i = 0; i < seats.length; i++) {
        const seat = seats[i];
        const ticketSeq = String(i + 1).padStart(2, '0');
        const maVe = `${maPhieuDatVe}-VE-${ticketSeq}`;

        const createdVe = await tx.ve.create({
          data: {
            maVe,
            diemDon: dto.pickup || trip.tuyenXe.diemDi,
            giaNiemYet: new Prisma.Decimal(unitPrice),
            giaThucTe: new Prisma.Decimal(unitPrice),
            trangThai: 'DA_DAT',
            phieuDatVeId: phieuDatVe.phieuDatVeId,
            gheChuyenXeId: seat.gheChuyenXeId,
            bangGiaApDungId: bangGia.bangGiaId,
          },
        });

        await tx.gheChuyenXe.update({
          where: { gheChuyenXeId: seat.gheChuyenXeId },
          data: { trangThai: 'DA_DAT' },
        });

        createdTickets.push({
          veId: createdVe.veId,
          maVe,
          soGhe: seat.ghe.soGhe,
          gia: unitPrice,
        });
      }

      // 8. Create PhieuGuiHang and cargo items if requested
      let createdShipment: any = null;
      if (hasCargo && diemGuiId && diemNhanId) {
        const maVanDon = `${opCode}-VD-${stamp}-${sequence}`;
        const phieuGui = await tx.phieuGuiHang.create({
          data: {
            maVanDon,
            tenNguoiNhan: dto.passenger.fullName.trim(),
            soDienThoaiNguoiNhan: dto.passenger.phoneNumber.trim(),
            ngayGui: now,
            cuocChinh: new Prisma.Decimal(shippingFee),
            phiDichVu: new Prisma.Decimal(0),
            soTienGiam: new Prisma.Decimal(0),
            tongPhi: new Prisma.Decimal(shippingFee),
            nguoiTraCuoc: 'NGUOI_GUI',
            ghiChu: 'Hành lý/hàng gửi kèm vé cùng chuyến',
            trangThai: 'MOI_TAO',
            chuyenXeId: dto.tripId,
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

        // Group rates per cargo type for ChiTietCuocGuiHang
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
        bookingId: phieuDatVe.phieuDatVeId,
        bookingCode: maPhieuDatVe,
        orderId: donGiaoDich.donGiaoDichId,
        orderCode: maDonGiaoDich,
        tripId: dto.tripId,
        ticketCount,
        tickets: createdTickets,
        ticketSubtotal,
        shippingFee,
        totalAmount: totalOrderAmount,
        status: phieuDatVe.trangThai,
        shipment: createdShipment,
      };
    });
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
