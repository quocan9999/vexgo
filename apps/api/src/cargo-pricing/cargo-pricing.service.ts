import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { assertValidCargoDimensions } from './cargo-dimensions.validation.js';

type CapacityGroup = 'XE_MAY' | 'HANG_CONG_KENH' | 'HANG_NHE';

export interface CargoPricingTrip {
  chuyenXeId: number;
  tuyenXeId: number;
  nhaXeId: number;
  ngayKhoiHanh: Date;
}

export interface CargoPricingItemInput {
  name: string;
  quantity: number;
  weight: number | Prisma.Decimal;
  physicalType?: string;
  categoryName?: string;
  loaiHangHoaId?: number;
  length?: number;
  width?: number;
  height?: number;
  serviceType?: 'NORMAL' | 'FRAGILE' | 'VALUABLE';
}

export interface CargoPricingInput {
  items: CargoPricingItemInput[];
  senderPointId?: number;
  receiverPointId?: number;
  isFragile?: boolean;
  isValuable?: boolean;
  bookingLimits?: {
    maxNonVehiclePackageWeightKg?: number;
    maxNonVehicleDimensionsCm?: {
      length: number;
      width: number;
      height: number;
    };
  };
}

export interface CargoPricingResult {
  senderPointId: number;
  receiverPointId: number;
  items: Array<{
    input: CargoPricingItemInput;
    loaiHangHoa: {
      loaiHangHoaId: number;
      tenLoai: string;
      nhomSucChua: string;
    };
    effectiveUnitWeight: Prisma.Decimal;
    totalWeight: Prisma.Decimal;
  }>;
  rates: Array<{
    loaiHangHoaId: number;
    bangCuocGuiHangId: number;
    totalWeight: Prisma.Decimal;
    fee: Prisma.Decimal;
  }>;
  baseFee: Prisma.Decimal;
  serviceFee: Prisma.Decimal;
  totalFee: Prisma.Decimal;
}

const SURCHARGE_FRAGILE = new Prisma.Decimal(20_000);
const SURCHARGE_VALUABLE = new Prisma.Decimal(50_000);

function throwConflict(error: string, message: string): never {
  throw new ConflictException({ error, message });
}

function normalizeText(value: string): string {
  return value.trim().toLocaleUpperCase('vi-VN');
}

function getCapacityGroupHint(
  physicalType: string | undefined,
  effectiveUnitWeight: Prisma.Decimal,
): CapacityGroup {
  const normalized = normalizeText(physicalType ?? '');
  if (normalized.includes('XE MÁY') || normalized.includes('MOTORCYCLE')) {
    return 'XE_MAY';
  }
  if (
    normalized.includes('XE ĐẠP') ||
    normalized.includes('BICYCLE') ||
    normalized.includes('CỒNG KỀNH') ||
    normalized.includes('CONG KENH') ||
    normalized === 'HANG_CONG_KENH'
  ) {
    return 'HANG_CONG_KENH';
  }
  if (normalized.includes('HÀNG NHẸ') || normalized === 'HANG_NHE') {
    return 'HANG_NHE';
  }
  return effectiveUnitWeight.greaterThanOrEqualTo(20) &&
    effectiveUnitWeight.lessThanOrEqualTo(40)
    ? 'HANG_CONG_KENH'
    : 'HANG_NHE';
}

@Injectable()
export class CargoPricingService {
  async calculate(
    tx: Prisma.TransactionClient,
    trip: CargoPricingTrip,
    input: CargoPricingInput,
  ): Promise<CargoPricingResult> {
    if (input.items.length === 0) {
      throw new BadRequestException({
        error: 'EMPTY_CARGO_ITEMS',
        message: 'Vui lòng nhập ít nhất một kiện hàng cần gửi.',
      });
    }

    for (const item of input.items) {
      assertValidCargoDimensions(item.name, item);
    }

    const routePoints = await tx.diemGiaoNhanTuyenXe.findMany({
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
        point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
        point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId &&
        (point.vaiTro === 'GUI_HANG' || point.vaiTro === 'CA_HAI'),
    );
    const receiverCandidates = routePoints.filter(
      (point) =>
        point.diemGiaoNhanHang.trangThai === 'HOAT_DONG' &&
        point.diemGiaoNhanHang.nhaXeId === trip.nhaXeId &&
        (point.vaiTro === 'NHAN_HANG' || point.vaiTro === 'CA_HAI'),
    );

    const resolvePoint = (
      requestedId: number | undefined,
      candidates: typeof routePoints,
      role: 'gửi' | 'nhận',
    ): number => {
      if (candidates.length === 0) {
        return throwConflict(
          'SHIPMENT_POINTS_NOT_CONFIGURED',
          'Tuyến xe chưa được cấu hình điểm gửi/nhận hàng hợp lệ.',
        );
      }
      if (requestedId !== undefined) {
        const point = candidates.find(
          (candidate) => candidate.diemGiaoNhanHangId === requestedId,
        );
        if (!point) {
          return throwConflict(
            'SHIPMENT_POINT_INVALID',
            `Điểm ${role} không hoạt động hoặc không thuộc tuyến/nhà xe của chuyến xe.`,
          );
        }
        return point.diemGiaoNhanHangId;
      }
      if (candidates.length !== 1) {
        return throwConflict(
          'SHIPMENT_POINT_REQUIRED',
          `Vui lòng chọn điểm ${role} hàng trên tuyến xe.`,
        );
      }
      return candidates[0].diemGiaoNhanHangId;
    };

    const senderPointId = resolvePoint(
      input.senderPointId,
      senderCandidates,
      'gửi',
    );
    const receiverPointId = resolvePoint(
      input.receiverPointId,
      receiverCandidates,
      'nhận',
    );
    if (senderPointId === receiverPointId) {
      return throwConflict(
        'SHIPMENT_POINTS_MUST_DIFFER',
        'Điểm gửi và điểm nhận hàng phải khác nhau.',
      );
    }

    const cargoTypes = await tx.loaiHangHoa.findMany({
      where: { trangThai: 'HOAT_DONG' },
      select: {
        loaiHangHoaId: true,
        tenLoai: true,
        nhomSucChua: true,
        trangThai: true,
      },
    });
    if (cargoTypes.length === 0) {
      return throwConflict(
        'CARGO_TYPE_NOT_CONFIGURED',
        'Hệ thống chưa cấu hình danh mục loại hàng hóa.',
      );
    }

    const resolvedItems: CargoPricingResult['items'] = [];
    const weightsByType = new Map<number, Prisma.Decimal>();
    let hasFragile = Boolean(input.isFragile);
    let hasValuable = Boolean(input.isValuable);

    for (const item of input.items) {
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        throw new BadRequestException({
          error: 'CARGO_QUANTITY_INVALID',
          message: `Số lượng hàng "${item.name}" không hợp lệ.`,
        });
      }

      let unitWeight = new Prisma.Decimal(item.weight);
      if (!unitWeight.isFinite() || unitWeight.isNegative()) {
        throw new BadRequestException({
          error: 'CARGO_WEIGHT_INVALID',
          message: `Khối lượng hàng "${item.name}" không hợp lệ.`,
        });
      }
      const normalizedPhysicalType = normalizeText(item.physicalType ?? '');
      if (unitWeight.isZero() && normalizedPhysicalType.includes('XE MÁY')) {
        unitWeight = new Prisma.Decimal(100);
      } else if (
        unitWeight.isZero() &&
        (normalizedPhysicalType.includes('XE ĐẠP') ||
          normalizedPhysicalType.includes('BICYCLE'))
      ) {
        unitWeight = new Prisma.Decimal(15);
      }

      const dimensions = [item.length, item.width, item.height];
      let volumetricWeight = new Prisma.Decimal(0);
      const isVehicle =
        normalizedPhysicalType.includes('XE MÁY') ||
        normalizedPhysicalType.includes('MOTORCYCLE') ||
        normalizedPhysicalType.includes('XE ĐẠP') ||
        normalizedPhysicalType.includes('BICYCLE');
      if (
        !isVehicle &&
        dimensions.every((dimension) => dimension !== undefined && dimension > 0)
      ) {
        volumetricWeight = new Prisma.Decimal(item.length!)
          .times(item.width!)
          .times(item.height!)
          .div(5000)
          .toDecimalPlaces(1, Prisma.Decimal.ROUND_HALF_UP);
      }
      if (volumetricWeight.greaterThan(unitWeight)) {
        unitWeight = volumetricWeight;
      }
      if (unitWeight.isZero()) {
        throw new BadRequestException({
          error: 'CARGO_WEIGHT_INVALID',
          message: `Khối lượng hàng "${item.name}" phải lớn hơn 0.`,
        });
      }

      const totalWeight = unitWeight.times(item.quantity);
      if (!isVehicle && input.bookingLimits?.maxNonVehicleDimensionsCm) {
        const limits = input.bookingLimits.maxNonVehicleDimensionsCm;
        if (
          (item.length !== undefined && item.length > limits.length) ||
          (item.width !== undefined && item.width > limits.width) ||
          (item.height !== undefined && item.height > limits.height)
        ) {
          throw new BadRequestException({
            error: 'CARGO_DIMENSIONS_EXCEEDED',
            message:
              `Kích thước món "${item.name}" vượt quá quy định hầm xe khách (Dài ≤ ${limits.length}cm, Rộng ≤ ${limits.width}cm, Cao ≤ ${limits.height}cm).`,
          });
        }
      }
      const maxPackageWeight = input.bookingLimits?.maxNonVehiclePackageWeightKg;
      if (
        !isVehicle &&
        maxPackageWeight !== undefined &&
        totalWeight.greaterThan(maxPackageWeight)
      ) {
        throw new BadRequestException({
          error: 'CARGO_WEIGHT_EXCEEDED',
          message:
            `Hành lý "${item.name}" có khối lượng (${totalWeight.toString()}kg) vượt quá hạn mức tối đa ${maxPackageWeight}kg đi kèm vé. Quý khách vui lòng tạo đơn gửi hàng riêng tại mục Gửi hàng bưu kiện.`,
        });
      }

      const inferredGroup = getCapacityGroupHint(item.physicalType, unitWeight);
      const groupHint =
        item.physicalType !== undefined ||
        (item.loaiHangHoaId === undefined && item.categoryName === undefined)
          ? inferredGroup
          : undefined;
      let cargoType = item.loaiHangHoaId === undefined
        ? undefined
        : cargoTypes.find((type) => type.loaiHangHoaId === item.loaiHangHoaId);
      if (item.loaiHangHoaId !== undefined && !cargoType) {
        return throwConflict(
          'CARGO_TYPE_INVALID',
          `Loại hàng hóa của "${item.name}" không tồn tại hoặc đã ngừng hoạt động.`,
        );
      }

      if (!cargoType && item.categoryName) {
        const normalizedCategory = normalizeText(item.categoryName);
        const exactMatches = cargoTypes.filter(
          (type) => normalizeText(type.tenLoai) === normalizedCategory,
        );
        if (exactMatches.length > 1) {
          return throwConflict(
            'CARGO_TYPE_REQUIRED',
            `Danh mục "${item.categoryName}" không duy nhất; vui lòng chọn loại hàng hóa cụ thể.`,
          );
        }
        if (exactMatches.length === 1) {
          cargoType = exactMatches[0];
        } else {
          const group = cargoTypes.filter(
            (type) => type.nhomSucChua === normalizedCategory,
          );
          if (group.length > 1) {
            return throwConflict(
              'CARGO_TYPE_REQUIRED',
              `Nhóm "${item.categoryName}" có nhiều loại hàng; vui lòng chọn loại cụ thể.`,
            );
          }
          cargoType = group[0];
        }
        if (!cargoType) {
          return throwConflict(
            'CARGO_TYPE_NOT_FOUND',
            `Không tìm thấy loại hàng hóa "${item.categoryName}".`,
          );
        }
      }

      if (!cargoType) {
        const matchingGroup = cargoTypes.filter(
          (type) => type.nhomSucChua === inferredGroup,
        );
        if (matchingGroup.length > 1) {
          return throwConflict(
            'CARGO_TYPE_REQUIRED',
            `Có nhiều loại hàng thuộc nhóm ${groupHint}; vui lòng chọn loại hàng cụ thể.`,
          );
        }
        cargoType = matchingGroup[0];
      }
      if (!cargoType) {
        return throwConflict(
          'CARGO_TYPE_NOT_FOUND',
          `Không tìm thấy loại hàng phù hợp cho món: ${item.name}.`,
        );
      }
      if (groupHint !== undefined && cargoType.nhomSucChua !== groupHint) {
        return throwConflict(
          'CARGO_TYPE_INVALID',
          `Loại hàng "${cargoType.tenLoai}" không phù hợp với nhóm chứa của "${item.name}".`,
        );
      }

      resolvedItems.push({
        input: item,
        loaiHangHoa: {
          loaiHangHoaId: cargoType.loaiHangHoaId,
          tenLoai: cargoType.tenLoai,
          nhomSucChua: cargoType.nhomSucChua,
        },
        effectiveUnitWeight: unitWeight,
        totalWeight,
      });
      weightsByType.set(
        cargoType.loaiHangHoaId,
        (weightsByType.get(cargoType.loaiHangHoaId) ?? new Prisma.Decimal(0)).plus(
          totalWeight,
        ),
      );
      hasFragile ||= item.serviceType === 'FRAGILE';
      hasValuable ||= item.serviceType === 'VALUABLE';
    }

    const activeRates = await tx.bangCuocGuiHang.findMany({
      where: {
        diemGuiId: senderPointId,
        diemNhanId: receiverPointId,
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: trip.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: trip.ngayKhoiHanh } }],
      },
    });

    const rates: CargoPricingResult['rates'] = [];
    let baseFee = new Prisma.Decimal(0);
    for (const [loaiHangHoaId, totalWeight] of [...weightsByType.entries()].sort(
      ([a], [b]) => a - b,
    )) {
      const matches = activeRates.filter((rate) => {
        const minimum = new Prisma.Decimal(rate.khoiLuongTu);
        const maximum = rate.khoiLuongDen === null
          ? null
          : new Prisma.Decimal(rate.khoiLuongDen);
        return (
          rate.loaiHangHoaId === loaiHangHoaId &&
          minimum.lessThanOrEqualTo(totalWeight) &&
          (maximum === null || maximum.greaterThanOrEqualTo(totalWeight))
        );
      });
      if (matches.length !== 1) {
        return throwConflict(
          matches.length > 1 ? 'CARGO_RATE_AMBIGUOUS' : 'CARGO_RATE_NOT_FOUND',
          matches.length > 1
            ? 'Có nhiều mức cước phù hợp cho loại hàng và tổng khối lượng này.'
            : 'Chưa có mức cước phù hợp cho loại hàng, điểm gửi/nhận và tổng khối lượng này.',
        );
      }

      const rate = matches[0];
      const fee = new Prisma.Decimal(rate.mucCuoc);
      if (
        !fee.isFinite() ||
        fee.isNegative() ||
        !Number.isSafeInteger(fee.toNumber()) ||
        !new Prisma.Decimal(fee.toNumber()).equals(fee)
      ) {
        return throwConflict(
          'CARGO_RATE_INVALID',
          'Mức cước cấu hình không hợp lệ.',
        );
      }
      rates.push({
        loaiHangHoaId,
        bangCuocGuiHangId: rate.bangCuocGuiHangId,
        totalWeight,
        fee,
      });
      baseFee = baseFee.plus(fee);
    }

    const serviceFee = (hasFragile ? SURCHARGE_FRAGILE : new Prisma.Decimal(0))
      .plus(hasValuable ? SURCHARGE_VALUABLE : new Prisma.Decimal(0));

    return {
      senderPointId,
      receiverPointId,
      items: resolvedItems,
      rates,
      baseFee,
      serviceFee,
      totalFee: baseFee.plus(serviceFee),
    };
  }
}
