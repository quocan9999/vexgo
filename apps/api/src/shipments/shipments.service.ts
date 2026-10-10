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
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
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

    // Determine sender & receiver points
    let diemGuiId = dto.senderPointId;
    let diemNhanId = dto.receiverPointId;

    if (!diemGuiId || !diemNhanId) {
      const routePoints = await this.prisma.diemGiaoNhanTuyenXe.findMany({
        where: { tuyenXeId: trip.tuyenXeId },
        include: { diemGiaoNhanHang: true },
      });

      const routeSender = routePoints.find(
        (p) =>
          (p.vaiTro === 'GUI_HANG' || p.vaiTro === 'CA_HAI') &&
          p.diemGiaoNhanHang.trangThai === 'HOAT_DONG',
      );
      const routeReceiver = routePoints.find(
        (p) =>
          (p.vaiTro === 'NHAN_HANG' || p.vaiTro === 'CA_HAI') &&
          p.diemGiaoNhanHang.trangThai === 'HOAT_DONG',
      );

      if (!diemGuiId && routeSender) {
        diemGuiId = routeSender.diemGiaoNhanHangId;
      }
      if (!diemNhanId && routeReceiver) {
        diemNhanId = routeReceiver.diemGiaoNhanHangId;
      }

      // Fallback to operator active points if not specifically set on route
      if (!diemGuiId) {
        const companyPoint = await this.prisma.diemGiaoNhanHang.findFirst({
          where: {
            nhaXeId: trip.nhaXeId,
            trangThai: 'HOAT_DONG',
          },
        });
        if (companyPoint) diemGuiId = companyPoint.diemGiaoNhanHangId;
      }
      if (!diemNhanId) {
        const companyPoint = await this.prisma.diemGiaoNhanHang.findFirst({
          where: {
            nhaXeId: trip.nhaXeId,
            trangThai: 'HOAT_DONG',
            diemGiaoNhanHangId: { not: diemGuiId ?? -1 },
          },
        });
        if (companyPoint) {
          diemNhanId = companyPoint.diemGiaoNhanHangId;
        } else {
          diemNhanId = diemGuiId;
        }
      }
    }

    if (!diemGuiId || !diemNhanId) {
      throw new ConflictException({
        error: 'SHIPMENT_POINTS_NOT_FOUND',
        message: 'Chưa có cấu hình điểm gửi/nhận hàng cho nhà xe này.',
      });
    }

    // Calculate freight cost:
    // Base rule: 50,000 for up to 5kg, 10,000 per kg above 5kg
    // Fragile surcharge: +20,000, Valuable insurance: +50,000
    let totalWeight = 0;
    for (const item of dto.items) {
      totalWeight += Number(item.weight) * Number(item.quantity);
    }

    let cuocChinh = 50000;
    if (totalWeight > 5) {
      cuocChinh += Math.ceil(totalWeight - 5) * 10000;
    }

    let phiDichVu = 0;
    if (dto.isFragile) {
      phiDichVu += 20000;
    }
    if (dto.isValuable) {
      phiDichVu += 50000;
    }

    const tongPhi = cuocChinh + phiDichVu;

    // Load available cargo categories
    const allLoaiHang = await this.prisma.loaiHangHoa.findMany({
      where: { trangThai: 'HOAT_DONG' },
    });
    const defaultLoaiHang = allLoaiHang[0];

    if (!defaultLoaiHang) {
      throw new ConflictException({
        error: 'CARGO_TYPE_NOT_CONFIGURED',
        message: 'Hệ thống chưa cấu hình danh mục loại hàng hóa.',
      });
    }

    const senderPhone = normalizePhone(dto.sender.phoneNumber);
    const receiverPhone = normalizePhone(dto.receiver.phoneNumber);

    return this.prisma.$transaction(async (tx) => {
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
          tongTien: new Prisma.Decimal(tongPhi),
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
          cuocChinh: new Prisma.Decimal(cuocChinh),
          phiDichVu: new Prisma.Decimal(phiDichVu),
          soTienGiam: new Prisma.Decimal(0),
          tongPhi: new Prisma.Decimal(tongPhi),
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

      // 5. Create HangHoa items
      const createdItems = [];
      for (const item of dto.items) {
        let loaiHang = allLoaiHang.find(
          (l) =>
            l.tenLoai.toLowerCase() === (item.category || '').toLowerCase() ||
            l.tenLoai.toLowerCase().includes((item.name || '').toLowerCase()),
        );
        if (!loaiHang) loaiHang = defaultLoaiHang;

        const hangHoa = await tx.hangHoa.create({
          data: {
            tenHang: item.name.trim(),
            soLuong: item.quantity,
            khoiLuong: new Prisma.Decimal(item.weight),
            chieuDai: item.length ? new Prisma.Decimal(item.length) : null,
            chieuRong: item.width ? new Prisma.Decimal(item.width) : null,
            chieuCao: item.height ? new Prisma.Decimal(item.height) : null,
            moTa: item.note?.trim() || null,
            phieuGuiHangId: phieuGui.phieuGuiHangId,
            loaiHangHoaId: loaiHang.loaiHangHoaId,
          },
          include: {
            loaiHangHoa: true,
          },
        });
        createdItems.push(hangHoa);
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
          baseFee: cuocChinh,
          serviceFee: phiDichVu,
          discount: 0,
          totalFee: tongPhi,
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

    if (principal) {
      const isTenantUser =
        principal.roles.includes('NHA_XE_ADMIN') ||
        principal.roles.includes('NHAN_VIEN');
      if (isTenantUser && principal.nhaXeId !== shipment.chuyenXe.nhaXeId) {
        throw new ForbiddenException({
          error: 'FORBIDDEN_SCOPE',
          message: 'Bạn không có quyền truy cập phiếu gửi hàng của nhà xe khác.',
        });
      }
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

  async listShipments(query: ShipmentQueryDto, principal?: AuthPrincipal) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;
    const sortDirection = query.sortDirection ?? 'desc';

    const andConditions: Prisma.PhieuGuiHangWhereInput[] = [];

    if (principal?.roles.includes('KHACH_HANG')) {
      const cust = await this.prisma.khachHang.findUnique({
        where: { taiKhoanId: principal.taiKhoanId },
      });
      if (cust) {
        andConditions.push({
          donGiaoDich: { khachHangId: cust.khachHangId },
        });
      }
    } else if (principal?.nhaXeId) {
      andConditions.push({
        chuyenXe: { nhaXeId: principal.nhaXeId },
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
}

