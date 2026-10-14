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
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CargoPricingService } from '../cargo-pricing/cargo-pricing.service.js';
import { CargoCapacityService } from '../cargo-capacity/cargo-capacity.service.js';
import type { CargoCapacityGroup } from '../cargo-capacity/cargo-capacity.service.js';
import { hasTenantRole } from '../auth/principal-scope.js';
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import type { CreateShipmentDto } from './dto/create-shipment.dto.js';
import type { LookupShipmentDto } from './dto/lookup-shipment.dto.js';
import type { ShipmentQueryDto } from './dto/shipment-query.dto.js';
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
      include: {
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
        },
        lichSuTrangThais: {
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

  async getShipmentDetail(id: number, principal?: AuthPrincipal) {
    this.assertShipmentPrincipal(principal);
    const shipment = await this.prisma.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      include: {
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
        },
        lichSuTrangThais: {
          orderBy: { thoiGian: 'asc' },
        },
      },
    });

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

  async listShipments(query: ShipmentQueryDto, principal?: AuthPrincipal) {
    this.assertShipmentPrincipal(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDirection = query.sortDirection ?? 'desc';

    const andConditions: Prisma.PhieuGuiHangWhereInput[] = [];

    if (principal.roles.includes('KHACH_HANG')) {
      const cust = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId: principal.taiKhoanId },
      });
      if (!cust) {
        throw new ForbiddenException({
          error: 'FORBIDDEN_SCOPE',
          message: 'Tài khoản chưa có hồ sơ khách hàng hợp lệ.',
        });
      }
      andConditions.push({
        donGiaoDich: { khachHangId: cust.khachHangId },
      });
    } else if (hasTenantRole(principal.roles)) {
      if (!principal.nhaXeId || principal.nhaXeId <= 0) {
        throw new ForbiddenException({
          error: 'TENANT_SCOPE_REQUIRED',
          message: 'Tài khoản chưa được gán nhà xe hợp lệ.',
        });
      }
      andConditions.push({
        chuyenXe: { nhaXeId: principal.nhaXeId },
      });
    } else if (!principal.roles.includes('SUPER_ADMIN')) {
      throw new ForbiddenException({
        error: 'FORBIDDEN_SCOPE',
        message: 'Bạn không có quyền xem danh sách phiếu gửi hàng.',
      });
    }

    if (query.status) {
      andConditions.push({ trangThai: query.status as any });
    }

    if (query.search?.trim()) {
      const search = query.search.trim();
      andConditions.push({
        OR: [
          { maVanDon: { contains: search } },
          { tenNguoiNhan: { contains: search } },
          { soDienThoaiNguoiNhan: { contains: search } },
          { donGiaoDich: { tenKhachHang: { contains: search } } },
          { donGiaoDich: { soDienThoaiKhachHang: { contains: search } } },
        ],
      });
    }

    const where: Prisma.PhieuGuiHangWhereInput =
      andConditions.length > 0 ? { AND: andConditions } : {};

    const [totalItems, items] = await Promise.all([
      this.prisma.phieuGuiHang.count({ where }),
      this.prisma.phieuGuiHang.findMany({
        where,
        orderBy: [{ ngayGui: sortDirection }, { phieuGuiHangId: sortDirection }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
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
          },
        },
      }),
    ]);

    const totalPages =
      totalItems === 0 ? 0 : Math.ceil(totalItems / pageSize);

    return {
      data: items.map((p) => ({
        shipmentId: p.phieuGuiHangId,
        waybillCode: p.maVanDon,
        orderCode: p.donGiaoDich.maDonGiaoDich,
        sentAt: p.ngayGui.toISOString(),
        status: p.trangThai,
        paymentStatus: p.donGiaoDich.trangThai,
        totalFee: Number(p.tongPhi),
        sender: {
          fullName: p.donGiaoDich.tenKhachHang,
          phoneNumber: p.donGiaoDich.soDienThoaiKhachHang,
        },
        receiver: {
          fullName: p.tenNguoiNhan,
          phoneNumber: p.soDienThoaiNguoiNhan,
        },
        trip: {
          tripId: p.chuyenXe.chuyenXeId,
          code: p.chuyenXe.maChuyenXe,
          route: `${p.chuyenXe.tuyenXe.diemDi} → ${p.chuyenXe.tuyenXe.diemDen}`,
          busCompany: p.chuyenXe.tuyenXe.nhaXe.tenNhaXe,
        },
        itemsCount: p.hangHoas.length,
      })),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
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
  }

  private async assertShipmentOwnership(
    principal: AuthPrincipal,
    shipment: { chuyenXe: { nhaXeId: number }; donGiaoDich: { khachHangId: number | null } },
  ) {
    if (principal.roles.includes('SUPER_ADMIN')) return;

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

    if (
      hasTenantRole(principal.roles) &&
      principal.nhaXeId &&
      principal.nhaXeId === shipment.chuyenXe.nhaXeId
    ) {
      return;
    }

    throw new ForbiddenException({
      error: 'FORBIDDEN_SCOPE',
      message: 'Bạn không có quyền truy cập phiếu gửi hàng này.',
    });
  }
}

