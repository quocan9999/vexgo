import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomUUID } from 'node:crypto';
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
  getBusinessDate,
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
  ShipmentHistoryItem,
  ShipmentSummary,
} from './dto/shipment-response.dto.js';
import { ShipmentPersistenceService } from './shipment-persistence.service.js';
import { LocationsService } from '../locations/locations.service.js';
import { locationSearchTerms } from '../locations/location-search.js';
import { generateStandaloneShipmentCodes } from './shipment-codes.js';
import {
  parseShipmentDate,
  type ShipmentOptionsQueryDto,
  type ShipmentQuoteDto,
  type AcceptShipmentDto,
  type AssignShipmentDto,
  type CollectShipmentPaymentDto,
  type ResolveShipmentMoneyCaseDto,
} from './dto/shipment-operations.dto.js';

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

function extractReceiverCccd(note: string | null | undefined): string | null {
  if (!note) return null;
  const match = note.match(/\[CCCD người nhận:\s*([^\]]+)\]/);
  return match ? match[1].trim() : null;
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
  tuyenXe: { include: { nhaXe: true } },
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
  donGiaoDich: {
    include: {
      thanhToans: {
        orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
      },
    },
  },
  tuyenXe: { include: { nhaXe: true } },
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
  lichSuCuocs: { include: { taiKhoan: true }, orderBy: { thoiGian: 'asc' } },
  lichSuPhanChuyens: {
    include: { taiKhoan: true },
    orderBy: { thoiGian: 'asc' },
  },
  xuLyTiens: true,
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
    @Optional() private readonly locations?: LocationsService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      config.get<string>('BUSINESS_TIME_ZONE'),
    );
  }

  private shipmentOperationalInfo(record: {
    tuyenXe: {
      tuyenXeId: number;
      diemDi: string;
      diemDen: string;
      nhaXe: { nhaXeId: number; tenNhaXe: string };
    } | null;
    chuyenXe: {
      tuyenXe: {
        tuyenXeId: number;
        diemDi: string;
        diemDen: string;
        nhaXe: { nhaXeId: number; tenNhaXe: string };
      };
    } | null;
    hanMangHangDen: Date | null;
    ngayDuKienGui: Date | null;
  }) {
    const route = record.tuyenXe ?? record.chuyenXe?.tuyenXe;
    return {
      route: route
        ? {
            routeId: route.tuyenXeId,
            origin: route.diemDi,
            destination: route.diemDen,
          }
        : null,
      carrier: route
        ? { id: route.nhaXe.nhaXeId, name: route.nhaXe.tenNhaXe }
        : null,
      dropoffDeadline: record.hanMangHangDen?.toISOString() ?? null,
      expectedSendDate:
        record.ngayDuKienGui
          ?.toISOString()
          .slice(0, 10)
          .split('-')
          .reverse()
          .join('-') ?? null,
    };
  }

  private validateSendDate(value: string, now = new Date()): Date {
    const day = parseShipmentDate(value);
    const today = new Date(
      `${getBusinessDate(this.businessTimeZone, now)}T00:00:00Z`,
    );
    const deadlineDay = new Date(
      `${getBusinessDate(this.businessTimeZone, new Date(now.getTime() + 48 * 3600000))}T00:00:00Z`,
    );
    if (day < today || day > deadlineDay)
      throw new BadRequestException({
        error: 'SHIPMENT_SEND_DATE_OUTSIDE_WINDOW',
        message:
          'Ngày dự kiến gửi phải nằm trong thời hạn 48 giờ từ lúc tạo đơn.',
      });
    return day;
  }

  private async requireAvailableRoute(routeId: number, sendDate: Date) {
    const route = await this.prisma.tuyenXe.findUnique({
      where: { tuyenXeId: routeId },
      include: { nhaXe: true },
    });
    if (!route || route.trangThai !== 'HOAT_DONG')
      throw new NotFoundException({
        error: 'SHIPMENT_ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến nhận hàng.',
      });
    const trips = await this.prisma.chuyenXe.findMany({
      where: {
        tuyenXeId: routeId,
        nhaXeId: route.nhaXeId,
        nhanGuiHang: true,
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: sendDate,
      },
    });
    if (
      !trips.some(
        (trip) =>
          combineDeparture(
            trip.ngayKhoiHanh,
            trip.gioKhoiHanh,
            this.businessTimeZone,
          ) > new Date(),
      )
    )
      throw new ConflictException({
        error: 'SHIPMENT_ROUTE_UNAVAILABLE',
        message: 'Nhà xe chưa có chuyến mở nhận hàng trong ngày dự kiến.',
      });
    return route;
  }

  async getShipmentOptions(query: ShipmentOptionsQueryDto) {
    const date = this.validateSendDate(query.sendDate);
    const catalogue = this.locations ? (await this.locations.list()).data : [];
    const routes = await this.prisma.tuyenXe.findMany({
      where: {
        trangThai: 'HOAT_DONG',
        AND: [
          {
            OR: locationSearchTerms(query.from, catalogue).map((term) => ({
              diemDi: { contains: term },
            })),
          },
          {
            OR: locationSearchTerms(query.to, catalogue).map((term) => ({
              diemDen: { contains: term },
            })),
          },
        ],
        chuyenXes: {
          some: {
            ngayKhoiHanh: date,
            nhanGuiHang: true,
            trangThai: 'CHUA_KHOI_HANH',
          },
        },
      },
      include: {
        nhaXe: true,
        chuyenXes: {
          where: {
            ngayKhoiHanh: date,
            nhanGuiHang: true,
            trangThai: 'CHUA_KHOI_HANH',
          },
        },
      },
      orderBy: { tuyenXeId: 'asc' },
    });
    const available = routes.filter((route) =>
      route.chuyenXes.some(
        (trip) =>
          combineDeparture(
            trip.ngayKhoiHanh,
            trip.gioKhoiHanh,
            this.businessTimeZone,
          ) > new Date(),
      ),
    );
    const availableRouteIds = available.map((route) => route.tuyenXeId);
    const minimumFeeByRouteId = new Map<number, Prisma.Decimal>();
    if (availableRouteIds.length > 0) {
      const rates = await this.prisma.bangCuocGuiHang.findMany({
        where: {
          trangThai: 'HOAT_DONG',
          tuNgay: { lte: date },
          OR: [{ denNgay: null }, { denNgay: { gte: date } }],
          diemGui: {
            trangThai: 'HOAT_DONG',
            tuyenXeDiemGiaoNhaps: {
              some: {
                tuyenXeId: { in: availableRouteIds },
                vaiTro: { in: ['GUI_HANG', 'CA_HAI'] },
              },
            },
          },
          diemNhan: {
            trangThai: 'HOAT_DONG',
            tuyenXeDiemGiaoNhaps: {
              some: {
                tuyenXeId: { in: availableRouteIds },
                vaiTro: { in: ['NHAN_HANG', 'CA_HAI'] },
              },
            },
          },
        },
        select: {
          mucCuoc: true,
          diemGui: {
            select: {
              tuyenXeDiemGiaoNhaps: {
                where: {
                  tuyenXeId: { in: availableRouteIds },
                  vaiTro: { in: ['GUI_HANG', 'CA_HAI'] },
                },
                select: { tuyenXeId: true },
              },
            },
          },
          diemNhan: {
            select: {
              tuyenXeDiemGiaoNhaps: {
                where: {
                  tuyenXeId: { in: availableRouteIds },
                  vaiTro: { in: ['NHAN_HANG', 'CA_HAI'] },
                },
                select: { tuyenXeId: true },
              },
            },
          },
        },
      });
      for (const rate of rates) {
        const receiverRouteIds = new Set(
          rate.diemNhan.tuyenXeDiemGiaoNhaps.map((point) => point.tuyenXeId),
        );
        for (const senderRoute of rate.diemGui.tuyenXeDiemGiaoNhaps) {
          if (!receiverRouteIds.has(senderRoute.tuyenXeId)) continue;
          const current = minimumFeeByRouteId.get(senderRoute.tuyenXeId);
          if (!current || rate.mucCuoc.lessThan(current)) {
            minimumFeeByRouteId.set(senderRoute.tuyenXeId, rate.mucCuoc);
          }
        }
      }
    }
    const options = available
      .map((route) => ({
        routeId: route.tuyenXeId,
        busCompany: { id: route.nhaXeId, name: route.nhaXe.tenNhaXe },
        route: { origin: route.diemDi, destination: route.diemDen },
        minimumEstimatedFee:
          minimumFeeByRouteId.get(route.tuyenXeId)?.toNumber() ?? null,
      }))
      .sort((left, right) => {
        if (left.minimumEstimatedFee === null)
          return right.minimumEstimatedFee === null
            ? left.routeId - right.routeId
            : 1;
        if (right.minimumEstimatedFee === null) return -1;
        return (
          left.minimumEstimatedFee - right.minimumEstimatedFee ||
          left.routeId - right.routeId
        );
      });
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 10,
      totalItems = options.length;
    return {
      data: options.slice((page - 1) * pageSize, page * pageSize),
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / pageSize),
      },
    };
  }

  async getRoutePointsByRoute(routeId: number) {
    const route = await this.prisma.tuyenXe.findUnique({
      where: { tuyenXeId: routeId },
    });
    if (!route || route.trangThai !== 'HOAT_DONG')
      throw new NotFoundException({
        error: 'SHIPMENT_ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến nhận hàng.',
      });
    const points = await this.prisma.diemGiaoNhanTuyenXe.findMany({
      where: {
        tuyenXeId: routeId,
        diemGiaoNhanHang: { nhaXeId: route.nhaXeId, trangThai: 'HOAT_DONG' },
      },
      include: { diemGiaoNhanHang: true },
      orderBy: { diemGiaoNhanHangId: 'asc' },
    });
    const option = (point: (typeof points)[number]) => ({
      id: point.diemGiaoNhanHangId,
      name: point.diemGiaoNhanHang.tenDiem,
      address: point.diemGiaoNhanHang.diaChi,
    });
    return {
      senderPoints: points
        .filter((p) => p.vaiTro === 'GUI_HANG' || p.vaiTro === 'CA_HAI')
        .map(option),
      receiverPoints: points
        .filter((p) => p.vaiTro === 'NHAN_HANG' || p.vaiTro === 'CA_HAI')
        .map(option),
      rates: [],
    };
  }

  async quoteShipment(dto: ShipmentQuoteDto) {
    const date = this.validateSendDate(dto.sendDate);
    const route = await this.requireAvailableRoute(dto.routeId, date);
    const quote = await this.cargoPricingService.calculate(
      this.prisma,
      {
        tuyenXeId: route.tuyenXeId,
        nhaXeId: route.nhaXeId,
        ngayKhoiHanh: date,
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
          loaiHangHoaId: item.loaiHangHoaId,
          length: item.length,
          width: item.width,
          height: item.height,
          serviceType: item.serviceType,
          categoryName: item.category,
        })),
      },
    );
    return {
      baseFee: quote.baseFee.toNumber(),
      serviceFee: quote.serviceFee.toNumber(),
      totalFee: quote.totalFee.toNumber(),
      rates: quote.rates.map((rate) => ({
        categoryId: rate.loaiHangHoaId,
        rateId: rate.bangCuocGuiHangId,
        billableWeight: rate.totalWeight.toNumber(),
        fee: rate.fee.toNumber(),
      })),
    };
  }

  private async lockScopedShipment(
    tx: Prisma.TransactionClient,
    id: number,
    principal: AuthPrincipal,
  ) {
    const tenantId = requireTenantPrincipal(principal);
    const snapshot = await tx.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      select: { donGiaoDichId: true },
    });
    if (!snapshot || !(await lockPaymentOrder(tx, snapshot.donGiaoDichId)))
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    const shipment = await tx.phieuGuiHang.findUnique({
      where: { phieuGuiHangId: id },
      include: {
        ...SHIPMENT_DETAIL_INCLUDE,
        donGiaoDich: { include: { thanhToans: true, phieuDatVe: true } },
      },
    });
    if (!shipment || !this.isShipmentInTenant(shipment, tenantId))
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    return shipment;
  }

  private paidAmount(
    payments: Array<{
      loaiGiaoDich: string;
      trangThai: string;
      soTien: Prisma.Decimal;
      laQuyetToanHopLe?: boolean;
    }>,
  ): Prisma.Decimal {
    return (payments ?? [])
      .filter(
        (p) =>
          ['THANH_CONG', 'DA_THANH_TOAN'].includes(p.trangThai) &&
          (p.loaiGiaoDich !== 'HOAN_TIEN' || p.laQuyetToanHopLe !== false),
      )
      .reduce(
        (sum, p) =>
          p.loaiGiaoDich === 'HOAN_TIEN'
            ? sum.minus(p.soTien)
            : sum.plus(p.soTien),
        new Prisma.Decimal(0),
      );
  }

  async acceptShipment(
    id: number,
    dto: AcceptShipmentDto,
    principal: AuthPrincipal,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.lockScopedShipment(tx, id, principal);
      const now = new Date();
      if (
        shipment.trangThai !== 'MOI_TAO' ||
        (shipment.hanMangHangDen && shipment.hanMangHangDen <= now)
      )
        throw new ConflictException({
          error: 'SHIPMENT_NOT_ACCEPTABLE',
          message: 'Đơn đã tiếp nhận, hủy hoặc hết hạn mang hàng đến.',
        });
      if (
        dto.items.length !== shipment.hangHoas.length ||
        new Set(dto.items.map((i) => i.cargoId)).size !== dto.items.length ||
        dto.items.some(
          (i) => !shipment.hangHoas.some((h) => h.hangHoaId === i.cargoId),
        )
      )
        throw new BadRequestException({
          error: 'SHIPMENT_MEASUREMENTS_INVALID',
          message: 'Cần cân đo đúng một lần cho tất cả kiện hàng.',
        });
      const route = shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe;
      if (!route)
        throw new ConflictException({
          error: 'SHIPMENT_ROUTE_NOT_FOUND',
          message: 'Đơn chưa có tuyến hợp lệ.',
        });
      const pricing = await this.cargoPricingService.calculate(
        tx,
        {
          tuyenXeId: route.tuyenXeId,
          nhaXeId: shipment.donGiaoDich.nhaXeId,
          ngayKhoiHanh: new Date(
            `${getBusinessDate(this.businessTimeZone, now)}T00:00:00Z`,
          ),
        },
        {
          senderPointId: shipment.diemGuiId,
          receiverPointId: shipment.diemNhanId,
          items: shipment.hangHoas.map((item) => {
            const measured = dto.items.find(
              (i) => i.cargoId === item.hangHoaId,
            )!;
            return {
              name: item.tenHang,
              quantity: item.soLuong,
              loaiHangHoaId: item.loaiHangHoaId,
              weight: measured.weight,
              length: measured.length,
              width: measured.width,
              height: measured.height,
            };
          }),
        },
      );
      // Keep the original service selection surcharge; acceptance changes measured base fee.
      const total = pricing.baseFee
        .plus(shipment.phiDichVu)
        .minus(shipment.soTienGiam);
      if (
        !total.equals(shipment.tongPhi) &&
        (!dto.confirmPriceChange || !dto.note?.trim())
      )
        throw new ConflictException({
          error: 'SHIPMENT_PRICE_CONFIRMATION_REQUIRED',
          message:
            'Cước thay đổi; xác nhận tại quầy và ghi lý do trước khi tiếp nhận.',
          previousFee: shipment.tongPhi.toNumber(),
          totalFee: total.toNumber(),
        });
      const before = JSON.parse(
        JSON.stringify({
          items: shipment.hangHoas,
          rates: shipment.chiTietCuocGuiHangs,
        }),
      ) as Prisma.InputJsonValue;
      for (const item of pricing.items) {
        // Match by persisted cargo order rather than name when names repeat.
        const index = pricing.items.indexOf(item);
        const cargo = shipment.hangHoas[index];
        const measured = dto.items.find((i) => i.cargoId === cargo.hangHoaId)!;
        await tx.hangHoa.update({
          where: { hangHoaId: cargo.hangHoaId },
          data: {
            khoiLuong: item.effectiveUnitWeight,
            khoiLuongThucTe: measured.weight,
            chieuDaiThucTe: measured.length ?? null,
            chieuRongThucTe: measured.width ?? null,
            chieuCaoThucTe: measured.height ?? null,
            chieuDai: measured.length ?? null,
            chieuRong: measured.width ?? null,
            chieuCao: measured.height ?? null,
          },
        });
      }
      await tx.chiTietCuocGuiHang.deleteMany({ where: { phieuGuiHangId: id } });
      for (const rate of pricing.rates)
        await tx.chiTietCuocGuiHang.create({
          data: {
            phieuGuiHangId: id,
            loaiHangHoaId: rate.loaiHangHoaId,
            bangCuocGuiHangId: rate.bangCuocGuiHangId,
            khoiLuongTinhCuoc: rate.totalWeight,
            soTienCuoc: rate.fee,
          },
        });
      await tx.lichSuDieuChinhCuocGuiHang.create({
        data: {
          phieuGuiHangId: id,
          taiKhoanId: principal.taiKhoanId,
          loaiThaoTac: 'XAC_NHAN_CUOC',
          cuocTruoc: shipment.tongPhi,
          cuocSau: total,
          lyDo: dto.note?.trim() ?? null,
          snapshotTruoc: before,
          snapshotSau: JSON.parse(
            JSON.stringify({
              measurements: dto.items,
              rates: pricing.rates,
              baseFee: pricing.baseFee,
              serviceFee: shipment.phiDichVu,
              discount: shipment.soTienGiam,
            }),
          ) as Prisma.InputJsonValue,
          thoiGian: now,
        },
      });
      const orderTotal = shipment.donGiaoDich.tongTien
        .minus(shipment.tongPhi)
        .plus(total);
      const paid = this.paidAmount(shipment.donGiaoDich.thanhToans);
      await tx.donGiaoDich.update({
        where: { donGiaoDichId: shipment.donGiaoDichId },
        data: {
          tongTien: orderTotal,
          trangThai: paid.greaterThanOrEqualTo(orderTotal)
            ? 'DA_THANH_TOAN'
            : 'CHO_THANH_TOAN',
        },
      });
      if (paid.greaterThan(orderTotal))
        await tx.xuLyTienGuiHang.upsert({
          where: { khoaSuKien: `shipment:${id}:accept-overpayment` },
          create: {
            khoaSuKien: `shipment:${id}:accept-overpayment`,
            phieuGuiHangId: id,
            lyDo: 'CHENH_LECH_CUOC',
            soTien: paid.minus(orderTotal),
          },
          update: {},
        });
      await tx.phieuGuiHang.update({
        where: { phieuGuiHangId: id },
        data: {
          trangThai: 'DA_TIEP_NHAN',
          cuocChinh: pricing.baseFee,
          tongPhi: total,
          thoiDiemXacNhanCuoc: now,
          taiKhoanXacNhanCuocId: principal.taiKhoanId,
        },
      });
      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          phieuGuiHangId: id,
          trangThai: 'DA_TIEP_NHAN',
          thoiGian: now,
          taiKhoanId: principal.taiKhoanId,
          ghiChu: dto.note?.trim() ?? null,
        },
      });
    });
    return this.findOne(id, principal);
  }

  async availableTrips(id: number, principal: AuthPrincipal) {
    const shipment = await this.findShipmentDetailRecord(id);
    const tenantId = requireTenantPrincipal(principal);
    if (!shipment || !this.isShipmentInTenant(shipment, tenantId))
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    const trips = await this.prisma.chuyenXe.findMany({
      where: {
        tuyenXeId: shipment.tuyenXeId ?? shipment.chuyenXe?.tuyenXeId,
        nhaXeId: tenantId,
        nhanGuiHang: true,
        trangThai: 'CHUA_KHOI_HANH',
      },
      orderBy: [{ ngayKhoiHanh: 'asc' }, { gioKhoiHanh: 'asc' }],
    });
    const data = [];
    for (const trip of trips)
      if (
        combineDeparture(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          this.businessTimeZone,
        ) > new Date()
      ) {
        const snapshot = await this.cargoCapacityService.getSnapshot(
          this.prisma,
          trip.chuyenXeId,
        );
        if (snapshot)
          data.push({
            tripId: trip.chuyenXeId,
            code: trip.maChuyenXe,
            departureDate: trip.ngayKhoiHanh
              .toISOString()
              .slice(0, 10)
              .split('-')
              .reverse()
              .join('-'),
            departureTime: formatTripTime(trip.gioKhoiHanh),
            capacities: snapshot.capacities,
          });
      }
    return { data };
  }

  async assignShipment(
    id: number,
    dto: AssignShipmentDto,
    principal: AuthPrincipal,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.lockScopedShipment(tx, id, principal);
      if (shipment.donGiaoDich.phieuDatVe)
        throw new ConflictException({
          error: 'BOOKING_SHIPMENT_TRIP_FIXED',
          message: 'Hàng đi kèm vé phải theo chuyến của hành khách.',
        });
      if (shipment.trangThai !== 'DA_TIEP_NHAN')
        throw new ConflictException({
          error: 'SHIPMENT_NOT_ASSIGNABLE',
          message: 'Chỉ phân chuyến sau khi tiếp nhận hàng.',
        });
      if (shipment.chuyenXeId === dto.tripId) return;
      const tripIds = [
        ...new Set(
          [shipment.chuyenXeId, dto.tripId].filter(
            (id): id is number => id !== null,
          ),
        ),
      ].sort((a, b) => a - b);
      for (const tripId of tripIds)
        await this.cargoCapacityService.lockTrip(tx, tripId);
      const trip = await tx.chuyenXe.findUnique({
        where: { chuyenXeId: dto.tripId },
      });
      if (
        !trip ||
        !trip.nhanGuiHang ||
        trip.trangThai !== 'CHUA_KHOI_HANH' ||
        trip.nhaXeId !== shipment.donGiaoDich.nhaXeId ||
        trip.tuyenXeId !==
          (shipment.tuyenXeId ?? shipment.chuyenXe?.tuyenXeId) ||
        combineDeparture(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          this.businessTimeZone,
        ) <= new Date()
      )
        throw new ConflictException({
          error: 'SHIPMENT_ASSIGNMENT_INVALID',
          message: 'Chuyến không đúng nhà xe/tuyến hoặc đã khởi hành.',
        });
      const snapshot = await this.cargoCapacityService.getSnapshot(
        tx,
        dto.tripId,
      );
      if (!snapshot)
        throw new ConflictException({
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        });
      this.cargoCapacityService.assertAvailable(
        snapshot,
        shipment.hangHoas.map((item) => ({
          group: item.loaiHangHoa.nhomSucChua,
          quantity: item.soLuong,
        })),
      );
      await tx.phieuGuiHang.update({
        where: { phieuGuiHangId: id },
        data: { chuyenXeId: dto.tripId },
      });
      await tx.lichSuPhanChuyenGuiHang.create({
        data: {
          phieuGuiHangId: id,
          chuyenXeTruocId: shipment.chuyenXeId,
          chuyenXeSauId: dto.tripId,
          taiKhoanId: principal.taiKhoanId,
          lyDo: dto.note?.trim() ?? null,
        },
      });
    });
    return this.findOne(id, principal);
  }

  async collectPayment(
    id: number,
    dto: CollectShipmentPaymentDto,
    principal: AuthPrincipal,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.lockScopedShipment(tx, id, principal);
      if (shipment.trangThai === 'DA_HUY')
        throw new ConflictException({
          error: 'SHIPMENT_CANCELLED',
          message: 'Không thể thu tiền đơn đã hủy.',
        });
      if (shipment.hanMangHangDen && shipment.trangThai === 'MOI_TAO') {
        throw new ConflictException({
          error: 'SHIPMENT_ACCEPTANCE_REQUIRED',
          message: 'Cần cân đo và chốt cước trước khi thu tiền tại bến.',
        });
      }
      const outstanding = new Prisma.Decimal(
        shipment.donGiaoDich.tongTien,
      ).minus(this.paidAmount(shipment.donGiaoDich.thanhToans));
      if (outstanding.lessThanOrEqualTo(0) || !outstanding.equals(dto.amount))
        throw new ConflictException({
          error: 'SHIPMENT_PAYMENT_AMOUNT_MISMATCH',
          message: 'Số tiền phải bằng khoản còn cần thu.',
          outstandingAmount: Prisma.Decimal.max(0, outstanding).toNumber(),
        });
      await tx.thanhToan.create({
        data: {
          donGiaoDichId: shipment.donGiaoDichId,
          soTien: outstanding,
          phuongThuc: 'TAI_BEN',
          loaiGiaoDich: 'THANH_TOAN',
          trangThai: 'THANH_CONG',
          thoiGian: new Date(),
          thoiDiemHoanTat: new Date(),
          laQuyetToanHopLe: true,
          taiKhoanXacNhanId: principal.taiKhoanId,
        },
      });
      await tx.donGiaoDich.update({
        where: { donGiaoDichId: shipment.donGiaoDichId },
        data: { trangThai: 'DA_THANH_TOAN' },
      });
      await tx.thanhToan.updateMany({
        where: {
          donGiaoDichId: shipment.donGiaoDichId,
          loaiGiaoDich: 'THANH_TOAN',
          trangThai: { in: ['DANG_XU_LY', 'CHO_THANH_TOAN'] },
        },
        data: { trangThai: 'THAT_BAI' },
      });
      await tx.lichSuTrangThaiPhieuGuiHang.create({
        data: {
          phieuGuiHangId: id,
          trangThai: shipment.trangThai,
          thoiGian: new Date(),
          taiKhoanId: principal.taiKhoanId,
          ghiChu: `Thu tại bến ${outstanding.toString()} đồng.${dto.note?.trim() ? ` ${dto.note.trim()}` : ''}`,
        },
      });
    });
    return this.findOne(id, principal);
  }

  async resolveMoneyCase(
    id: number,
    caseId: number,
    dto: ResolveShipmentMoneyCaseDto,
    principal: AuthPrincipal,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const shipment = await this.lockScopedShipment(tx, id, principal);
      const moneyCase = await tx.xuLyTienGuiHang.findUnique({
        where: { xuLyTienGuiHangId: caseId },
      });
      if (!moneyCase || moneyCase.phieuGuiHangId !== id)
        throw new NotFoundException({
          error: 'SHIPMENT_MONEY_CASE_NOT_FOUND',
          message: 'Không tìm thấy hồ sơ tiền.',
        });
      if (moneyCase.trangThai === 'DA_XU_LY')
        throw new ConflictException({
          error: 'SHIPMENT_MONEY_CASE_RESOLVED',
          message: 'Hồ sơ đã được xử lý.',
        });
      let paymentId: number | null = null;
      if (dto.outcome !== 'NO_PAYMENT') {
        if (dto.outcome !== 'REFUNDED') {
          throw new BadRequestException({
            error: 'SHIPMENT_MONEY_OUTCOME_INVALID',
            message:
              'Hồ sơ khoản dư/chờ hoàn không được ghi nhận thành khoản thu mới.',
          });
        }
        if (!dto.reference?.trim()) {
          throw new BadRequestException({
            error: 'SHIPMENT_PAYMENT_PROOF_REQUIRED',
            message: 'Cần mã chứng từ để ghi nhận hoàn tiền thực tế.',
          });
        }
        if (!dto.amount || !moneyCase.soTien.equals(dto.amount))
          throw new BadRequestException({
            error: 'SHIPMENT_MONEY_AMOUNT_MISMATCH',
            message: 'Số tiền thực tế phải bằng số tiền hồ sơ.',
          });
        const received = shipment.donGiaoDich.thanhToans
          .filter((p) =>
            ['THANH_CONG', 'DA_THANH_TOAN', 'CAN_DOI_SOAT'].includes(
              p.trangThai,
            ),
          )
          .reduce(
            (sum, p) =>
              p.loaiGiaoDich === 'HOAN_TIEN'
                ? sum.minus(p.soTien)
                : sum.plus(p.soTien),
            new Prisma.Decimal(0),
          );
        if (received.lessThan(moneyCase.soTien)) {
          throw new ConflictException({
            error: 'SHIPMENT_REFUND_EXCEEDS_RECEIPTS',
            message:
              'Số tiền hoàn vượt số tiền còn có thể hoàn theo giao dịch đã ghi nhận.',
          });
        }
        const payment = await tx.thanhToan.create({
          data: {
            donGiaoDichId: shipment.donGiaoDichId,
            soTien: moneyCase.soTien,
            phuongThuc: 'TAI_BEN',
            loaiGiaoDich:
              dto.outcome === 'REFUNDED' ? 'HOAN_TIEN' : 'THANH_TOAN',
            trangThai: 'THANH_CONG',
            thoiGian: new Date(),
            thoiDiemHoanTat: new Date(),
            laQuyetToanHopLe: !moneyCase.lyDo.startsWith('THANH_TOAN_'),
            taiKhoanXacNhanId: principal.taiKhoanId,
          },
        });
        paymentId = payment.thanhToanId;
      }
      await tx.xuLyTienGuiHang.update({
        where: { xuLyTienGuiHangId: caseId },
        data: {
          trangThai: 'DA_XU_LY',
          taiKhoanXuLyId: principal.taiKhoanId,
          thoiDiemXuLy: new Date(),
          ketQua: `${dto.outcome}: ${dto.note.trim()}`,
          thamChieu: dto.reference ?? null,
          thanhToanId: paymentId ?? moneyCase.thanhToanId,
        },
      });
    });
    return this.findOne(id, principal);
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

    const senderPoints = routePoints
      .filter(
        (point) =>
          point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
          point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId &&
          (point.vaiTro === 'GUI_HANG' || point.vaiTro === 'CA_HAI'),
      )
      .map(toOption);
    const receiverPoints = routePoints
      .filter(
        (point) =>
          point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
          point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId &&
          (point.vaiTro === 'NHAN_HANG' || point.vaiTro === 'CA_HAI'),
      )
      .map(toOption);

    let rates: Array<{
      senderPointId: number;
      receiverPointId: number;
      categoryId: number;
      minWeight: number;
      maxWeight: number | null;
      fee: number;
    }> = [];
    if (
      senderPoints.length > 0 &&
      receiverPoints.length > 0 &&
      typeof this.prisma.bangCuocGuiHang?.findMany === 'function'
    ) {
      const rawRates =
        (await this.prisma.bangCuocGuiHang.findMany({
          where: {
            diemGuiId: { in: senderPoints.map((p) => p.id) },
            diemNhanId: { in: receiverPoints.map((p) => p.id) },
            trangThai: 'HOAT_DONG',
          },
          orderBy: [{ khoiLuongTu: 'asc' }, { loaiHangHoaId: 'asc' }],
        })) ?? [];
      rates = rawRates.map((r) => ({
        senderPointId: r.diemGuiId,
        receiverPointId: r.diemNhanId,
        categoryId: r.loaiHangHoaId,
        minWeight: Number(r.khoiLuongTu),
        maxWeight: r.khoiLuongDen !== null ? Number(r.khoiLuongDen) : null,
        fee: Number(r.mucCuoc),
      }));
    }

    const minFee =
      rates.length > 0 ? Math.min(...rates.map((r) => r.fee)) : null;

    return {
      tripId: trip.chuyenXeId,
      senderPoints,
      receiverPoints,
      rates,
      minFee,
    };
  }

  async createShipment(
    dto: CreateShipmentDto,
    taiKhoanId?: number,
    idempotencyKey?: string,
  ) {
    if (dto.tripId === undefined && !idempotencyKey?.trim())
      throw new BadRequestException({
        error: 'IDEMPOTENCY_KEY_REQUIRED',
        message: 'Vui lòng gửi Idempotency-Key để tạo vận đơn.',
      });
    if (
      idempotencyKey &&
      (idempotencyKey.length > 100 || !/^[A-Za-z0-9_-]+$/.test(idempotencyKey))
    )
      throw new BadRequestException({
        error: 'IDEMPOTENCY_KEY_INVALID',
        message: 'Idempotency-Key không hợp lệ.',
      });
    const scope = taiKhoanId
      ? `account:${taiKhoanId}`
      : `guest:${createHash('sha256').update(normalizePhone(dto.sender.phoneNumber)).digest('hex')}`;
    const hash = createHash('sha256').update(JSON.stringify(dto)).digest('hex');
    if (idempotencyKey) {
      const replay = await this.prisma.yeuCauTaoPhieuGuiHang.findUnique({
        where: { phamVi_key: { phamVi: scope, key: idempotencyKey } },
      });
      if (replay) {
        if (replay.payloadHash !== hash)
          throw new ConflictException({
            error: 'IDEMPOTENCY_KEY_CONFLICT',
            message: 'Khóa đã được sử dụng cho nội dung khác.',
          });
        return replay.ketQua as unknown as Omit<
          Awaited<ReturnType<ShipmentsService['getShipmentDetail']>>,
          'timeline' | 'pricing'
        > & {
          pricing: {
            baseFee: number;
            serviceFee: number;
            discount: number;
            totalFee: number;
          };
        };
      }
    }
    if (!dto.items || dto.items.length === 0) {
      throw new BadRequestException({
        error: 'EMPTY_CARGO_ITEMS',
        message: 'Vui lòng nhập ít nhất một kiện hàng cần gửi.',
      });
    }

    const now = new Date();
    const sendDate =
      dto.tripId === undefined
        ? this.validateSendDate(dto.sendDate!, now)
        : null;
    const legacyTrip =
      dto.tripId === undefined
        ? null
        : await this.prisma.chuyenXe.findUnique({
            where: { chuyenXeId: dto.tripId },
            include: {
              tuyenXe: { include: { nhaXe: true } },
              xe: { include: { loaiXe: true } },
            },
          });
    if (dto.tripId !== undefined && !legacyTrip)
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe tiếp nhận hàng.',
      });
    const route =
      legacyTrip?.tuyenXe ??
      (await this.requireAvailableRoute(dto.routeId!, sendDate!));
    const trip = legacyTrip ?? {
      chuyenXeId: null,
      tuyenXeId: route.tuyenXeId,
      nhaXeId: route.nhaXeId,
      tuyenXe: route,
      maChuyenXe: null,
      xe: null,
    };
    const departureAt = legacyTrip
      ? combineDeparture(
          legacyTrip.ngayKhoiHanh,
          legacyTrip.gioKhoiHanh,
          this.businessTimeZone,
        )
      : null;
    if (legacyTrip) {
      if (!legacyTrip.nhanGuiHang) {
        throw new ConflictException({
          error: 'TRIP_DOES_NOT_ACCEPT_CARGO',
          message: 'Chuyến xe không hỗ trợ nhận gửi hàng.',
        });
      }
      if (
        legacyTrip.trangThai !== 'CHUA_KHOI_HANH' ||
        departureAt! <= now
      ) {
        throw new ConflictException({
          error: 'TRIP_NOT_AVAILABLE',
          message: 'Chuyến xe không mở nhận hàng hoặc đã khởi hành.',
        });
      }
    }

    const senderPhone = normalizePhone(dto.sender.phoneNumber);
    const receiverPhone = normalizePhone(dto.receiver.phoneNumber);

    try {
      return await this.prisma.$transaction(async (tx) => {
        if (idempotencyKey)
          await tx.yeuCauTaoPhieuGuiHang.create({
            data: {
              phamVi: scope,
              key: idempotencyKey,
              payloadHash: hash,
              hetHanLuc: new Date(now.getTime() + 7 * 86400000),
            },
          });
        if (trip.chuyenXeId !== null)
          await this.cargoCapacityService.lockTrip(tx, trip.chuyenXeId);

        const pricing = await this.cargoPricingService.calculate(
          tx,
          {
            chuyenXeId: trip.chuyenXeId ?? undefined,
            tuyenXeId: trip.tuyenXeId,
            nhaXeId: trip.nhaXeId,
            ngayKhoiHanh: legacyTrip?.ngayKhoiHanh ?? sendDate!,
          },
          {
            senderPointId: dto.senderPointId,
            receiverPointId: dto.receiverPointId,
            isFragile:
              dto.isFragile ??
              dto.items.some((i) => i.serviceType === 'FRAGILE'),
            isValuable:
              dto.isValuable ??
              dto.items.some((i) => i.serviceType === 'VALUABLE'),
            items: dto.items.map((item) => ({
              name: item.name,
              quantity: item.quantity,
              weight: item.weight,
              categoryName: item.category,
              loaiHangHoaId: item.loaiHangHoaId,
              length: item.length,
              width: item.width,
              height: item.height,
              serviceType: item.serviceType,
            })),
          },
        );
        const diemGuiId = pricing.senderPointId;
        const diemNhanId = pricing.receiverPointId;
        const cuocChinh = pricing.baseFee;
        const phiDichVu = pricing.serviceFee;
        const tongPhi = pricing.totalFee;

        if (trip.chuyenXeId !== null) {
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
        }
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

        const freightPayer = dto.freightPayer ?? 'NGUOI_GUI';
        const paymentMethod =
          dto.paymentMethod ??
          (freightPayer === 'NGUOI_NHAN' ? 'TAI_BEN' : 'ONLINE');
        const isOnlinePayment =
          paymentMethod === 'ONLINE' && freightPayer !== 'NGUOI_NHAN';

        let paymentAttempt: { thanhToanId: number; trangThai: string };
        let paymentExpiresAt: Date;

        if (isOnlinePayment) {
          paymentAttempt = await createSepayPaymentAttempt(tx, {
            donGiaoDichId: donGiaoDich.donGiaoDichId,
            amount: tongPhi,
            createdAt: now,
          });
          paymentExpiresAt = getBookingPaymentDeadline(donGiaoDich.ngayTao);
        } else {
          paymentAttempt = await tx.thanhToan.create({
            data: {
              soTien: tongPhi,
              phuongThuc: 'TAI_BEN',
              loaiGiaoDich: 'THANH_TOAN',
              thoiGian: now,
              trangThai:
                freightPayer === 'NGUOI_NHAN' ? 'CHO_THANH_TOAN' : 'DANG_XU_LY',
              donGiaoDichId: donGiaoDich.donGiaoDichId,
            },
            select: { thanhToanId: true, trangThai: true },
          });
          paymentExpiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);
        }

        const receiverCccd = dto.receiver.cccd?.trim() || null;
        const combinedNote =
          [
            receiverCccd ? `[CCCD người nhận: ${receiverCccd}]` : '',
            dto.note?.trim() || '',
          ]
            .filter(Boolean)
            .join(' ') || null;

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
            payer: freightPayer,
            note: combinedNote,
            tripId: trip.chuyenXeId,
            routeId: route.tuyenXeId,
            expectedSendDate: sendDate,
            dropoffDeadline: legacyTrip
              ? null
              : new Date(now.getTime() + 48 * 3600000),
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
                declaredWeight: item.weight,
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

        const result = {
          dropoffDeadline: legacyTrip
            ? null
            : new Date(now.getTime() + 48 * 3600000).toISOString(),
          expectedSendDate: sendDate ? dto.sendDate! : null,
          shipmentId: phieuGui.phieuGuiHangId,
          orderId: donGiaoDich.donGiaoDichId,
          paymentId: paymentAttempt.thanhToanId,
          paymentExpiresAt: paymentExpiresAt.toISOString(),
          paymentMethod: isOnlinePayment ? 'ONLINE' : 'TAI_BEN',
          freightPayer,
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
            cccd: receiverCccd,
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
            departureTime: departureAt?.toISOString() ?? null,
            route: {
              origin: trip.tuyenXe.diemDi,
              destination: trip.tuyenXe.diemDen,
            },
            busCompany: {
              id: trip.tuyenXe.nhaXe.nhaXeId,
              name: trip.tuyenXe.nhaXe.tenNhaXe,
            },
            vehicle: trip.xe ? { licensePlate: trip.xe.bienSoXe } : null,
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
        if (idempotencyKey)
          await tx.yeuCauTaoPhieuGuiHang.update({
            where: { phamVi_key: { phamVi: scope, key: idempotencyKey } },
            data: {
              phieuGuiHangId: phieuGui.phieuGuiHangId,
              ketQua: JSON.parse(
                JSON.stringify(result),
              ) as Prisma.InputJsonValue,
            },
          });
        return result;
      });
    } catch (error: unknown) {
      // A concurrent writer may win the unique key after the initial replay read.
      if (
        idempotencyKey &&
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const replay = await this.prisma.yeuCauTaoPhieuGuiHang.findUnique({
          where: { phamVi_key: { phamVi: scope, key: idempotencyKey } },
        });
        if (replay?.ketQua) {
          if (replay.payloadHash !== hash)
            throw new ConflictException({
              error: 'IDEMPOTENCY_KEY_CONFLICT',
              message: 'Khóa đã được sử dụng cho nội dung khác.',
            });
          return replay.ketQua as unknown as Omit<
            Awaited<ReturnType<ShipmentsService['getShipmentDetail']>>,
            'timeline' | 'pricing'
          > & {
            pricing: {
              baseFee: number;
              serviceFee: number;
              discount: number;
              totalFee: number;
            };
          };
        }
      }
      throw error;
    }
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
        tuyenXe: { include: { nhaXe: true } },
        hanMangHangDen: true,
        ngayDuKienGui: true,
        maVanDon: true,
        trangThai: true,
        soDienThoaiNguoiNhan: true,
        nguoiTraCuoc: true,
        donGiaoDich: {
          select: {
            donGiaoDichId: true,
            maDonGiaoDich: true,
            soDienThoaiKhachHang: true,
            phieuDatVe: {
              select: {
                khuyenMai: { select: { maKhuyenMai: true } },
              },
            },
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
        message:
          'Không tìm thấy phiếu gửi hàng khớp với mã vận đơn đã cung cấp.',
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

    const departureAt = shipment.chuyenXe
      ? combineDeparture(
          shipment.chuyenXe.ngayKhoiHanh,
          shipment.chuyenXe.gioKhoiHanh,
          this.businessTimeZone,
        )
      : null;
    const estimatedArrivalAt = shipment.chuyenXe
      ? computeArrival(
          shipment.chuyenXe.ngayKhoiHanh,
          shipment.chuyenXe.gioKhoiHanh,
          shipment.chuyenXe.tuyenXe.thoiGianChayPhut,
          shipment.chuyenXe.gioDen,
          this.businessTimeZone,
        )
      : null;
    const latestPayment = shipment.donGiaoDich.thanhToans[0] ?? null;
    const additionalSePayTransfer = await this.prisma.thanhToan.findFirst({
      where: {
        donGiaoDichId: shipment.donGiaoDich.donGiaoDichId,
        phuongThuc: 'SEPAY',
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'CAN_DOI_SOAT',
        maGiaoDichSePay: { not: null },
      },
      select: { phuongThuc: true, trangThai: true },
      orderBy: [{ thoiGian: 'desc' }, { thanhToanId: 'desc' }],
    });
    const isCounterPayment =
      shipment.nguoiTraCuoc === 'NGUOI_NHAN' ||
      latestPayment?.phuongThuc === 'TAI_BEN';
    const paymentExpiresAt = isCounterPayment
      ? new Date(shipment.donGiaoDich.ngayTao.getTime() + 48 * 60 * 60 * 1000)
      : getBookingPaymentDeadline(shipment.donGiaoDich.ngayTao);
    const paymentExpired =
      !isCounterPayment &&
      shipment.donGiaoDich.trangThai === 'CHO_THANH_TOAN' &&
      latestPayment?.trangThai === 'DANG_XU_LY' &&
      paymentExpiresAt <= new Date();

    return {
      waybillCode: shipment.maVanDon,
      status: shipment.trangThai,
      freightPayer: shipment.nguoiTraCuoc,
      orderCode: shipment.donGiaoDich.maDonGiaoDich,
      amount: Number(shipment.donGiaoDich.tongTien),
      orderStatus: shipment.donGiaoDich.trangThai,
      paymentStatus: paymentExpired
        ? 'HET_HAN'
        : (additionalSePayTransfer?.trangThai ??
          latestPayment?.trangThai ??
          null),
      requiresReconciliation:
        Boolean(additionalSePayTransfer) ||
        (latestPayment?.trangThai === 'THANH_CONG' &&
          (['DA_HUY', 'HUY'].includes(shipment.donGiaoDich.trangThai) ||
            shipment.trangThai === 'DA_HUY')),
      paymentMethod:
        additionalSePayTransfer?.phuongThuc ??
        latestPayment?.phuongThuc ??
        null,
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
      carrier: {
        name:
          (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.nhaXe.tenNhaXe ??
          '',
      },
      route: {
        origin: (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.diemDi ?? '',
        destination:
          (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.diemDen ?? '',
      },
      scheduledDepartureAt: departureAt?.toISOString() ?? null,
      dropoffDeadline: shipment.hanMangHangDen?.toISOString() ?? null,
      expectedSendDate:
        shipment.ngayDuKienGui
          ?.toISOString()
          .slice(0, 10)
          .split('-')
          .reverse()
          .join('-') ?? null,
      estimatedArrivalAt,
      packageCount: shipment.hangHoas.reduce(
        (total, item) => total + item.soLuong,
        0,
      ),
      bookingPromotionCode:
        shipment.donGiaoDich.phieuDatVe?.khuyenMai?.maKhuyenMai ?? null,
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

    const departureAt = shipment.chuyenXe
      ? combineDeparture(
          shipment.chuyenXe.ngayKhoiHanh,
          shipment.chuyenXe.gioKhoiHanh,
          this.businessTimeZone,
        )
      : null;
    const latestPayment = shipment.donGiaoDich.thanhToans?.[0] ?? null;
    const isCounterPayment =
      shipment.nguoiTraCuoc === 'NGUOI_NHAN' ||
      latestPayment?.phuongThuc === 'TAI_BEN';
    const paymentExpiresAt = isCounterPayment
      ? new Date(shipment.donGiaoDich.ngayTao.getTime() + 48 * 60 * 60 * 1000)
      : getBookingPaymentDeadline(shipment.donGiaoDich.ngayTao);

    return {
      shipmentId: shipment.phieuGuiHangId,
      orderId: shipment.donGiaoDich.donGiaoDichId,
      paymentId: latestPayment?.thanhToanId ?? 0,
      paymentExpiresAt: paymentExpiresAt.toISOString(),
      paymentMethod:
        latestPayment?.phuongThuc ?? (isCounterPayment ? 'TAI_BEN' : 'ONLINE'),
      freightPayer: shipment.nguoiTraCuoc,
      waybillCode: shipment.maVanDon,
      orderCode: shipment.donGiaoDich.maDonGiaoDich,
      status: shipment.trangThai,
      paymentStatus: shipment.donGiaoDich.trangThai,
      dropoffDeadline: shipment.hanMangHangDen?.toISOString() ?? null,
      expectedSendDate:
        shipment.ngayDuKienGui
          ?.toISOString()
          .slice(0, 10)
          .split('-')
          .reverse()
          .join('-') ?? null,
      sentAt: shipment.ngayGui.toISOString(),
      pricing: {
        baseFee: Number(shipment.cuocChinh),
        serviceFee: Number(shipment.phiDichVu),
        discount: Number(shipment.soTienGiam),
        totalFee: Number(shipment.tongPhi),
        estimatedFee:
          shipment.cuocDuTinh == null ? null : Number(shipment.cuocDuTinh),
        confirmedAt: shipment.thoiDiemXacNhanCuoc?.toISOString() ?? null,
        paidAmount: this.paidAmount(shipment.donGiaoDich.thanhToans).toNumber(),
        outstandingAmount: Prisma.Decimal.max(
          0,
          new Prisma.Decimal(shipment.donGiaoDich.tongTien).minus(
            this.paidAmount(shipment.donGiaoDich.thanhToans),
          ),
        ).toNumber(),
      },
      sender: {
        fullName: shipment.donGiaoDich.tenKhachHang,
        phoneNumber: shipment.donGiaoDich.soDienThoaiKhachHang,
        email: shipment.donGiaoDich.emailKhachHang,
      },
      receiver: {
        fullName: shipment.tenNguoiNhan,
        phoneNumber: shipment.soDienThoaiNguoiNhan,
        cccd: extractReceiverCccd(shipment.ghiChu),
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
        tripId: shipment.chuyenXe?.chuyenXeId ?? null,
        code: shipment.chuyenXe?.maChuyenXe ?? null,
        departureTime: departureAt?.toISOString() ?? null,
        route: {
          origin:
            (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.diemDi ?? '',
          destination:
            (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.diemDen ?? '',
        },
        busCompany: {
          id: shipment.donGiaoDich.nhaXeId,
          name:
            (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.nhaXe.tenNhaXe ??
            '',
        },
        vehicle: shipment.chuyenXe
          ? { licensePlate: shipment.chuyenXe.xe.bienSoXe }
          : null,
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

  async findAll(
    query: ShipmentQueryDto,
    principal: AuthPrincipal,
  ): Promise<{
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
        ...this.shipmentOperationalInfo(record),
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
        trip: record.chuyenXe
          ? {
              tripId: record.chuyenXe.chuyenXeId,
              code: record.chuyenXe.maChuyenXe,
              departureDate: formatTripDate(record.chuyenXe.ngayKhoiHanh),
              departureTime: formatTripTime(record.chuyenXe.gioKhoiHanh),
            }
          : null,
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
        paymentExpiresAt: getBookingPaymentDeadline(
          shipment.donGiaoDich.ngayTao,
        ).toISOString(),
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
          tripId: shipment.chuyenXe?.chuyenXeId ?? null,
          code: shipment.chuyenXe?.maChuyenXe ?? null,
          route: `${(shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.diemDi ?? ''} → ${(shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.diemDen ?? ''}`,
          busCompany:
            (shipment.tuyenXe ?? shipment.chuyenXe?.tuyenXe)?.nhaXe.tenNhaXe ??
            '',
        },
        itemsCount: shipment.hangHoas.length,
      })),
      meta: page.meta,
    };
  }

  async findOne(id: number, principal: AuthPrincipal) {
    const tenantId = requireTenantPrincipal(principal);
    const record = await this.findShipmentDetailRecord(id);
    if (!record || !this.isShipmentInTenant(record, tenantId)) {
      throw new NotFoundException({
        error: 'SHIPMENT_NOT_FOUND',
        message: 'Không tìm thấy phiếu gửi hàng.',
      });
    }

    const data = {
      shipmentId: record.phieuGuiHangId,
      waybillCode: record.maVanDon,
      ...this.shipmentOperationalInfo(record),
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
      trip: record.chuyenXe
        ? {
            tripId: record.chuyenXe.chuyenXeId,
            code: record.chuyenXe.maChuyenXe,
            departureDate: formatTripDate(record.chuyenXe.ngayKhoiHanh),
            departureTime: formatTripTime(record.chuyenXe.gioKhoiHanh),
          }
        : null,
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
        declaredWeightKg:
          item.khoiLuongKhaiBao == null ? null : Number(item.khoiLuongKhaiBao),
        actualWeightKg:
          item.khoiLuongThucTe == null ? null : Number(item.khoiLuongThucTe),
        quantity: item.soLuong,
        dimensions:
          item.chieuDai != null &&
          item.chieuRong != null &&
          item.chieuCao != null
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
        estimatedFee:
          record.cuocDuTinh == null ? null : Number(record.cuocDuTinh),
        confirmedAt: record.thoiDiemXacNhanCuoc?.toISOString() ?? null,
        paidAmount: this.paidAmount(record.donGiaoDich.thanhToans).toNumber(),
        outstandingAmount: Prisma.Decimal.max(
          0,
          new Prisma.Decimal(record.donGiaoDich.tongTien).minus(
            this.paidAmount(record.donGiaoDich.thanhToans),
          ),
        ).toNumber(),
        freightPayer: record.nguoiTraCuoc,
      },
      history: record.lichSuTrangThais.map((history): ShipmentHistoryItem => ({
        historyId: history.lichSuTrangThaiId,
        status: history.trangThai,
        time: history.thoiGian.toISOString(),
        note: history.ghiChu ?? null,
        actor: history.taiKhoan
          ? {
              accountId: history.taiKhoan.taiKhoanId,
              fullName: history.taiKhoan.hoTen ?? 'Người dùng',
            }
          : null,
      })),
      pricingHistory: (record.lichSuCuocs ?? []).map((log) => ({
        id: log.lichSuDieuChinhCuocGuiHangId,
        action: log.loaiThaoTac,
        beforeFee: log.cuocTruoc == null ? null : Number(log.cuocTruoc),
        afterFee: Number(log.cuocSau),
        note: log.lyDo,
        time: log.thoiGian.toISOString(),
        actor: log.taiKhoan
          ? { accountId: log.taiKhoanId, fullName: log.taiKhoan.hoTen ?? 'Người dùng' }
          : null,
      })),
      assignmentHistory: (record.lichSuPhanChuyens ?? []).map((log) => ({
        id: log.lichSuPhanChuyenGuiHangId,
        previousTripId: log.chuyenXeTruocId,
        tripId: log.chuyenXeSauId,
        note: log.lyDo,
        time: log.thoiGian.toISOString(),
        actor: log.taiKhoan
          ? { accountId: log.taiKhoanId, fullName: log.taiKhoan.hoTen ?? 'Người dùng' }
          : null,
      })),
      moneyCases: (record.xuLyTiens ?? []).map((item) => ({
        id: item.xuLyTienGuiHangId,
        reason: item.lyDo,
        amount: Number(item.soTien),
        status: item.trangThai,
        outcome: item.ketQua?.split(':')[0] ?? null,
        note: item.ketQua,
        reference: item.thamChieu,
        resolvedAt: item.thoiDiemXuLy?.toISOString() ?? null,
      })),
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
        { OR: [{ chuyenXeId: null }, { chuyenXe: { nhaXeId: tenantId } }] },
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
      chuyenXe: { nhaXeId: number } | null;
      diemGui: { nhaXeId: number };
      diemNhan: { nhaXeId: number };
    },
    tenantId: number,
  ): boolean {
    return (
      shipment.donGiaoDich.nhaXeId === tenantId &&
      (!shipment.chuyenXe || shipment.chuyenXe.nhaXeId === tenantId) &&
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
    if (dto.status === 'DA_HUY' && !dto.note?.trim()) {
      throw new BadRequestException({
        error: 'CANCELLATION_REASON_REQUIRED',
        message: 'Vui lòng nhập lý do từ chối / hủy phiếu gửi hàng.',
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
              donGiaoDichId: true,
              nhaXeId: true,
              trangThai: true,
              phieuDatVe: { select: { phieuDatVeId: true } },
              thanhToans: {
                select: {
                  loaiGiaoDich: true,
                  trangThai: true,
                  phuongThuc: true,
                  soTien: true,
                },
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
        MOI_TAO: ['DA_TIEP_NHAN', 'DA_HUY'],
        DA_TIEP_NHAN: ['DANG_VAN_CHUYEN', 'DA_HUY'],
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

      const now = new Date();

      if (targetStatus === 'DA_HUY') {
        if (shipment.donGiaoDich.phieuDatVe)
          throw new ConflictException({
            error: 'BOOKING_SHIPMENT_TRIP_FIXED',
            message: 'Vui lòng xử lý hàng kèm vé qua nghiệp vụ đặt vé.',
          });
        const paid = this.paidAmount(shipment.donGiaoDich.thanhToans);
        if (paid.greaterThan(0))
          await tx.xuLyTienGuiHang.upsert({
            where: { khoaSuKien: `shipment:${id}:cancelled` },
            create: {
              khoaSuKien: `shipment:${id}:cancelled`,
              phieuGuiHangId: id,
              lyDo: 'HUY_DA_THANH_TOAN',
              soTien: paid,
            },
            update: {},
          });
        await tx.donGiaoDich.updateMany({
          where: {
            donGiaoDichId: shipment.donGiaoDich.donGiaoDichId,
          },
          data: { trangThai: 'DA_HUY' },
        });
        await tx.thanhToan.updateMany({
          where: {
            donGiaoDichId: shipment.donGiaoDich.donGiaoDichId,
            trangThai: { in: ['DANG_XU_LY', 'CHO_THANH_TOAN'] },
          },
          data: { trangThai: 'THAT_BAI' },
        });
      } else {
        const hasSuccessfulCharge = shipment.donGiaoDich.thanhToans.some(
          (payment) =>
            payment.loaiGiaoDich !== 'HOAN_TIEN' &&
            (payment.trangThai === 'THANH_CONG' ||
              payment.trangThai === 'DA_THANH_TOAN'),
        );
        const isRecipientPaying = shipment.nguoiTraCuoc === 'NGUOI_NHAN';

        if (targetStatus === 'DA_TIEP_NHAN' && shipment.hanMangHangDen)
          throw new ConflictException({
            error: 'SHIPMENT_ACCEPTANCE_REQUIRED',
            message: 'Vui lòng cân đo và chốt cước qua thao tác tiếp nhận.',
          });
        if (
          targetStatus === 'DA_TIEP_NHAN' &&
          !shipment.hanMangHangDen &&
          !hasSuccessfulCharge &&
          !isRecipientPaying
        ) {
          throw new ConflictException({
            error: 'SHIPMENT_PAYMENT_NOT_CONFIRMED',
            message:
              'Chỉ được cập nhật trạng thái vận chuyển sau khi đơn đã thanh toán.',
          });
        }
        if (targetStatus === 'DANG_VAN_CHUYEN' && !shipment.chuyenXeId)
          throw new ConflictException({
            error: 'SHIPMENT_ASSIGNMENT_REQUIRED',
            message: 'Cần phân chuyến trước khi vận chuyển.',
          });
        if (
          ((targetStatus === 'DANG_VAN_CHUYEN' && !isRecipientPaying) ||
            targetStatus === 'DA_GIAO') &&
          (!hasSuccessfulCharge ||
            shipment.donGiaoDich.trangThai !== 'DA_THANH_TOAN')
        )
          throw new ConflictException({
            error: 'SHIPMENT_PAYMENT_NOT_CONFIRMED',
            message: 'Vui lòng xác nhận thu đủ tiền qua thao tác thu tiền.',
          });
      }

      const updated = await tx.phieuGuiHang.updateMany({
        where: {
          phieuGuiHangId: id,
          trangThai: currentStatus,
          donGiaoDich: { nhaXeId: tenantId },
          OR: [{ chuyenXeId: null }, { chuyenXe: { nhaXeId: tenantId } }],
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
        message:
          'SUPER_ADMIN không có phạm vi dữ liệu vận hành phiếu gửi hàng.',
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
      chuyenXe: { nhaXeId: number } | null;
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
