import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CargoPricingService } from '../cargo-pricing/cargo-pricing.service.js';
import { hasTenantRole } from '../auth/principal-scope.js';
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import type { CreateShipmentDto } from './dto/create-shipment.dto.js';
import type { LookupShipmentDto } from './dto/lookup-shipment.dto.js';
import type { ShipmentQueryDto } from './dto/shipment-query.dto.js';

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

      // 1. Resolve Customer record
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
        const existingAccount = await tx.taiKhoan.findUnique({
          where: { soDienThoai: senderPhone },
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
          const guestCount = await tx.taiKhoan.count();
          const guestAccount = await tx.taiKhoan.create({
            data: {
              hoTen: dto.sender.fullName.trim(),
              soDienThoai: senderPhone,
              matKhau: '$2b$10$DUMMY_PASSWORD_FOR_GUEST_SHIPMENT',
              email: dto.sender.email?.trim() || null,
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

      // 2. Generate transaction & waybill codes
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
      const maVanDon = `${opCode}-VD-${stamp}-${sequence}`;

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

      // 4. Create PhieuGuiHang
      const phieuGui = await tx.phieuGuiHang.create({
        data: {
          maVanDon,
          tenNguoiNhan: dto.receiver.fullName.trim(),
          soDienThoaiNguoiNhan: receiverPhone,
          ngayGui: now,
          cuocChinh,
          phiDichVu: new Prisma.Decimal(phiDichVu),
          soTienGiam: new Prisma.Decimal(0),
          tongPhi,
          nguoiTraCuoc: 'NGUOI_GUI',
          ghiChu: dto.note?.trim() || null,
          trangThai: 'MOI_TAO',
          chuyenXeId: trip.chuyenXeId,
          diemGuiId: diemGuiId!,
          diemNhanId: diemNhanId!,
          donGiaoDichId: donGiaoDich.donGiaoDichId,
        },
        include: {
          diemGui: true,
          diemNhan: true,
          chuyenXe: {
            include: {
              tuyenXe: { include: { nhaXe: true } },
              xe: true,
            },
          },
        },
      });

      // 5. Persist exactly the normalized categories used by the shared tariff resolver.
      const createdItems = [];
      for (const [index, item] of dto.items.entries()) {
        const resolvedItem = pricing.items[index];
        const hangHoa = await tx.hangHoa.create({
          data: {
            tenHang: item.name.trim(),
            soLuong: item.quantity,
            khoiLuong: resolvedItem.effectiveUnitWeight,
            chieuDai: item.length ? new Prisma.Decimal(item.length) : null,
            chieuRong: item.width ? new Prisma.Decimal(item.width) : null,
            chieuCao: item.height ? new Prisma.Decimal(item.height) : null,
            moTa: item.note?.trim() || null,
            phieuGuiHangId: phieuGui.phieuGuiHangId,
            loaiHangHoaId: resolvedItem.loaiHangHoa.loaiHangHoaId,
          },
          include: {
            loaiHangHoa: true,
          },
        });
        createdItems.push(hangHoa);
      }

      for (const detail of pricing.rates) {
        await tx.chiTietCuocGuiHang.create({
          data: {
            phieuGuiHangId: phieuGui.phieuGuiHangId,
            loaiHangHoaId: detail.loaiHangHoaId,
            bangCuocGuiHangId: detail.bangCuocGuiHangId,
            khoiLuongTinhCuoc: detail.totalWeight,
            soTienCuoc: detail.fee,
          },
        });
      }

      // 6. Create Status History
      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          trangThai: 'MOI_TAO',
          thoiGian: now,
          ghiChu: 'Tạo phiếu gửi hàng độc lập',
          phieuGuiHangId: phieuGui.phieuGuiHangId,
          taiKhoanId: taiKhoanId || null,
        },
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

