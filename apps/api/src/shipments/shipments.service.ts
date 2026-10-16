import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Prisma, TrangThaiPhieuGuiHang } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { lockPaymentOrder } from '../payments/payment-order-lock.js';
import { createSepayPaymentAttempt } from '../payments/payment-attempt.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import { CargoPricingService } from '../cargo-pricing/cargo-pricing.service.js';
import { CargoCapacityService } from '../cargo-capacity/cargo-capacity.service.js';
import type { CargoCapacityGroup } from '../cargo-capacity/cargo-capacity.service.js';
import {
  assertPrincipalScope,
  hasTenantRole,
} from '../auth/principal-scope.js';
import {
  businessDateStartUtc,
  computeArrival,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { getBookingPaymentDeadline } from '../common/booking-payment-deadline.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import type { CreateShipmentDto } from './dto/create-shipment.dto.js';
import type { LookupShipmentDto } from './dto/lookup-shipment.dto.js';
import type { ShipmentQueryDto } from './dto/shipment-query.dto.js';
import type { UpdateShipmentStatusDto } from './dto/update-shipment-status.dto.js';
import type {
  CargoFeeDetail,
  CargoItemDetail,
  ShipmentDetail as AdminShipmentDetail,
  ShipmentHistoryItem,
  ShipmentSummary,
} from './dto/shipment-response.dto.js';
import { ShipmentPersistenceService } from './shipment-persistence.service.js';
import { generateStandaloneShipmentCodes } from './shipment-codes.js';

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

function formatTripDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatTripTime(time: Date): string {
  return time.toISOString().slice(11, 19);
}

function toVnd(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return Math.round(Number(value));
}

const SHIPMENT_LIST_INCLUDE = {
  donGiaoDich: true,
  diemGui: true,
  diemNhan: true,
  chuyenXe: {
    include: {
      tuyenXe: { include: { nhaXe: true } },
      xe: true,
    },
  },
  hangHoas: {
    include: { loaiHangHoa: true },
    orderBy: { hangHoaId: 'asc' },
  },
} satisfies Prisma.PhieuGuiHangInclude;

const SHIPMENT_DETAIL_INCLUDE = {
  donGiaoDich: true,
  diemGui: true,
  diemNhan: true,
  chuyenXe: {
    include: {
      tuyenXe: { include: { nhaXe: true } },
      xe: true,
    },
  },
  hangHoas: {
    include: { loaiHangHoa: true },
    orderBy: { hangHoaId: 'asc' },
  },
  chiTietCuocGuiHangs: {
    include: { loaiHangHoa: true },
    orderBy: { chiTietCuocGuiHangId: 'asc' },
  },
  lichSuTrangThais: {
    include: {
      taiKhoan: { select: { taiKhoanId: true, hoTen: true } },
    },
    orderBy: [{ thoiGian: 'asc' }, { lichSuTrangThaiId: 'asc' }],
  },
} satisfies Prisma.PhieuGuiHangInclude;

@Injectable()
export class ShipmentsService {
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
    private readonly cargoPricingService: CargoPricingService,
    private readonly cargoCapacityService: CargoCapacityService,
    private readonly shipmentPersistenceService: ShipmentPersistenceService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  async getRoutePoints(tripId: number) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
      select: {
        chuyenXeId: true,
        tuyenXeId: true,
        nhaXeId: true,
        nhanGuiHang: true,
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe tiếp nhận hàng.',
      });
    }

    if (!trip.nhanGuiHang) {
      throw new ConflictException({
        error: 'TRIP_DOES_NOT_ACCEPT_CARGO',
        message: 'Chuyến xe này không hỗ trợ nhận gửi hàng.',
      });
    }

    const routePoints = await this.prisma.diemGiaoNhanTuyenXe.findMany({
      where: {
        tuyenXeId: trip.tuyenXeId,
        diemGiaoNhanHang: {
          nhaXeId: trip.nhaXeId,
          trangThai: 'HOAT_DONG',
        },
      },
      include: { diemGiaoNhanHang: true },
      orderBy: { diemGiaoNhanHangId: 'asc' },
    });
    const toOption = (point: (typeof routePoints)[number]) => ({
      id: point.diemGiaoNhanHangId,
      name: point.diemGiaoNhanHang.tenDiem,
      address: point.diemGiaoNhanHang.diaChi,
    });

    return {
      tripId: trip.chuyenXeId,
      senderPoints: routePoints
        .filter(
          (point) =>
            point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
            point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId &&
            (point.vaiTro === 'GUI_HANG' || point.vaiTro === 'CA_HAI'),
        )
        .map(toOption),
      receiverPoints: routePoints
        .filter(
          (point) =>
            point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
            point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId &&
            (point.vaiTro === 'NHAN_HANG' || point.vaiTro === 'CA_HAI'),
        )
        .map(toOption),
    };
  }

  async createShipment(dto: CreateShipmentDto, taiKhoanId?: number) {
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException({
        error: 'EMPTY_CARGO_ITEMS',
        message: 'Vui lòng nhập ít nhất một kiện hàng cần gửi.',
      });
    }

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
        message: 'Không tìm thấy chuyến xe tiếp nhận hàng.',
      });
    }

    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở tiếp nhận gửi hàng.',
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

    if (!trip.nhanGuiHang) {
      throw new ConflictException({
        error: 'TRIP_DOES_NOT_ACCEPT_CARGO',
        message: 'Chuyến xe này không hỗ trợ nhận gửi hàng.',
      });
    }

    const senderPhone = normalizePhone(dto.sender.phoneNumber);
    const receiverPhone = normalizePhone(dto.receiver.phoneNumber);

    return this.prisma.$transaction(async (tx) => {
      await this.cargoCapacityService.lockTrip(tx, trip.chuyenXeId);

      const pricing = await this.cargoPricingService.calculate(
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
          isFragile: dto.isFragile,
          isValuable: dto.isValuable,
          items: dto.items.map((item) => ({
            name: item.name,
            quantity: item.quantity,
            weight: item.weight,
            categoryName: item.category,
            loaiHangHoaId: item.loaiHangHoaId,
            length: item.length,
            width: item.width,
            height: item.height,
          })),
        },
      );
      const diemGuiId = pricing.senderPointId;
      const diemNhanId = pricing.receiverPointId;
      const cuocChinh = pricing.baseFee;
      const phiDichVu = pricing.serviceFee;
      const tongPhi = pricing.totalFee;

      const capacitySnapshot = await this.cargoCapacityService.getSnapshot(
        tx,
        trip.chuyenXeId,
      );
      if (!capacitySnapshot) {
        throw new NotFoundException({
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        });
      }
      this.cargoCapacityService.assertAvailable(
        capacitySnapshot,
        pricing.items.map((item) => ({
          group: item.loaiHangHoa.nhomSucChua as CargoCapacityGroup,
          quantity: item.input.quantity,
        })),
      );

      // Chỉ danh tính đăng nhập đã xác thực mới được gắn với hồ sơ Customer.
      // Guest contact phone là dữ liệu liên hệ, không chứng minh quyền sở hữu tài khoản.
      let customerId: number | null = null;
      if (taiKhoanId) {
        const cust = await tx.khachHang.findUnique({
          where: { taiKhoanId },
          select: { khachHangId: true },
        });
        if (cust) {
          customerId = cust.khachHangId;
        } else {
          const newCust = await tx.khachHang.create({
            data: {
              maKhachHang: `KH-${randomUUID().replaceAll('-', '').toUpperCase()}`,
              taiKhoanId,
            },
          });
          customerId = newCust.khachHangId;
        }
      }

      // 1. Generate collision-resistant transaction and waybill codes.
      const now = new Date();
      const { orderCode: maDonGiaoDich, waybillCode: maVanDon } =
        generateStandaloneShipmentCodes(trip.tuyenXe.nhaXe.maNhaXe, now);

      // 3. Create DonGiaoDich
      const donGiaoDich = await tx.donGiaoDich.create({
        data: {
          maDonGiaoDich,
          ngayTao: now,
          tongTien: tongPhi,
          trangThai: 'CHO_THANH_TOAN',
          tenKhachHang: dto.sender.fullName.trim(),
          soDienThoaiKhachHang: senderPhone,
          emailKhachHang: dto.sender.email?.trim() || null,
          khachHangId: customerId,
          nhaXeId: trip.nhaXeId,
        },
      });
      const paymentAttempt = await createSepayPaymentAttempt(tx, {
        donGiaoDichId: donGiaoDich.donGiaoDichId,
        amount: tongPhi,
        createdAt: now,
      });

      const { shipment: phieuGui, items: createdItems } =
        await this.shipmentPersistenceService.persistInTransaction(tx, {
          waybillCode: maVanDon,
          recipientName: dto.receiver.fullName.trim(),
          recipientPhone: receiverPhone,
          sentAt: now,
          baseFee: cuocChinh,
          serviceFee: phiDichVu,
          discount: 0,
          totalFee: tongPhi,
          note: dto.note?.trim() || null,
          tripId: trip.chuyenXeId,
          senderPointId: diemGuiId,
          receiverPointId: diemNhanId,
          orderId: donGiaoDich.donGiaoDichId,
          actorAccountId: taiKhoanId ?? null,
          historyNote: 'Tạo phiếu gửi hàng độc lập',
          items: pricing.items.map((resolvedItem, index) => {
            const item = dto.items[index];
            return {
              name: item.name.trim(),
              quantity: item.quantity,
              unitWeight: resolvedItem.effectiveUnitWeight,
              length: item.length || null,
              width: item.width || null,
              height: item.height || null,
              description: item.note?.trim() || null,
              cargoTypeId: resolvedItem.loaiHangHoa.loaiHangHoaId,
            };
          }),
          rates: pricing.rates.map((rate) => ({
            cargoTypeId: rate.loaiHangHoaId,
            rateId: rate.bangCuocGuiHangId,
            billableWeight: rate.totalWeight,
            fee: rate.fee,
          })),
        });

      return {
        shipmentId: phieuGui.phieuGuiHangId,
        orderId: donGiaoDich.donGiaoDichId,
        paymentId: paymentAttempt.thanhToanId,
        paymentExpiresAt: getBookingPaymentDeadline(donGiaoDich.ngayTao).toISOString(),
        waybillCode: phieuGui.maVanDon,
        orderCode: donGiaoDich.maDonGiaoDich,
        status: phieuGui.trangThai,
        paymentStatus: donGiaoDich.trangThai,
        sentAt: phieuGui.ngayGui.toISOString(),
        pricing: {
          baseFee: cuocChinh.toNumber(),
          serviceFee: phiDichVu.toNumber(),
          discount: 0,
          totalFee: tongPhi.toNumber(),
        },
        sender: {
          fullName: dto.sender.fullName,
          phoneNumber: senderPhone,
          email: dto.sender.email || null,
        },
        receiver: {
          fullName: dto.receiver.fullName,
          phoneNumber: receiverPhone,
        },
        pickupPoint: {
          id: phieuGui.diemGui.diemGiaoNhanHangId,
          name: phieuGui.diemGui.tenDiem,
          address: phieuGui.diemGui.diaChi,
        },
        dropoffPoint: {
          id: phieuGui.diemNhan.diemGiaoNhanHangId,
          name: phieuGui.diemNhan.tenDiem,
          address: phieuGui.diemNhan.diaChi,
        },
        trip: {
          tripId: trip.chuyenXeId,
          code: trip.maChuyenXe,
          departureTime: departureAt.toISOString(),
          route: {
            origin: trip.tuyenXe.diemDi,
            destination: trip.tuyenXe.diemDen,
          },
          busCompany: {
            id: trip.tuyenXe.nhaXe.nhaXeId,
            name: trip.tuyenXe.nhaXe.tenNhaXe,
          },
          vehicle: {
            licensePlate: trip.xe.bienSoXe,
          },
        },
        items: createdItems.map((itm) => ({
          id: itm.hangHoaId,
          name: itm.tenHang,
          quantity: itm.soLuong,
          weight: Number(itm.khoiLuong),
          category: itm.loaiHangHoa.tenLoai,
          dimensions:
            itm.chieuDai && itm.chieuRong && itm.chieuCao
              ? `${Number(itm.chieuDai)}x${Number(itm.chieuRong)}x${Number(itm.chieuCao)}cm`
              : null,
          note: itm.moTa,
        })),
        note: phieuGui.ghiChu,
      };
    });
  }

  async lookupShipment(dto: LookupShipmentDto) {
    const waybillCode = dto.waybillCode.trim().toUpperCase();
    const phone = normalizePhone(dto.phoneNumber);

    const shipment = await this.prisma.phieuGuiHang.findFirst({
      where: {
        OR: [
          { maVanDon: waybillCode },
          { donGiaoDich: { maDonGiaoDich: waybillCode } },
        ],
      },
      select: {
        maVanDon: true,
        trangThai: true,
        soDienThoaiNguoiNhan: true,
        donGiaoDich: {
          select: {
            donGiaoDichId: true,
            maDonGiaoDich: true,
            soDienThoaiKhachHang: true,
            ngayTao: true,
            tongTien: true,
            trangThai: true,
            thanhToans: {
              where: { loaiGiaoDich: 'THANH_TOAN' },
              orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
              take: 1,
              select: { phuongThuc: true, trangThai: true },
            },
          },
        },
        diemGui: { select: { tenDiem: true, diaChi: true } },
        diemNhan: { select: { tenDiem: true, diaChi: true } },
        chuyenXe: {
          select: {
            ngayKhoiHanh: true,
            gioKhoiHanh: true,
            gioDen: true,
            tuyenXe: {
              select: {
                diemDi: true,
                diemDen: true,
                thoiGianChayPhut: true,
                nhaXe: { select: { tenNhaXe: true } },
              },
            },
          },
        },
        hangHoas: { select: { soLuong: true } },
        lichSuTrangThais: {
          select: { trangThai: true, thoiGian: true },
          orderBy: { thoiGian: 'asc' },
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng khớp với mã vận đơn đã cung cấp.',
      });
    }

    const senderPhoneMatch =
      normalizePhone(shipment.donGiaoDich.soDienThoaiKhachHang) === phone;
    const receiverPhoneMatch =
      normalizePhone(shipment.soDienThoaiNguoiNhan) === phone;

    if (!senderPhoneMatch && !receiverPhoneMatch) {
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message:
          'Số điện thoại không khớp với người gửi hoặc người nhận của mã vận đơn này.',
      });
    }

    const departureAt = combineDeparture(
      shipment.chuyenXe.ngayKhoiHanh,
      shipment.chuyenXe.gioKhoiHanh,
      this.businessTimeZone,
    );
    const estimatedArrivalAt = computeArrival(
      shipment.chuyenXe.ngayKhoiHanh,
      shipment.chuyenXe.gioKhoiHanh,
      shipment.chuyenXe.tuyenXe.thoiGianChayPhut,
      shipment.chuyenXe.gioDen,
      this.businessTimeZone,
    );
    const latestPayment = shipment.donGiaoDich.thanhToans[0] ?? null;
    const paymentExpiresAt = getBookingPaymentDeadline(
      shipment.donGiaoDich.ngayTao,
    );
    const paymentExpired =
      shipment.donGiaoDich.trangThai === 'CHO_THANH_TOAN' &&
      latestPayment?.trangThai === 'DANG_XU_LY' &&
      paymentExpiresAt <= new Date();

    return {
      waybillCode: shipment.maVanDon,
      status: shipment.trangThai,
      orderCode: shipment.donGiaoDich.maDonGiaoDich,
      amount: Number(shipment.donGiaoDich.tongTien),
      orderStatus: shipment.donGiaoDich.trangThai,
      paymentStatus: paymentExpired
        ? 'HET_HAN'
        : (latestPayment?.trangThai ?? null),
      requiresReconciliation:
        latestPayment?.trangThai === 'THANH_CONG' &&
        (['DA_HUY', 'HUY'].includes(shipment.donGiaoDich.trangThai) ||
          shipment.trangThai === 'DA_HUY'),
      paymentMethod: latestPayment?.phuongThuc ?? null,
      paymentExpiresAt: paymentExpiresAt.toISOString(),
      serverTime: new Date().toISOString(),
      pickupPoint: {
        name: shipment.diemGui.tenDiem,
        address: shipment.diemGui.diaChi,
      },
      dropoffPoint: {
        name: shipment.diemNhan.tenDiem,
        address: shipment.diemNhan.diaChi,
      },
      carrier: { name: shipment.chuyenXe.tuyenXe.nhaXe.tenNhaXe },
      route: {
        origin: shipment.chuyenXe.tuyenXe.diemDi,
        destination: shipment.chuyenXe.tuyenXe.diemDen,
      },
      scheduledDepartureAt: departureAt.toISOString(),
      estimatedArrivalAt,
      packageCount: shipment.hangHoas.reduce(
        (total, item) => total + item.soLuong,
        0,
      ),
      timeline: shipment.lichSuTrangThais.map((log) => ({
        status: log.trangThai,
        time: log.thoiGian.toISOString(),
      })),
    };
  }

  async getShipmentDetail(id: number, principal?: AuthPrincipal) {
    this.assertShipmentPrincipal(principal);
    const shipment = await this.findShipmentDetailRecord(id);

    if (!shipment) {
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    }

    await this.assertShipmentOwnership(principal, shipment);

    const departureAt = combineDeparture(
      shipment.chuyenXe.ngayKhoiHanh,
      shipment.chuyenXe.gioKhoiHanh,
      this.businessTimeZone,
    );

    return {
      shipmentId: shipment.phieuGuiHangId,
      orderId: shipment.donGiaoDich.donGiaoDichId,
      waybillCode: shipment.maVanDon,
      orderCode: shipment.donGiaoDich.maDonGiaoDich,
      status: shipment.trangThai,
      paymentStatus: shipment.donGiaoDich.trangThai,
      sentAt: shipment.ngayGui.toISOString(),
      pricing: {
        baseFee: Number(shipment.cuocChinh),
        serviceFee: Number(shipment.phiDichVu),
        discount: Number(shipment.soTienGiam),
        totalFee: Number(shipment.tongPhi),
      },
      sender: {
        fullName: shipment.donGiaoDich.tenKhachHang,
        phoneNumber: shipment.donGiaoDich.soDienThoaiKhachHang,
        email: shipment.donGiaoDich.emailKhachHang,
      },
      receiver: {
        fullName: shipment.tenNguoiNhan,
        phoneNumber: shipment.soDienThoaiNguoiNhan,
      },
      pickupPoint: {
        id: shipment.diemGui.diemGiaoNhanHangId,
        name: shipment.diemGui.tenDiem,
        address: shipment.diemGui.diaChi,
      },
      dropoffPoint: {
        id: shipment.diemNhan.diemGiaoNhanHangId,
        name: shipment.diemNhan.tenDiem,
        address: shipment.diemNhan.diaChi,
      },
      trip: {
        tripId: shipment.chuyenXe.chuyenXeId,
        code: shipment.chuyenXe.maChuyenXe,
        departureTime: departureAt.toISOString(),
        route: {
          origin: shipment.chuyenXe.tuyenXe.diemDi,
          destination: shipment.chuyenXe.tuyenXe.diemDen,
        },
        busCompany: {
          id: shipment.chuyenXe.tuyenXe.nhaXe.nhaXeId,
          name: shipment.chuyenXe.tuyenXe.nhaXe.tenNhaXe,
        },
        vehicle: {
          licensePlate: shipment.chuyenXe.xe.bienSoXe,
        },
      },
      items: shipment.hangHoas.map((itm) => ({
        id: itm.hangHoaId,
        name: itm.tenHang,
        quantity: itm.soLuong,
        weight: Number(itm.khoiLuong),
        category: itm.loaiHangHoa.tenLoai,
        dimensions:
          itm.chieuDai && itm.chieuRong && itm.chieuCao
            ? `${Number(itm.chieuDai)}x${Number(itm.chieuRong)}x${Number(itm.chieuCao)}cm`
            : null,
        note: itm.moTa,
      })),
      timeline: shipment.lichSuTrangThais.map((log) => ({
        id: log.lichSuTrangThaiId,
        status: log.trangThai,
        time: log.thoiGian.toISOString(),
        note: log.ghiChu,
      })),
      note: shipment.ghiChu,
    };
  }

  async findAll(query: ShipmentQueryDto, principal: AuthPrincipal): Promise<{
    data: ShipmentSummary[];
    meta: {
      page: number;
      pageSize: number;
      totalItems: number;
      totalPages: number;
    };
  }> {
    requireTenantPrincipal(principal);
    const page = await this.queryShipmentPage(query, principal);
    return {
      data: page.records.map((record) => ({
        shipmentId: record.phieuGuiHangId,
        waybillCode: record.maVanDon,
        sentAt: record.ngayGui.toISOString(),
        status: record.trangThai,
        sender: {
          fullName: record.donGiaoDich.tenKhachHang,
          phoneNumber: record.donGiaoDich.soDienThoaiKhachHang,
        },
        receiver: {
          fullName: record.tenNguoiNhan,
          phoneNumber: record.soDienThoaiNguoiNhan,
        },
        trip: {
          tripId: record.chuyenXe.chuyenXeId,
          code: record.chuyenXe.maChuyenXe,
          departureDate: formatTripDate(record.chuyenXe.ngayKhoiHanh),
          departureTime: formatTripTime(record.chuyenXe.gioKhoiHanh),
        },
        originPoint: {
          pointId: record.diemGui.diemGiaoNhanHangId,
          name: record.diemGui.tenDiem,
          code: record.diemGui.maDiem,
          address: record.diemGui.diaChi,
        },
        destinationPoint: {
          pointId: record.diemNhan.diemGiaoNhanHangId,
          name: record.diemNhan.tenDiem,
          code: record.diemNhan.maDiem,
          address: record.diemNhan.diaChi,
        },
        totalFee: toVnd(record.tongPhi),
      })),
      meta: page.meta,
    };
  }

  async listShipments(query: ShipmentQueryDto, principal?: AuthPrincipal) {
    this.assertShipmentPrincipal(principal);
    const page = await this.queryShipmentPage(query, principal);

    return {
      data: page.records.map((shipment) => ({
        shipmentId: shipment.phieuGuiHangId,
        waybillCode: shipment.maVanDon,
        orderCode: shipment.donGiaoDich.maDonGiaoDich,
        sentAt: shipment.ngayGui.toISOString(),
        status: shipment.trangThai,
        paymentStatus: shipment.donGiaoDich.trangThai,
        totalFee: toVnd(shipment.tongPhi),
        sender: {
          fullName: shipment.donGiaoDich.tenKhachHang,
          phoneNumber: shipment.donGiaoDich.soDienThoaiKhachHang,
        },
        receiver: {
          fullName: shipment.tenNguoiNhan,
          phoneNumber: shipment.soDienThoaiNguoiNhan,
        },
        trip: {
          tripId: shipment.chuyenXe.chuyenXeId,
          code: shipment.chuyenXe.maChuyenXe,
          route: `${shipment.chuyenXe.tuyenXe.diemDi} → ${shipment.chuyenXe.tuyenXe.diemDen}`,
          busCompany: shipment.chuyenXe.tuyenXe.nhaXe.tenNhaXe,
        },
        itemsCount: shipment.hangHoas.length,
      })),
      meta: page.meta,
    };
  }

  async findOne(
    id: number,
    principal: AuthPrincipal,
  ): Promise<{ data: AdminShipmentDetail }> {
    const tenantId = requireTenantPrincipal(principal);
    const record = await this.findShipmentDetailRecord(id);
    if (!record || !this.isShipmentInTenant(record, tenantId)) {
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    }

    const data: AdminShipmentDetail = {
      shipmentId: record.phieuGuiHangId,
      waybillCode: record.maVanDon,
      sentAt: record.ngayGui.toISOString(),
      status: record.trangThai,
      paymentStatus: record.donGiaoDich.trangThai,
      note: record.ghiChu ?? null,
      sender: {
        fullName: record.donGiaoDich.tenKhachHang,
        phoneNumber: record.donGiaoDich.soDienThoaiKhachHang,
      },
      receiver: {
        fullName: record.tenNguoiNhan,
        phoneNumber: record.soDienThoaiNguoiNhan,
      },
      trip: {
        tripId: record.chuyenXe.chuyenXeId,
        code: record.chuyenXe.maChuyenXe,
        departureDate: formatTripDate(record.chuyenXe.ngayKhoiHanh),
        departureTime: formatTripTime(record.chuyenXe.gioKhoiHanh),
      },
      originPoint: {
        pointId: record.diemGui.diemGiaoNhanHangId,
        name: record.diemGui.tenDiem,
        code: record.diemGui.maDiem,
        address: record.diemGui.diaChi,
      },
      destinationPoint: {
        pointId: record.diemNhan.diemGiaoNhanHangId,
        name: record.diemNhan.tenDiem,
        code: record.diemNhan.maDiem,
        address: record.diemNhan.diaChi,
      },
      cargoItems: record.hangHoas.map((item): CargoItemDetail => ({
        cargoId: item.hangHoaId,
        name: item.tenHang,
        typeName: item.loaiHangHoa.tenLoai,
        weightKg: Number(item.khoiLuong),
        quantity: item.soLuong,
        dimensions:
          item.chieuDai != null && item.chieuRong != null && item.chieuCao != null
            ? {
                length: Number(item.chieuDai),
                width: Number(item.chieuRong),
                height: Number(item.chieuCao),
              }
            : null,
        declaredValue:
          item.giaTriKhaiBao != null ? toVnd(item.giaTriKhaiBao) : null,
        description: item.moTa ?? null,
      })),
      cargoFeeDetails: record.chiTietCuocGuiHangs.map(
        (detail): CargoFeeDetail => ({
          feeDetailId: detail.chiTietCuocGuiHangId,
          cargoTypeName: detail.loaiHangHoa.tenLoai,
          chargeableWeightKg: Number(detail.khoiLuongTinhCuoc),
          fee: toVnd(detail.soTienCuoc),
        }),
      ),
      feeSummary: {
        mainFee: toVnd(record.cuocChinh),
        serviceFee: toVnd(record.phiDichVu),
        discountAmount: toVnd(record.soTienGiam),
        totalFee: toVnd(record.tongPhi),
        freightPayer: record.nguoiTraCuoc,
      },
      history: record.lichSuTrangThais.map(
        (history): ShipmentHistoryItem => ({
          historyId: history.lichSuTrangThaiId,
          status: history.trangThai,
          time: history.thoiGian.toISOString(),
          note: history.ghiChu ?? null,
          actor: history.taiKhoan
            ? {
                accountId: history.taiKhoan.taiKhoanId,
                fullName: history.taiKhoan.hoTen,
              }
            : null,
        }),
      ),
      totalFee: toVnd(record.tongPhi),
    };

    return { data };
  }

  private async queryShipmentPage(
    query: ShipmentQueryDto,
    principal: AuthPrincipal,
  ) {
    this.assertShipmentPrincipal(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDirection: Prisma.SortOrder =
      query.sortDirection === 'asc' ? 'asc' : 'desc';
    const conditions: Prisma.PhieuGuiHangWhereInput[] = [];

    if (hasTenantRole(principal.roles)) {
      const tenantId = requireTenantPrincipal(principal);
      conditions.push(
        { donGiaoDich: { nhaXeId: tenantId } },
        { chuyenXe: { nhaXeId: tenantId } },
        { diemGui: { nhaXeId: tenantId } },
        { diemNhan: { nhaXeId: tenantId } },
      );
    } else if (principal.roles.includes('KHACH_HANG')) {
      const customer = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId: principal.taiKhoanId },
        select: { khachHangId: true },
      });
      if (!customer) {
        throw new ForbiddenException({
          error: 'FORBIDDEN_SCOPE',
          message: 'Tài khoản chưa có hồ sơ khách hàng hợp lệ.',
        });
      }
      conditions.push({
        donGiaoDich: { khachHangId: customer.khachHangId },
      });
    } else {
      throw new ForbiddenException({
        error: 'FORBIDDEN_SCOPE',
        message: 'Bạn không có quyền xem danh sách phiếu gửi hàng.',
      });
    }

    if (query.status) conditions.push({ trangThai: query.status });
    if (query.search?.trim()) {
      const search = query.search.trim();
      conditions.push({
        OR: [
          { maVanDon: { contains: search } },
          { tenNguoiNhan: { contains: search } },
          { soDienThoaiNguoiNhan: { contains: search } },
          { donGiaoDich: { tenKhachHang: { contains: search } } },
          { donGiaoDich: { soDienThoaiKhachHang: { contains: search } } },
        ],
      });
    }

    const where: Prisma.PhieuGuiHangWhereInput = { AND: conditions };
    const [totalItems, records] = await Promise.all([
      this.prisma.phieuGuiHang.count({ where }),
      this.prisma.phieuGuiHang.findMany({
        where,
        orderBy: [
          { ngayGui: sortDirection },
          { phieuGuiHangId: sortDirection },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: SHIPMENT_LIST_INCLUDE,
      }),
    ]);

    return {
      records,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize),
      },
    };
  }

  private findShipmentDetailRecord(id: number) {
    return this.prisma.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      include: SHIPMENT_DETAIL_INCLUDE,
    });
  }

  private isShipmentInTenant(
    shipment: {
      donGiaoDich: { nhaXeId: number };
      chuyenXe: { nhaXeId: number };
      diemGui: { nhaXeId: number };
      diemNhan: { nhaXeId: number };
    },
    tenantId: number,
  ): boolean {
    return (
      shipment.donGiaoDich.nhaXeId === tenantId &&
      shipment.chuyenXe.nhaXeId === tenantId &&
      shipment.diemGui.nhaXeId === tenantId &&
      shipment.diemNhan.nhaXeId === tenantId
    );
  }

  async updateStatus(
    id: number,
    dto: UpdateShipmentStatusDto,
    principal: AuthPrincipal,
  ): Promise<{
    data: {
      shipmentId: number;
      status: TrangThaiPhieuGuiHang;
      updatedAt: string;
    };
  }> {
    const tenantId = requireTenantPrincipal(principal);
    if ((dto.status as string) === 'DA_HUY') {
      throw new ConflictException({
        error: 'INVALID_STATUS_TRANSITION',
        message: 'Không hỗ trợ hủy thủ công phiếu gửi hàng.',
      });
    }

    const snapshot = await this.prisma.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      select: { donGiaoDichId: true },
    });
    if (!snapshot) {
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const orderLocked = await lockPaymentOrder(tx, snapshot.donGiaoDichId);
      if (!orderLocked) {
        throw new NotFoundException({
          error: 'SHIPMENT_NOT_FOUND',
          message: 'Không tìm thấy phiếu gửi hàng.',
        });
      }

      const shipment = await tx.phieuGuiHang.findUnique({
        where: { phieuGuiHangId: id },
        include: {
          donGiaoDich: {
            select: {
              nhaXeId: true,
              trangThai: true,
              thanhToans: {
                select: { loaiGiaoDich: true, trangThai: true },
              },
            },
          },
          chuyenXe: { select: { nhaXeId: true } },
          diemGui: { select: { nhaXeId: true } },
          diemNhan: { select: { nhaXeId: true } },
        },
      });
      if (!shipment || !this.isShipmentInTenant(shipment, tenantId)) {
        throw new NotFoundException({
          error: 'SHIPMENT_NOT_FOUND',
          message: 'Không tìm thấy phiếu gửi hàng.',
        });
      }

      const currentStatus = shipment.trangThai;
      const targetStatus = dto.status;
      const transitions: Record<
        TrangThaiPhieuGuiHang,
        TrangThaiPhieuGuiHang[]
      > = {
        MOI_TAO: ['DA_TIEP_NHAN'],
        DA_TIEP_NHAN: ['DANG_VAN_CHUYEN'],
        DANG_VAN_CHUYEN: ['DA_GIAO'],
        DA_GIAO: [],
        DA_HUY: [],
      };
      if (!transitions[currentStatus].includes(targetStatus)) {
        throw new ConflictException({
          error: 'INVALID_STATUS_TRANSITION',
          message: `Không thể chuyển trạng thái từ ${currentStatus} sang ${targetStatus}.`,
        });
      }

      const hasSuccessfulCharge = shipment.donGiaoDich.thanhToans.some(
        (payment) =>
          payment.loaiGiaoDich !== 'HOAN_TIEN' &&
          (payment.trangThai === 'THANH_CONG' ||
            payment.trangThai === 'DA_THANH_TOAN'),
      );
      if (
        shipment.donGiaoDich.trangThai !== 'DA_THANH_TOAN' ||
        !hasSuccessfulCharge
      ) {
        throw new ConflictException({
          error: 'SHIPMENT_PAYMENT_NOT_CONFIRMED',
          message:
            'Chỉ được cập nhật trạng thái vận chuyển sau khi đơn đã thanh toán.',
        });
      }

      const now = new Date();
      const updated = await tx.phieuGuiHang.updateMany({
        where: {
          phieuGuiHangId: id,
          trangThai: currentStatus,
          donGiaoDich: { nhaXeId: tenantId },
          chuyenXe: { nhaXeId: tenantId },
          diemGui: { nhaXeId: tenantId },
          diemNhan: { nhaXeId: tenantId },
        },
        data: { trangThai: targetStatus, updatedAt: now },
      });
      if (updated.count !== 1) {
        throw new ConflictException({
          error: 'CONCURRENT_STATUS_UPDATE',
          message:
            'Trạng thái phiếu gửi hàng đã bị thay đổi bởi thao tác khác.',
        });
      }

      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          phieuGuiHangId: id,
          trangThai: targetStatus,
          thoiGian: now,
          taiKhoanId: principal.taiKhoanId,
          ghiChu: dto.note?.trim() || null,
        },
      });

      return {
        shipmentId: id,
        status: targetStatus,
        updatedAt: now.toISOString(),
      };
    });

    return { data: result };
  }

  async getCargoCategories() {
    const list = await this.prisma.loaiHangHoa.findMany({
      where: { trangThai: 'HOAT_DONG' },
      orderBy: { loaiHangHoaId: 'asc' },
    });

    return list.map((item) => ({
      categoryId: item.loaiHangHoaId,
      name: item.tenLoai,
      description: item.moTa ?? '',
      capacityGroup: item.nhomSucChua,
    }));
  }

  private assertShipmentPrincipal(
    principal: AuthPrincipal | undefined,
  ): asserts principal is AuthPrincipal {
    if (!principal) {
      throw new UnauthorizedException({
        error: 'ACCESS_TOKEN_INVALID',
        message: 'Cần đăng nhập để xem thông tin phiếu gửi hàng.',
      });
    }
    assertPrincipalScope(principal);
    if (principal.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_SCOPE',
        message: 'SUPER_ADMIN không có phạm vi dữ liệu vận hành phiếu gửi hàng.',
      });
    }
    if (
      !hasTenantRole(principal.roles) &&
      !principal.roles.includes('KHACH_HANG')
    ) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_SCOPE',
        message: 'Bạn không có quyền truy cập phiếu gửi hàng.',
      });
    }
  }

  private async assertShipmentOwnership(
    principal: AuthPrincipal,
    shipment: {
      donGiaoDich: { khachHangId: number | null; nhaXeId: number };
      chuyenXe: { nhaXeId: number };
      diemGui: { nhaXeId: number };
      diemNhan: { nhaXeId: number };
    },
  ) {
    if (principal.roles.includes('KHACH_HANG')) {
      const customer = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId: principal.taiKhoanId },
        select: { khachHangId: true },
      });
      if (
        !customer ||
        shipment.donGiaoDich.khachHangId !== customer.khachHangId
      ) {
        throw new ForbiddenException({
          error: 'FORBIDDEN_SCOPE',
          message: 'Bạn không có quyền truy cập phiếu gửi hàng này.',
        });
      }
      return;
    }

    if (hasTenantRole(principal.roles)) {
      const tenantId = requireTenantPrincipal(principal);
      if (this.isShipmentInTenant(shipment, tenantId)) return;
    }

    throw new ForbiddenException({
      error: 'FORBIDDEN_SCOPE',
      message: 'Bạn không có quyền truy cập phiếu gửi hàng này.',
    });
  }

}

