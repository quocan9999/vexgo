import { businessCode } from '../common/business-code.js';
import {
  locationSearchTerms,
  locationSearchTermsForOption,
} from '../locations/location-search.js';
import type { LocationOption } from '../locations/location-catalog.js';
import { LocationsService } from '../locations/locations.service.js';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  calculateClockTime,
  combineDeparture,
  computeArrival,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  CargoCapacityService,
  type CargoCapacitySnapshot,
} from '../cargo-capacity/cargo-capacity.service.js';
import { CreateTripDto } from './dto/create-trip.dto.js';
import { SearchTripsDto } from './dto/search-trips.dto.js';
import type { TripQueryDto, TripSortField } from './dto/trip-query.dto.js';
import { UpdateTripDto } from './dto/update-trip.dto.js';
import { UpdateTripStatusDto } from './dto/update-trip-status.dto.js';
import { TripSeatsQueryDto } from './dto/trip-seats-query.dto.js';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { Prisma } from '../generated/prisma/client.js';

const TRIP_INCLUDE = {
  tuyenXe: { include: { nhaXe: true } },
  xe: { include: { loaiXe: true } },
  gheChuyenXes: { select: { trangThai: true } },
  diemDonTraChuyenXes: {
    include: {
      diemDonTra: true,
    },
  },
} satisfies Prisma.ChuyenXeInclude;

export interface SubAreaItem {
  diaDiemId: number;
  tenDiaDiem: string;
  tripCount: number;
}

export interface SiblingAreaSuggestion {
  diaDiemId: number;
  tenDiaDiem: string;
  additionalTripCount: number;
}

export interface ExpandSuggestion {
  currentLocation: {
    diaDiemId: number;
    tenDiaDiem: string;
  };
  parentLocation: {
    diaDiemId: number;
    tenDiaDiem: string;
  };
  siblingAreas: SiblingAreaSuggestion[];
  totalAdditionalTrips: number;
}

type TripRecord = Prisma.ChuyenXeGetPayload<{ include: typeof TRIP_INCLUDE }>;

type FareRecord = {
  bangGiaId: number;
  nhaXeId: number;
  tuyenXeId: number;
  loaiXeId: number;
  giaNiemYet: Prisma.Decimal | number;
  tuNgay: Date;
  denNgay: Date | null;
};

export interface StopPointPayload {
  id: string;
  name: string;
  time: string;
  address: string;
  type: 'station' | 'office' | 'transfer' | 'point';
  isDefault: boolean;
}

function getLegacySeatFloor(seatNumber: string, position: string | null) {
  return position?.toLocaleLowerCase('vi-VN').includes('trên') ||
    seatNumber.toLocaleUpperCase('vi-VN').startsWith('B')
    ? 2
    : 1;
}

const PASSENGER_STATIONS_BY_CITY: Record<
  string,
  Array<{ name: string; address: string; type: 'station' | 'point' }>
> = {
  'TP.HCM': [
    {
      name: 'Bến xe Miền Đông mới',
      address: 'Đường Hoàng Hữu Nam, TP. Thủ Đức, TP.HCM',
      type: 'station',
    },
    {
      name: 'Bến xe Miền Tây',
      address: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM',
      type: 'station',
    },
    {
      name: 'Bến xe An Sương',
      address: 'Quốc lộ 22, Bà Điểm, Hóc Môn, TP.HCM',
      type: 'station',
    },
  ],
  'Đà Lạt': [
    {
      name: 'Bến xe Liên tỉnh Đà Lạt',
      address: '01 Tô Hiến Thành, Phường 3, Đà Lạt',
      type: 'station',
    },
    {
      name: 'Bến xe Trung tâm Đà Lạt',
      address: 'Đường Mai Anh Đào, Phường 8, Đà Lạt',
      type: 'station',
    },
  ],
  'Vũng Tàu': [
    {
      name: 'Bến xe Vũng Tàu',
      address: '192 Nam Kỳ Khởi Nghĩa, Phường 3, Vũng Tàu',
      type: 'station',
    },
    {
      name: 'Bến xe Bà Rịa',
      address: 'Quốc lộ 51, Phước Trung, TP. Bà Rịa',
      type: 'station',
    },
  ],
  'Nha Trang': [
    {
      name: 'Bến xe Phía Nam Nha Trang',
      address: 'Km 6 Đường 23/10, Vĩnh Trung, Nha Trang',
      type: 'station',
    },
    {
      name: 'Bến xe Phía Bắc Nha Trang',
      address: 'Đường 2/4, Vĩnh Hải, Nha Trang',
      type: 'station',
    },
  ],
  'Hà Nội': [
    {
      name: 'Bến xe Mỹ Đình',
      address: '20 Phạm Hùng, Mỹ Đình, Nam Từ Liêm, Hà Nội',
      type: 'station',
    },
    {
      name: 'Bến xe Giáp Bát',
      address: 'Giải Phóng, Hoàng Mai, Hà Nội',
      type: 'station',
    },
  ],
  'Đà Nẵng': [
    {
      name: 'Bến xe Trung tâm Đà Nẵng',
      address: 'Tôn Đức Thắng, Hòa Minh, Liên Chiểu, Đà Nẵng',
      type: 'station',
    },
  ],
  'Cần Thơ': [
    {
      name: 'Bến xe Trung tâm Cần Thơ',
      address: 'Khu Đô Thị Nam Cần Thơ, Q. Cái Răng, Cần Thơ',
      type: 'station',
    },
  ],
};

function formatClockTime(d: Date): string {
  const h = String(d.getUTCHours()).padStart(2, '0');
  const m = String(d.getUTCMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

function computePickupAndDropoffPoints(
  trip: TripRecord,
  departureTimeIso: string,
  arrivalTimeIso: string | null,
) {
  const originCity = trip.tuyenXe?.diemDi || 'TP.HCM';
  const destCity = trip.tuyenXe?.diemDen || 'Đà Lạt';

  const depTimeFormatted = formatClockTime(new Date(trip.gioKhoiHanh));
  const arrDate = arrivalTimeIso ? new Date(arrivalTimeIso) : null;
  const arrTimeFormatted =
    arrDate && !isNaN(arrDate.getTime())
      ? `${String(arrDate.getHours()).padStart(2, '0')}:${String(arrDate.getMinutes()).padStart(2, '0')}`
      : depTimeFormatted;

  const originStations = PASSENGER_STATIONS_BY_CITY[originCity] ?? [
    {
      name: `Bến xe trung tâm ${originCity}`,
      address: `Trung tâm ${originCity}`,
      type: 'station' as const,
    },
  ];

  const pickupPoints: StopPointPayload[] = originStations.map((st, idx) => ({
    id: idx === 0 ? `PU_STATION_${trip.chuyenXeId}` : `PU_${trip.chuyenXeId}_${idx + 1}`,
    name: st.name,
    time: depTimeFormatted,
    address: st.address,
    type: st.type,
    isDefault: idx === 0,
  }));

  const destStations = PASSENGER_STATIONS_BY_CITY[destCity] ?? [
    {
      name: `Bến xe trung tâm ${destCity}`,
      address: `Trung tâm ${destCity}`,
      type: 'station' as const,
    },
  ];

  const dropoffPoints: StopPointPayload[] = destStations.map((st, idx) => ({
    id: idx === 0 ? `DO_STATION_${trip.chuyenXeId}` : `DO_${trip.chuyenXeId}_${idx + 1}`,
    name: st.name,
    time: arrTimeFormatted,
    address: st.address,
    type: st.type,
    isDefault: idx === 0,
  }));

  return {
    pickupPoints,
    dropoffPoints,
    pickupPoint: pickupPoints[0].name,
    pickupAddress: pickupPoints[0].address,
    dropoffPoint: dropoffPoints[0].name,
    dropoffAddress: dropoffPoints[0].address,
  };
}

function matchesTimeRange(time: Date, timeRange?: string): boolean {
  if (!timeRange || timeRange === 'all') return true;
  const hour = time.getUTCHours();
  const minute = time.getUTCMinutes();
  const totalMinutes = hour * 60 + minute;

  switch (timeRange) {
    case 'early-morning':
      return totalMinutes >= 0 && totalMinutes < 360; // 00:00 - 06:00
    case 'morning':
      return totalMinutes >= 360 && totalMinutes < 720; // 06:00 - 12:00
    case 'afternoon':
      return totalMinutes >= 720 && totalMinutes < 1080; // 12:00 - 18:00
    case 'evening':
      return totalMinutes >= 1080 && totalMinutes < 1440; // 18:00 - 24:00
    default:
      return false;
  }
}

function findFare(
  trip: TripRecord,
  fares: FareRecord[],
): FareRecord | undefined {
  return fares.find(
    (fare) =>
      fare.nhaXeId === trip.nhaXeId &&
      fare.tuyenXeId === trip.tuyenXeId &&
      fare.loaiXeId === trip.xe.loaiXeId &&
      fare.tuNgay <= trip.ngayKhoiHanh &&
      (fare.denNgay === null || fare.denNgay >= trip.ngayKhoiHanh),
  );
}

export const OPERATOR_BASELINE_RATINGS: Record<string, number> = {
  'phương trang': 4.8,
  'thành bưởi': 4.6,
  'mai linh': 4.5,
  'hoàng long': 4.7,
  'kumho': 4.6,
  'hà lan': 4.7,
  'hoa mai': 4.6,
};

export function resolveBusCompanyRating(
  busCompanyName: string,
  stats?: { rating: number | null; reviewsCount: number | null },
): { rating: number | null; reviewsCount: number | null } {
  if (stats && stats.rating !== null && stats.rating !== undefined) {
    return stats;
  }
  const lower = (busCompanyName || '').toLowerCase();
  for (const [key, baseRating] of Object.entries(OPERATOR_BASELINE_RATINGS)) {
    if (lower.includes(key)) {
      return { rating: baseRating, reviewsCount: 35 };
    }
  }
  return {
    rating: stats?.rating ?? null,
    reviewsCount: stats?.reviewsCount ?? null,
  };
}

function mapTrip(
  trip: TripRecord,
  businessTimeZone: string,
  fare?: FareRecord,
  companyRating?: { rating: number | null; reviewsCount: number | null },
) {
  const departureTime = combineDeparture(
    trip.ngayKhoiHanh,
    trip.gioKhoiHanh,
    businessTimeZone,
  ).toISOString();

  const arrivalTime = computeArrival(
    trip.ngayKhoiHanh,
    trip.gioKhoiHanh,
    trip.tuyenXe.thoiGianChayPhut,
    trip.gioDen,
    businessTimeZone,
  );

  const stopPoints = computePickupAndDropoffPoints(
    trip,
    departureTime,
    arrivalTime,
  );

  const ratingData = resolveBusCompanyRating(
    trip.tuyenXe.nhaXe.tenNhaXe,
    companyRating,
  );

  return {
    id: trip.chuyenXeId,
    code: trip.maChuyenXe,
    status: trip.trangThai,
    busCompany: {
      id: trip.tuyenXe.nhaXe.nhaXeId,
      name: trip.tuyenXe.nhaXe.tenNhaXe,
      logo: null,
      rating: ratingData.rating,
      reviewsCount: ratingData.reviewsCount,
    },
    route: {
      id: trip.tuyenXe.tuyenXeId,
      code: trip.tuyenXe.maTuyenXe,
      origin: trip.tuyenXe.diemDi,
      destination: trip.tuyenXe.diemDen,
      distance: null,
      durationMinutes: trip.tuyenXe.thoiGianChayPhut ?? null,
    },
    departureTime,
    arrivalTime,
    vehicle: {
      id: trip.xe.xeId,
      typeId: trip.xe.loaiXeId,
      type: trip.xe.loaiXe.tenLoai,
      licensePlate: trip.xe.bienSoXe,
      capacity: trip.gheChuyenXes.length,
      amenities: [],
    },
    price: fare ? Number(fare.giaNiemYet) : null,
    availableSeats: trip.gheChuyenXes.filter(
      ({ trangThai }) => trangThai === 'TRONG',
    ).length,
    pickupPoints: stopPoints.pickupPoints,
    dropoffPoints: stopPoints.dropoffPoints,
    pickupPoint: stopPoints.pickupPoint,
    pickupAddress: stopPoints.pickupAddress,
    dropoffPoint: stopPoints.dropoffPoint,
    dropoffAddress: stopPoints.dropoffAddress,
  };
}

function formatTripDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatTripTime(d: Date): string {
  return d.toISOString().slice(11, 19);
}

function mapTripItem(trip: {
  chuyenXeId: number;
  maChuyenXe: string;
  ngayKhoiHanh: Date;
  gioKhoiHanh: Date;
  trangThai: string;
  nhanGuiHang: boolean;
  sucChuaXeMay: number;
  sucChuaHangCongKenh: number;
  sucChuaHangNhe: number;
  createdAt: Date;
  updatedAt: Date;
  tuyenXe: {
    tuyenXeId: number;
    maTuyenXe: string;
    diemDi: string;
    diemDen: string;
  };
  xe: {
    xeId: number;
    bienSoXe: string;
    trangThai: string;
    loaiXe: {
      loaiXeId: number;
      tenLoai: string;
    };
  };
}) {
  return {
    tripId: trip.chuyenXeId,
    code: trip.maChuyenXe,
    departureDate: formatTripDate(trip.ngayKhoiHanh),
    departureTime: formatTripTime(trip.gioKhoiHanh),
    status: trip.trangThai,
    acceptsShipments: trip.nhanGuiHang,
    cargoCapacity: {
      motorbikes: trip.sucChuaXeMay,
      bulkyCargo: trip.sucChuaHangCongKenh,
      lightCargo: trip.sucChuaHangNhe,
    },
    route: {
      routeId: trip.tuyenXe.tuyenXeId,
      code: trip.tuyenXe.maTuyenXe,
      origin: trip.tuyenXe.diemDi,
      destination: trip.tuyenXe.diemDen,
    },
    vehicle: {
      vehicleId: trip.xe.xeId,
      licensePlate: trip.xe.bienSoXe,
      status: trip.xe.trangThai,
      vehicleType: {
        vehicleTypeId: trip.xe.loaiXe.loaiXeId,
        name: trip.xe.loaiXe.tenLoai,
      },
    },
    createdAt: trip.createdAt.toISOString(),
    updatedAt: trip.updatedAt.toISOString(),
  };
}

function cityToCode(city: string): string {
  if (!city) return 'HCM';
  if (city.includes('TP.HCM') || city.includes('Hồ Chí Minh') || city.includes('Sài Gòn')) return 'HCM';
  if (city.includes('Đà Lạt') || city.includes('Da Lat')) return 'DL';
  if (city.includes('Vũng Tàu') || city.includes('Vung Tau')) return 'VT';
  if (city.includes('Nha Trang')) return 'NT';
  if (city.includes('Hà Nội') || city.includes('Ha Noi')) return 'HN';
  if (city.includes('Đà Nẵng') || city.includes('Da Nang')) return 'DN';
  if (city.includes('Cần Thơ') || city.includes('Can Tho')) return 'CT';
  return city;
}

function codeToCity(code?: string): string | undefined {
  if (!code) return undefined;
  const trimmed = code.trim();
  const upper = trimmed.toUpperCase();
  if (
    upper === 'HCM' ||
    upper === 'SG' ||
    upper === 'TP.HCM' ||
    upper === 'TP. HỒ CHÍ MINH' ||
    upper === 'TP HỒ CHÍ MINH' ||
    upper === 'HỒ CHÍ MINH' ||
    upper === 'HO CHI MINH' ||
    upper === 'SÀI GÒN' ||
    upper === 'SAI GON'
  ) {
    return 'TP.HCM';
  }
  if (upper === 'DL' || upper === 'ĐÀ LẠT' || upper === 'DA LAT') return 'Đà Lạt';
  if (upper === 'VT' || upper === 'VŨNG TÀU' || upper === 'VUNG TAU') return 'Vũng Tàu';
  if (upper === 'NT' || upper === 'NHA TRANG') return 'Nha Trang';
  if (upper === 'HN' || upper === 'HÀ NỘI' || upper === 'HA NOI') return 'Hà Nội';
  if (upper === 'DN' || upper === 'ĐÀ NẴNG' || upper === 'DA NANG') return 'Đà Nẵng';
  if (upper === 'CT' || upper === 'CẦN THƠ' || upper === 'CAN THO') return 'Cần Thơ';
  return trimmed;
}

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cargoCapacityService: CargoCapacityService,
    @Optional() private readonly locations?: LocationsService,
  ) {}

  async getBusCompanyRatingMap(
    nhaXeIds: number[],
  ): Promise<Map<number, { rating: number; reviewsCount: number }>> {
    const result = new Map<number, { rating: number; reviewsCount: number }>();
    if (
      !nhaXeIds.length ||
      !this.prisma?.phanHoi ||
      typeof this.prisma.phanHoi.findMany !== 'function'
    ) {
      return result;
    }

    try {
      const reviews = await this.prisma.phanHoi.findMany({
        where: {
          trangThai: 'HIEN_THI',
          chuyenXe: { nhaXeId: { in: nhaXeIds } },
        },
        select: {
          mucDanhGia: true,
          chuyenXe: { select: { nhaXeId: true } },
        },
      });

      const stats = new Map<number, { sum: number; count: number }>();
      for (const rev of reviews) {
        const id = rev.chuyenXe?.nhaXeId;
        if (!id) continue;
        const s = stats.get(id) || { sum: 0, count: 0 };
        s.sum += rev.mucDanhGia;
        s.count += 1;
        stats.set(id, s);
      }

      for (const [id, s] of stats.entries()) {
        result.set(id, {
          rating: Math.round((s.sum / s.count) * 10) / 10,
          reviewsCount: s.count,
        });
      }
    } catch {
      // Graceful fallback
    }

    return result;
  }

  private async buildSubAreas(
    newLocationId: number,
    direction: 'DON' | 'TRA',
    trips: Array<TripRecord>,
    catalogue: LocationOption[],
  ): Promise<SubAreaItem[]> {
    if (!this.prisma?.bangSapNhapDiaDiem?.findMany) return [];
    const mappings = await this.prisma.bangSapNhapDiaDiem.findMany({
      where: { diaDiemMoiId: newLocationId },
      include: { diaDiemCu: true },
      orderBy: { diaDiemCu: { thuTuHienThi: 'desc' } },
    });

    if (!mappings.length) return [];

    const tripSets = new Map<number, Set<number>>();
    for (const m of mappings) {
      tripSets.set(m.diaDiemCuId, new Set());
    }

    for (const m of mappings) {
      const areaTerms = locationSearchTerms(m.diaDiemCu.tenDiaDiem, catalogue);
      for (const trip of trips) {
        const points = (trip.diemDonTraChuyenXes ?? []).filter(
          (p) =>
            p.loaiDiem === direction &&
            p.diemDonTra?.trangThai === 'HOAT_DONG',
        );
        if (points.length > 0) {
          if (points.some((p) => p.diemDonTra?.diaDiemCuId === m.diaDiemCuId)) {
            tripSets.get(m.diaDiemCuId)!.add(trip.chuyenXeId);
          }
        } else {
          // Dự phòng so khớp chuỗi cho chuyến chưa gán điểm đón/trả. Sẽ loại bỏ khi toàn bộ nhà xe gán điểm đầy đủ.
          const routeCity =
            direction === 'DON' ? trip.tuyenXe.diemDi : trip.tuyenXe.diemDen;
          if (areaTerms.some((term) => routeCity.includes(term))) {
            tripSets.get(m.diaDiemCuId)!.add(trip.chuyenXeId);
          }
        }
      }
    }

    return mappings.map((m) => ({
      diaDiemId: m.diaDiemCuId,
      tenDiaDiem: m.diaDiemCu.tenDiaDiem,
      tripCount: tripSets.get(m.diaDiemCuId)?.size ?? 0,
    }));
  }

  private async buildExpandSuggestion(
    currentLocation: { diaDiemId: number; tenDiaDiem: string },
    effectiveOldId: number,
    direction: 'DON' | 'TRA',
    baseWhere: Prisma.ChuyenXeWhereInput,
    primaryTripIds: Set<number>,
    businessTimeZone: string,
    now: Date,
    timeRange?: string,
  ): Promise<ExpandSuggestion | undefined> {
    if (
      !this.prisma?.bangSapNhapDiaDiem?.findUnique ||
      !this.prisma?.bangSapNhapDiaDiem?.findMany
    ) {
      return undefined;
    }
    const mapping = await this.prisma.bangSapNhapDiaDiem.findUnique({
      where: { diaDiemCuId: effectiveOldId },
      include: { diaDiemMoi: true },
    });

    if (!mapping) return undefined;

    const clusterMappings = await this.prisma.bangSapNhapDiaDiem.findMany({
      where: { diaDiemMoiId: mapping.diaDiemMoiId },
      include: { diaDiemCu: true },
      orderBy: { diaDiemCu: { thuTuHienThi: 'desc' } },
    });

    const siblingMappings = clusterMappings.filter(
      (m) => m.diaDiemCuId !== effectiveOldId,
    );
    if (!siblingMappings.length) return undefined;

    const siblingCuIds = siblingMappings.map((m) => m.diaDiemCuId);

    const siblingTrips = await this.prisma.chuyenXe.findMany({
      where: {
        ...baseWhere,
        diemDonTraChuyenXes: {
          some: {
            loaiDiem: direction,
            diemDonTra: {
              diaDiemMoiId: mapping.diaDiemMoiId,
              diaDiemCuId: { in: siblingCuIds },
              trangThai: 'HOAT_DONG',
            },
          },
        },
      },
      include: TRIP_INCLUDE,
    });

    const validSiblingTrips = siblingTrips.filter(
      (trip) =>
        !primaryTripIds.has(trip.chuyenXeId) &&
        combineDeparture(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          businessTimeZone,
        ) > now &&
        matchesTimeRange(trip.gioKhoiHanh, timeRange),
    );

    const siblingTripSets = new Map<number, Set<number>>();
    for (const m of siblingMappings) {
      siblingTripSets.set(m.diaDiemCuId, new Set());
    }
    const allAdditionalTripIds = new Set<number>();

    for (const trip of validSiblingTrips) {
      const points = (trip.diemDonTraChuyenXes ?? []).filter(
        (p) =>
          p.loaiDiem === direction &&
          p.diemDonTra?.trangThai === 'HOAT_DONG',
      );
      for (const p of points) {
        if (p.diemDonTra && siblingTripSets.has(p.diemDonTra.diaDiemCuId)) {
          siblingTripSets.get(p.diemDonTra.diaDiemCuId)!.add(trip.chuyenXeId);
          allAdditionalTripIds.add(trip.chuyenXeId);
        }
      }
    }

    const siblingAreas: SiblingAreaSuggestion[] = siblingMappings.map((m) => ({
      diaDiemId: m.diaDiemCuId,
      tenDiaDiem: m.diaDiemCu.tenDiaDiem,
      additionalTripCount: siblingTripSets.get(m.diaDiemCuId)?.size ?? 0,
    }));

    return {
      currentLocation: {
        diaDiemId: currentLocation.diaDiemId,
        tenDiaDiem: currentLocation.tenDiaDiem,
      },
      parentLocation: {
        diaDiemId: mapping.diaDiemMoi.diaDiemId,
        tenDiaDiem: mapping.diaDiemMoi.tenDiaDiem,
      },
      siblingAreas,
      totalAdditionalTrips: allAdditionalTripIds.size,
    };
  }

  async search(dto: SearchTripsDto) {
    let catalogue: LocationOption[] = [];
    if (
      (dto.from || dto.to || dto.fromLocationId || dto.toLocationId) &&
      this.locations
    ) {
      try {
        catalogue = (await this.locations.list()).data;
      } catch {
        catalogue = [];
      }
    }
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const now = new Date();
    const where: Prisma.ChuyenXeWhereInput = {
      trangThai: 'CHUA_KHOI_HANH',
    };

    const hasLocationOrStation = Boolean(
      dto.fromLocationId ||
        dto.toLocationId ||
        dto.fromStationId ||
        dto.toStationId,
    );

    // Variables for location resolution
    let effectiveFromOldId: number | null = null;
    let effectiveFromNewId: number | null = null;
    let fromLocation: { diaDiemId: number; tenDiaDiem: string } | null = null;
    let validatedFromAreaId: number | null = null;

    let effectiveToOldId: number | null = null;
    let effectiveToNewId: number | null = null;
    let toLocation: { diaDiemId: number; tenDiaDiem: string } | null = null;
    let validatedToAreaId: number | null = null;

    let fromStation: { diemDonTraId: number; tenDiem: string } | null = null;
    let toStation: { diemDonTraId: number; tenDiem: string } | null = null;

    if (dto.fromStationId) {
      const st = await this.prisma.diemDonTra.findUnique({
        where: { diemDonTraId: dto.fromStationId },
      });
      if (!st) {
        throw new BadRequestException({
          error: 'STATION_NOT_FOUND',
          message: 'Điểm đón (bến xe/văn phòng) không tồn tại.',
        });
      }
      fromStation = { diemDonTraId: st.diemDonTraId, tenDiem: st.tenDiem };
    }

    if (dto.toStationId) {
      const st = await this.prisma.diemDonTra.findUnique({
        where: { diemDonTraId: dto.toStationId },
      });
      if (!st) {
        throw new BadRequestException({
          error: 'STATION_NOT_FOUND',
          message: 'Điểm trả (bến xe/văn phòng) không tồn tại.',
        });
      }
      toStation = { diemDonTraId: st.diemDonTraId, tenDiem: st.tenDiem };
    }

    if (dto.fromLocationId) {
      const loc = await this.prisma.danhMucDiaDiem.findUnique({
        where: { diaDiemId: dto.fromLocationId },
      });
      if (!loc) {
        throw new BadRequestException({
          error: 'LOCATION_NOT_FOUND',
          message: 'Địa điểm xuất phát không tồn tại.',
        });
      }
      fromLocation = { diaDiemId: loc.diaDiemId, tenDiaDiem: loc.tenDiaDiem };
      if (loc.capDiaDiem === 'QUAN_HUYEN') {
        if (!loc.diaDiemChaId) {
          throw new BadRequestException({
            error: 'LOCATION_INVALID',
            message: 'Quận/huyện không có tỉnh trực thuộc.',
          });
        }
        effectiveFromOldId = loc.diaDiemChaId;
      } else if (loc.laDiaDanhCu) {
        effectiveFromOldId = loc.diaDiemId;
      } else {
        effectiveFromNewId = loc.diaDiemId;
      }

      if (dto.fromAreaId) {
        if (!effectiveFromNewId) {
          throw new BadRequestException({
            error: 'INVALID_AREA_FILTER',
            message: 'Chỉ có thể lọc khu vực khi tìm kiếm theo địa danh mới.',
          });
        }
        const mapping = await this.prisma.bangSapNhapDiaDiem.findFirst({
          where: {
            diaDiemMoiId: effectiveFromNewId,
            diaDiemCuId: dto.fromAreaId,
          },
        });
        if (!mapping) {
          throw new BadRequestException({
            error: 'AREA_NOT_FOUND',
            message: 'Khu vực không hợp lệ hoặc không thuộc địa danh đã chọn.',
          });
        }
        validatedFromAreaId = dto.fromAreaId;
      }
    } else if (dto.fromAreaId) {
      throw new BadRequestException({
        error: 'INVALID_AREA_FILTER',
        message: 'fromAreaId yêu cầu phải có fromLocationId.',
      });
    }

    if (dto.toLocationId) {
      const loc = await this.prisma.danhMucDiaDiem.findUnique({
        where: { diaDiemId: dto.toLocationId },
      });
      if (!loc) {
        throw new BadRequestException({
          error: 'LOCATION_NOT_FOUND',
          message: 'Địa điểm đến không tồn tại.',
        });
      }
      toLocation = { diaDiemId: loc.diaDiemId, tenDiaDiem: loc.tenDiaDiem };
      if (loc.capDiaDiem === 'QUAN_HUYEN') {
        if (!loc.diaDiemChaId) {
          throw new BadRequestException({
            error: 'LOCATION_INVALID',
            message: 'Quận/huyện không có tỉnh trực thuộc.',
          });
        }
        effectiveToOldId = loc.diaDiemChaId;
      } else if (loc.laDiaDanhCu) {
        effectiveToOldId = loc.diaDiemId;
      } else {
        effectiveToNewId = loc.diaDiemId;
      }

      if (dto.toAreaId) {
        if (!effectiveToNewId) {
          throw new BadRequestException({
            error: 'INVALID_AREA_FILTER',
            message: 'Chỉ có thể lọc khu vực khi tìm kiếm theo địa danh mới.',
          });
        }
        const mapping = await this.prisma.bangSapNhapDiaDiem.findFirst({
          where: {
            diaDiemMoiId: effectiveToNewId,
            diaDiemCuId: dto.toAreaId,
          },
        });
        if (!mapping) {
          throw new BadRequestException({
            error: 'AREA_NOT_FOUND',
            message: 'Khu vực không hợp lệ hoặc không thuộc địa danh đã chọn.',
          });
        }
        validatedToAreaId = dto.toAreaId;
      }
    } else if (dto.toAreaId) {
      throw new BadRequestException({
        error: 'INVALID_AREA_FILTER',
        message: 'toAreaId yêu cầu phải có toLocationId.',
      });
    }

    if (!hasLocationOrStation) {
      if (dto.from || dto.to || dto.busCompanyId || dto.operator) {
        where.tuyenXe = {};
        if (dto.from) {
          where.tuyenXe.AND = [{
            OR: locationSearchTerms(codeToCity(dto.from)!, catalogue).map((term) => ({
              diemDi: { contains: term },
            })),
          }];
        }
        if (dto.to) {
          const originFilter = where.tuyenXe.AND as
            | Prisma.TuyenXeWhereInput[]
            | undefined;
          where.tuyenXe.AND = [...(originFilter ?? []), {
            OR: locationSearchTerms(codeToCity(dto.to)!, catalogue).map((term) => ({
              diemDen: { contains: term },
            })),
          }];
        }
        if (dto.busCompanyId) {
          where.tuyenXe.nhaXeId = dto.busCompanyId;
        }
        if (dto.operator) {
          where.tuyenXe.nhaXe = { tenNhaXe: { contains: dto.operator } };
        }
      }
    } else {
      const andConditions: Prisma.ChuyenXeWhereInput[] = [];

      if (dto.fromStationId && fromStation) {
        andConditions.push({
          OR: [
            {
              diemDonTraChuyenXes: {
                some: {
                  loaiDiem: 'DON',
                  diemDonTraId: dto.fromStationId,
                  diemDonTra: { trangThai: 'HOAT_DONG' },
                },
              },
            },
            {
              diemDonTraChuyenXes: {
                none: {
                  loaiDiem: 'DON',
                  diemDonTra: { trangThai: 'HOAT_DONG' },
                },
              },
              tuyenXe: {
                diemDi: { contains: fromStation.tenDiem },
              },
            },
          ],
        });
      } else if (dto.fromLocationId && fromLocation) {
        const fromPointWhere: Prisma.DiemDonTraWhereInput = effectiveFromOldId
          ? { diaDiemCuId: effectiveFromOldId, trangThai: 'HOAT_DONG' }
          : { diaDiemMoiId: effectiveFromNewId!, trangThai: 'HOAT_DONG' };

        // Lấy terms theo option cụ thể trong catalogue (khớp diaDiemId, đúng isLegacy của mục đó)
        let fromTerms: string[];
        const fromOption = catalogue.find(
          (c) => c.diaDiemId === dto.fromLocationId,
        );
        if (fromOption) {
          fromTerms = locationSearchTermsForOption(fromOption, catalogue);
        } else if (effectiveFromNewId) {
          const mappings = await this.prisma.bangSapNhapDiaDiem.findMany({
            where: { diaDiemMoiId: effectiveFromNewId },
            include: { diaDiemCu: true },
          });
          fromTerms = [
            fromLocation.tenDiaDiem,
            fromLocation.tenDiaDiem
              .replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '')
              .trim(),
            ...mappings.map((m) => m.diaDiemCu.tenDiaDiem),
            ...mappings.map((m) =>
              m.diaDiemCu.tenDiaDiem
                .replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '')
                .trim(),
            ),
          ];
          if (fromLocation.tenDiaDiem.toLowerCase().includes('hồ chí minh')) {
            fromTerms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
          }
        } else {
          const clean = fromLocation.tenDiaDiem
            .replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '')
            .trim();
          fromTerms = [fromLocation.tenDiaDiem, clean];
          if (clean.toLowerCase().includes('hồ chí minh')) {
            fromTerms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
          }
        }
        fromTerms = [...new Set(fromTerms.filter(Boolean))];

        andConditions.push({
          OR: [
            {
              diemDonTraChuyenXes: {
                some: {
                  loaiDiem: 'DON',
                  diemDonTra: fromPointWhere,
                },
              },
            },
            {
              diemDonTraChuyenXes: {
                none: {
                  loaiDiem: 'DON',
                  diemDonTra: { trangThai: 'HOAT_DONG' },
                },
              },
              tuyenXe: {
                OR: fromTerms.map((term) => ({ diemDi: { contains: term } })),
              },
            },
          ],
        });
      } else if (dto.from) {
        const fromTerms = locationSearchTerms(codeToCity(dto.from)!, catalogue);
        andConditions.push({
          tuyenXe: {
            OR: fromTerms.map((term) => ({ diemDi: { contains: term } })),
          },
        });
      }

      if (dto.toStationId && toStation) {
        andConditions.push({
          OR: [
            {
              diemDonTraChuyenXes: {
                some: {
                  loaiDiem: 'TRA',
                  diemDonTraId: dto.toStationId,
                  diemDonTra: { trangThai: 'HOAT_DONG' },
                },
              },
            },
            {
              diemDonTraChuyenXes: {
                none: {
                  loaiDiem: 'TRA',
                  diemDonTra: { trangThai: 'HOAT_DONG' },
                },
              },
              tuyenXe: {
                diemDen: { contains: toStation.tenDiem },
              },
            },
          ],
        });
      } else if (dto.toLocationId && toLocation) {
        const toPointWhere: Prisma.DiemDonTraWhereInput = effectiveToOldId
          ? { diaDiemCuId: effectiveToOldId, trangThai: 'HOAT_DONG' }
          : { diaDiemMoiId: effectiveToNewId!, trangThai: 'HOAT_DONG' };

        // Lấy terms theo option cụ thể trong catalogue (khớp diaDiemId, đúng isLegacy của mục đó)
        let toTerms: string[];
        const toOption = catalogue.find(
          (c) => c.diaDiemId === dto.toLocationId,
        );
        if (toOption) {
          toTerms = locationSearchTermsForOption(toOption, catalogue);
        } else if (effectiveToNewId) {
          const mappings = await this.prisma.bangSapNhapDiaDiem.findMany({
            where: { diaDiemMoiId: effectiveToNewId },
            include: { diaDiemCu: true },
          });
          toTerms = [
            toLocation.tenDiaDiem,
            toLocation.tenDiaDiem
              .replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '')
              .trim(),
            ...mappings.map((m) => m.diaDiemCu.tenDiaDiem),
            ...mappings.map((m) =>
              m.diaDiemCu.tenDiaDiem
                .replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '')
                .trim(),
            ),
          ];
          if (toLocation.tenDiaDiem.toLowerCase().includes('hồ chí minh')) {
            toTerms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
          }
        } else {
          const clean = toLocation.tenDiaDiem
            .replace(/^(Tỉnh|Thành phố|Thị xã)\s+/i, '')
            .trim();
          toTerms = [toLocation.tenDiaDiem, clean];
          if (clean.toLowerCase().includes('hồ chí minh')) {
            toTerms.push('TP.HCM', 'Hồ Chí Minh', 'TP HCM');
          }
        }
        toTerms = [...new Set(toTerms.filter(Boolean))];

        andConditions.push({
          OR: [
            {
              diemDonTraChuyenXes: {
                some: {
                  loaiDiem: 'TRA',
                  diemDonTra: toPointWhere,
                },
              },
            },
            {
              diemDonTraChuyenXes: {
                none: {
                  loaiDiem: 'TRA',
                  diemDonTra: { trangThai: 'HOAT_DONG' },
                },
              },
              tuyenXe: {
                OR: toTerms.map((term) => ({ diemDen: { contains: term } })),
              },
            },
          ],
        });
      } else if (dto.to) {
        const toTerms = locationSearchTerms(codeToCity(dto.to)!, catalogue);
        andConditions.push({
          tuyenXe: {
            OR: toTerms.map((term) => ({ diemDen: { contains: term } })),
          },
        });
      }

      if (dto.busCompanyId) {
        andConditions.push({ tuyenXe: { nhaXeId: dto.busCompanyId } });
      }
      if (dto.operator) {
        andConditions.push({
          tuyenXe: { nhaXe: { tenNhaXe: { contains: dto.operator } } },
        });
      }

      where.AND = andConditions;
    }

    if (dto.vehicleTypeId) {
      where.xe = { loaiXeId: dto.vehicleTypeId };
    }

    const additionalFilters: Prisma.ChuyenXeWhereInput[] = [];
    if (dto.search) {
      additionalFilters.push({
        OR: [
          { tuyenXe: { diemDi: { contains: dto.search } } },
          { tuyenXe: { diemDen: { contains: dto.search } } },
          { tuyenXe: { nhaXe: { tenNhaXe: { contains: dto.search } } } },
          { xe: { loaiXe: { tenLoai: { contains: dto.search } } } },
        ],
      });
    }
    if (dto.vehicleType) {
      additionalFilters.push({
        xe: { loaiXe: { tenLoai: { contains: dto.vehicleType } } },
      });
    }
    if (additionalFilters.length > 0) {
      if (Array.isArray(where.AND)) {
        where.AND.push(...additionalFilters);
      } else {
        where.AND = additionalFilters;
      }
    }

    if (dto.departureDate) {
      where.ngayKhoiHanh = new Date(`${dto.departureDate}T00:00:00.000Z`);
    } else {
      where.ngayKhoiHanh = {
        gte: new Date(
          `${getBusinessDate(businessTimeZone, now)}T00:00:00.000Z`,
        ),
      };
    }

    const queriedTrips = await this.prisma.chuyenXe.findMany({
      where,
      include: TRIP_INCLUDE,
    });
    let chuyenXes = queriedTrips.filter(
      (trip) =>
        combineDeparture(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          businessTimeZone,
        ) > now && matchesTimeRange(trip.gioKhoiHanh, dto.timeRange),
    );

    // Tính subAreas nếu khách chọn địa danh MỚI
    let fromSubAreas: SubAreaItem[] | undefined;
    let toSubAreas: SubAreaItem[] | undefined;
    if (effectiveFromNewId) {
      fromSubAreas = await this.buildSubAreas(
        effectiveFromNewId,
        'DON',
        chuyenXes,
        catalogue,
      );
    }
    if (effectiveToNewId) {
      toSubAreas = await this.buildSubAreas(
        effectiveToNewId,
        'TRA',
        chuyenXes,
        catalogue,
      );
    }

    // Thu hẹp theo areaId nếu khách truyền fromAreaId / toAreaId
    if (validatedFromAreaId) {
      const fromAreaLoc = await this.prisma.danhMucDiaDiem.findUnique({
        where: { diaDiemId: validatedFromAreaId },
      });
      const areaTerms = fromAreaLoc
        ? locationSearchTerms(fromAreaLoc.tenDiaDiem, catalogue)
        : [];
      chuyenXes = chuyenXes.filter((trip) => {
        const points = (trip.diemDonTraChuyenXes ?? []).filter(
          (p) =>
            p.loaiDiem === 'DON' && p.diemDonTra?.trangThai === 'HOAT_DONG',
        );
        if (points.length > 0) {
          return points.some(
            (p) => p.diemDonTra?.diaDiemCuId === validatedFromAreaId,
          );
        }
        return areaTerms.some((term) => trip.tuyenXe.diemDi.includes(term));
      });
    }

    if (validatedToAreaId) {
      const toAreaLoc = await this.prisma.danhMucDiaDiem.findUnique({
        where: { diaDiemId: validatedToAreaId },
      });
      const areaTerms = toAreaLoc
        ? locationSearchTerms(toAreaLoc.tenDiaDiem, catalogue)
        : [];
      chuyenXes = chuyenXes.filter((trip) => {
        const points = (trip.diemDonTraChuyenXes ?? []).filter(
          (p) =>
            p.loaiDiem === 'TRA' && p.diemDonTra?.trangThai === 'HOAT_DONG',
        );
        if (points.length > 0) {
          return points.some(
            (p) => p.diemDonTra?.diaDiemCuId === validatedToAreaId,
          );
        }
        return areaTerms.some((term) => trip.tuyenXe.diemDen.includes(term));
      });
    }

    // Tính expandSuggestion nếu khách chọn địa danh CŨ
    let fromExpandSuggestion: ExpandSuggestion | undefined;
    let toExpandSuggestion: ExpandSuggestion | undefined;

    if (effectiveFromOldId && fromLocation) {
      const baseSiblingWhere: Prisma.ChuyenXeWhereInput = {
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: where.ngayKhoiHanh,
      };
      if (dto.toStationId && toStation) {
        baseSiblingWhere.OR = [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'TRA',
                diemDonTraId: dto.toStationId,
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'TRA',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              diemDen: { contains: toStation.tenDiem },
            },
          },
        ];
      } else if (dto.toLocationId && toLocation) {
        const toPointWhere: Prisma.DiemDonTraWhereInput = effectiveToOldId
          ? { diaDiemCuId: effectiveToOldId, trangThai: 'HOAT_DONG' }
          : { diaDiemMoiId: effectiveToNewId!, trangThai: 'HOAT_DONG' };
        const toOption = catalogue.find(
          (c) => c.diaDiemId === dto.toLocationId,
        );
        const toTerms = toOption
          ? locationSearchTermsForOption(toOption, catalogue)
          : locationSearchTerms(
              dto.to ? codeToCity(dto.to)! : toLocation.tenDiaDiem,
              catalogue,
            );
        baseSiblingWhere.OR = [
          {
            diemDonTraChuyenXes: {
              some: { loaiDiem: 'TRA', diemDonTra: toPointWhere },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'TRA',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              OR: toTerms.map((term) => ({ diemDen: { contains: term } })),
            },
          },
        ];
      } else if (dto.to) {
        const toTerms = locationSearchTerms(codeToCity(dto.to)!, catalogue);
        baseSiblingWhere.tuyenXe = {
          OR: toTerms.map((term) => ({ diemDen: { contains: term } })),
        };
      }
      if (dto.busCompanyId) {
        baseSiblingWhere.tuyenXe = {
          ...(baseSiblingWhere.tuyenXe as Prisma.TuyenXeWhereInput),
          nhaXeId: dto.busCompanyId,
        };
      }

      fromExpandSuggestion = await this.buildExpandSuggestion(
        fromLocation,
        effectiveFromOldId,
        'DON',
        baseSiblingWhere,
        new Set(chuyenXes.map((c) => c.chuyenXeId)),
        businessTimeZone,
        now,
        dto.timeRange,
      );
    }

    if (effectiveToOldId && toLocation) {
      const baseSiblingWhere: Prisma.ChuyenXeWhereInput = {
        trangThai: 'CHUA_KHOI_HANH',
        ngayKhoiHanh: where.ngayKhoiHanh,
      };
      if (dto.fromStationId && fromStation) {
        baseSiblingWhere.OR = [
          {
            diemDonTraChuyenXes: {
              some: {
                loaiDiem: 'DON',
                diemDonTraId: dto.fromStationId,
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'DON',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              diemDi: { contains: fromStation.tenDiem },
            },
          },
        ];
      } else if (dto.fromLocationId && fromLocation) {
        const fromPointWhere: Prisma.DiemDonTraWhereInput = effectiveFromOldId
          ? { diaDiemCuId: effectiveFromOldId, trangThai: 'HOAT_DONG' }
          : { diaDiemMoiId: effectiveFromNewId!, trangThai: 'HOAT_DONG' };
        const fromOption = catalogue.find(
          (c) => c.diaDiemId === dto.fromLocationId,
        );
        const fromTerms = fromOption
          ? locationSearchTermsForOption(fromOption, catalogue)
          : locationSearchTerms(
              dto.from ? codeToCity(dto.from)! : fromLocation.tenDiaDiem,
              catalogue,
            );
        baseSiblingWhere.OR = [
          {
            diemDonTraChuyenXes: {
              some: { loaiDiem: 'DON', diemDonTra: fromPointWhere },
            },
          },
          {
            diemDonTraChuyenXes: {
              none: {
                loaiDiem: 'DON',
                diemDonTra: { trangThai: 'HOAT_DONG' },
              },
            },
            tuyenXe: {
              OR: fromTerms.map((term) => ({ diemDi: { contains: term } })),
            },
          },
        ];
      } else if (dto.from) {
        const fromTerms = locationSearchTerms(codeToCity(dto.from)!, catalogue);
        baseSiblingWhere.tuyenXe = {
          OR: fromTerms.map((term) => ({ diemDi: { contains: term } })),
        };
      }
      if (dto.busCompanyId) {
        baseSiblingWhere.tuyenXe = {
          ...(baseSiblingWhere.tuyenXe as Prisma.TuyenXeWhereInput),
          nhaXeId: dto.busCompanyId,
        };
      }

      toExpandSuggestion = await this.buildExpandSuggestion(
        toLocation,
        effectiveToOldId,
        'TRA',
        baseSiblingWhere,
        new Set(chuyenXes.map((c) => c.chuyenXeId)),
        businessTimeZone,
        now,
        dto.timeRange,
      );
    }

    const tripDates = chuyenXes.map(({ ngayKhoiHanh }) => ngayKhoiHanh);
    const earliestTripDate = new Date(
      Math.min(...tripDates.map((date) => date.getTime())),
    );
    const latestTripDate = new Date(
      Math.max(...tripDates.map((date) => date.getTime())),
    );
    const prices =
      chuyenXes.length === 0
        ? []
        : await this.prisma.bangGia.findMany({
            where: {
              trangThai: 'HOAT_DONG',
              tuNgay: { lte: latestTripDate },
              OR: [{ denNgay: null }, { denNgay: { gte: earliestTripDate } }],
            },
            select: {
              bangGiaId: true,
              nhaXeId: true,
              tuyenXeId: true,
              loaiXeId: true,
              giaNiemYet: true,
              tuNgay: true,
              denNgay: true,
            },
          });

    const direction = dto.sortDirection === 'desc' ? -1 : 1;
    const nhaXeIds = [
      ...new Set(chuyenXes.map((c) => c.tuyenXe.nhaXe.nhaXeId)),
    ];
    const ratingMap = await this.getBusCompanyRatingMap(nhaXeIds);

    const mapped = chuyenXes
      .map((trip) =>
        mapTrip(
          trip,
          businessTimeZone,
          findFare(trip, prices),
          ratingMap.get(trip.tuyenXe.nhaXe.nhaXeId),
        ),
      )
      .filter(
        (trip) =>
          dto.minPrice === undefined ||
          (trip.price !== null && trip.price >= dto.minPrice),
      )
      .filter(
        (trip) =>
          dto.maxPrice === undefined ||
          (trip.price !== null && trip.price <= dto.maxPrice),
      )
      .sort((left, right) => {
        if (dto.sortBy === 'price') {
          if (left.price === null) return 1;
          if (right.price === null) return -1;
          return (left.price - right.price) * direction;
        }
        if (dto.sortBy === 'availableSeats') {
          return (left.availableSeats - right.availableSeats) * direction;
        }
        return (
          left.departureTime.localeCompare(right.departureTime) * direction
        );
      });

    const totalItems = mapped.length;
    const start = (dto.page - 1) * dto.pageSize;
    const response: {
      data: typeof mapped;
      meta: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
      };
      fromSubAreas?: SubAreaItem[];
      toSubAreas?: SubAreaItem[];
      fromExpandSuggestion?: ExpandSuggestion;
      toExpandSuggestion?: ExpandSuggestion;
      subAreas?: SubAreaItem[];
      expandSuggestion?: ExpandSuggestion;
    } = {
      data: mapped.slice(start, start + dto.pageSize),
      meta: {
        page: dto.page,
        pageSize: dto.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / dto.pageSize),
      },
    };

    if (fromSubAreas) response.fromSubAreas = fromSubAreas;
    if (toSubAreas) response.toSubAreas = toSubAreas;
    if (fromExpandSuggestion) response.fromExpandSuggestion = fromExpandSuggestion;
    if (toExpandSuggestion) response.toExpandSuggestion = toExpandSuggestion;

    if (fromSubAreas || toSubAreas) {
      response.subAreas = fromSubAreas ?? toSubAreas;
    }
    if (fromExpandSuggestion || toExpandSuggestion) {
      response.expandSuggestion = fromExpandSuggestion ?? toExpandSuggestion;
    }

    return response;
  }

  async getDetails(id: number) {
    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const now = new Date();

    const cx = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: id },
      include: TRIP_INCLUDE,
    });

    if (!cx) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (cx.trangThai !== 'CHUA_KHOI_HANH') {
      throw new NotFoundException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }

    const departureAt = combineDeparture(
      cx.ngayKhoiHanh,
      cx.gioKhoiHanh,
      businessTimeZone,
    );
    if (departureAt <= now) {
      throw new NotFoundException({
        error: 'TRIP_ALREADY_DEPARTED',
        message: 'Chuyến xe này đã khởi hành.',
      });
    }

    const bangGia = await this.prisma.bangGia.findFirst({
      where: {
        trangThai: 'HOAT_DONG',
        nhaXeId: cx.nhaXeId,
        tuyenXeId: cx.tuyenXeId,
        loaiXeId: cx.xe.loaiXeId,
        tuNgay: { lte: cx.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: cx.ngayKhoiHanh } }],
      },
    });

    const ratingMap = await this.getBusCompanyRatingMap([
      cx.tuyenXe.nhaXe.nhaXeId,
    ]);
    return mapTrip(
      cx,
      businessTimeZone,
      bangGia ?? undefined,
      ratingMap.get(cx.tuyenXe.nhaXe.nhaXeId),
    );
  }

  async getCargoCapacity(id: number) {
    const snapshot = await this.cargoCapacityService.getSnapshot(this.prisma, id);

    if (!snapshot) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const { trip, capacities } = snapshot;

    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new NotFoundException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }

    if (!trip.nhanGuiHang) {
      return {
        data: {
          acceptsShipments: false,
          capacities: this.toCargoCapacityResponse(capacities),
        },
      };
    }

    return {
      data: {
        acceptsShipments: true,
        capacities: this.toCargoCapacityResponse(capacities),
      },
    };
  }

  private toCargoCapacityResponse(
    capacities: CargoCapacitySnapshot['capacities'],
  ) {
    return {
      motorcycles: capacities.XE_MAY,
      bulkyGoods: capacities.HANG_CONG_KENH,
      parcels: capacities.HANG_NHE,
    };
  }

  async getCustomerSeats(id: number) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: id },
      include: { xe: true },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new NotFoundException({
        error: 'TRIP_NOT_AVAILABLE',
        message: 'Chuyến xe này hiện không mở bán.',
      });
    }

    const fare = (trip as any)?.xe?.loaiXeId
      ? await this.prisma.bangGia.findFirst({
          where: {
            nhaXeId: trip.nhaXeId,
            tuyenXeId: trip.tuyenXeId,
            loaiXeId: (trip as any).xe.loaiXeId,
            trangThai: 'HOAT_DONG',
            tuNgay: { lte: trip.ngayKhoiHanh },
            OR: [{ denNgay: null }, { denNgay: { gte: trip.ngayKhoiHanh } }],
          },
        })
      : null;
    const defaultPrice = fare ? Number(fare.giaNiemYet) : undefined;

    const gheChuyenXes = await this.prisma.gheChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: { ghe: true },
      orderBy: { ghe: { soGhe: 'asc' } },
    });

    if (gheChuyenXes.length === 0) {
      throw new NotFoundException({
        error: 'TRIP_SEATS_NOT_FOUND',
        message: 'Không tìm thấy sơ đồ ghế cho chuyến xe này.',
      });
    }

    return gheChuyenXes.map((gx) => ({
      tripSeatId: gx.gheChuyenXeId,
      seatNumber: gx.ghe.soGhe,
      position: gx.ghe.viTri,
      floor:
        gx.ghe.tang ?? gx.tang ?? getLegacySeatFloor(gx.ghe.soGhe, gx.ghe.viTri),
      x: gx.ghe.toaDoX,
      y: gx.ghe.toaDoY,
      status: gx.trangThai,
      ...(defaultPrice !== undefined ? { price: defaultPrice } : {}),
    }));
  }

  async getSeats(
    id: number,
    query: TripSeatsQueryDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);

    const trip = await this.prisma.chuyenXe.findFirst({
      where: {
        chuyenXeId: id,
        nhaXeId,
      },
      select: {
        chuyenXeId: true,
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const allSeats = await this.prisma.gheChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: {
        ghe: {
          select: {
            gheId: true,
            soGhe: true,
            viTri: true,
            tang: true,
            toaDoX: true,
            toaDoY: true,
          },
        },
      },
    });

    allSeats.sort((a, b) => {
      const codeCompare = a.ghe.soGhe.localeCompare(b.ghe.soGhe, undefined, {
        numeric: true,
        sensitivity: 'base',
      });
      if (codeCompare !== 0) return codeCompare;
      return a.gheId - b.gheId;
    });

    const total = allSeats.length;
    let available = 0;
    let held = 0;
    let booked = 0;

    for (const seat of allSeats) {
      if (seat.trangThai === 'TRONG') available++;
      else if (seat.trangThai === 'DANG_GIU') held++;
      else if (seat.trangThai === 'DA_DAT') booked++;
    }

    const filtered = query.status
      ? allSeats.filter((seat) => seat.trangThai === query.status)
      : allSeats;

    const data = filtered.map((item) => ({
      tripSeatId: item.gheChuyenXeId,
      status: item.trangThai,
      seat: {
        seatId: item.ghe.gheId,
        code: item.ghe.soGhe,
        position: item.ghe.viTri,
        floor:
          item.ghe.tang ??
          item.tang ??
          getLegacySeatFloor(item.ghe.soGhe, item.ghe.viTri),
        x: item.ghe.toaDoX,
        y: item.ghe.toaDoY,
      },
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return {
      data,
      meta: {
        tripId: id,
        total,
        available,
        held,
        booked,
      },
    };
  }

  async getManifest(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const trip = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const tripPoints = await this.prisma.diemDonTraChuyenXe.findMany({
      where: { chuyenXeId: id },
      include: { diemDonTra: true },
      orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
    });

    const tickets = await this.prisma.ve.findMany({
      where: {
        gheChuyenXe: { chuyenXeId: id },
        trangThai: { not: 'HUY' },
      },
      include: {
        gheChuyenXe: { include: { ghe: true } },
        phieuDatVe: { include: { donGiaoDich: true } },
        diemDonChuyenXe: { include: { diemDonTra: true } },
        diemTraChuyenXe: { include: { diemDonTra: true } },
      },
      orderBy: { gheChuyenXe: { ghe: { soGhe: 'asc' } } },
    });

    const mappedPassengers = tickets.map((t) => {
      const order = t.phieuDatVe?.donGiaoDich;
      const seatCode = t.gheChuyenXe?.ghe?.soGhe ?? '—';
      const pickupSnapshot = t.diemDonSnapshot as any;
      const dropoffSnapshot = t.diemTraSnapshot as any;

      return {
        veId: t.veId,
        maVe: t.maVe,
        soGhe: seatCode,
        hoTen: order?.tenKhachHang ?? 'Khách lẻ',
        soDienThoai: order?.soDienThoaiKhachHang ?? '—',
        email: order?.emailKhachHang ?? null,
        diemDonChuyenXeId: t.diemDonChuyenXeId,
        diemDonTen:
          t.diemDonChuyenXe?.diemDonTra?.tenDiem ??
          pickupSnapshot?.tenDiem ??
          t.diemDon ??
          'Chưa xác định',
        diemTraChuyenXeId: t.diemTraChuyenXeId,
        diemTraTen:
          t.diemTraChuyenXe?.diemDonTra?.tenDiem ??
          dropoffSnapshot?.tenDiem ??
          'Chưa xác định',
        trangThai: t.trangThai,
        giaThucTe: Number(t.giaThucTe),
      };
    });

    const pickupGroups = tripPoints
      .filter((p) => p.loaiDiem === 'DON')
      .map((p) => ({
        diemDonTraChuyenXeId: p.diemDonTraChuyenXeId,
        diemDonTraId: p.diemDonTraId,
        tenDiem: p.diemDonTra.tenDiem,
        diaChi: p.diemDonTra.diaChi,
        loaiDiem: p.loaiDiem,
        phutLech: p.phutLech,
        gioThucTe: p.thoiGianDuKien
          ? formatClockTime(p.thoiGianDuKien)
          : `${p.phutLech >= 0 ? '+' : ''}${p.phutLech}p`,
        passengers: mappedPassengers.filter(
          (pass) => pass.diemDonChuyenXeId === p.diemDonTraChuyenXeId,
        ),
      }));

    const dropoffGroups = tripPoints
      .filter((p) => p.loaiDiem === 'TRA')
      .map((p) => ({
        diemDonTraChuyenXeId: p.diemDonTraChuyenXeId,
        diemDonTraId: p.diemDonTraId,
        tenDiem: p.diemDonTra.tenDiem,
        diaChi: p.diemDonTra.diaChi,
        loaiDiem: p.loaiDiem,
        phutLech: p.phutLech,
        gioThucTe: p.thoiGianDuKien
          ? formatClockTime(p.thoiGianDuKien)
          : `${p.phutLech >= 0 ? '+' : ''}${p.phutLech}p`,
        passengers: mappedPassengers.filter(
          (pass) => pass.diemTraChuyenXeId === p.diemDonTraChuyenXeId,
        ),
      }));

    const unassignedPassengers = mappedPassengers.filter(
      (pass) =>
        !pass.diemDonChuyenXeId ||
        !pickupGroups.some((g) => g.diemDonTraChuyenXeId === pass.diemDonChuyenXeId),
    );

    const depDateStr = trip.ngayKhoiHanh ? trip.ngayKhoiHanh.toISOString().slice(0, 10) : '';

    return {
      data: {
        trip: {
          chuyenXeId: trip.chuyenXeId,
          maChuyenXe: trip.maChuyenXe,
          ngayKhoiHanh: depDateStr,
          gioKhoiHanh: formatClockTime(trip.gioKhoiHanh),
          gioDen: trip.gioDen ? formatClockTime(trip.gioDen) : null,
          trangThai: trip.trangThai,
          tuyenXe: {
            tuyenXeId: trip.tuyenXe.tuyenXeId,
            maTuyenXe: trip.tuyenXe.maTuyenXe,
            diemDi: trip.tuyenXe.diemDi,
            diemDen: trip.tuyenXe.diemDen,
          },
          xe: {
            xeId: trip.xe.xeId,
            bienSoXe: trip.xe.bienSoXe,
            tenLoaiXe: trip.xe.loaiXe.tenLoai,
          },
        },
        pickupGroups,
        dropoffGroups,
        unassignedPassengers,
        totalPassengers: mappedPassengers.length,
      },
    };
  }

  async findAll(query: TripQueryDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const where: Prisma.ChuyenXeWhereInput = {
      nhaXeId,
    };

    if (query.status) {
      where.trangThai = query.status;
    }

    if (query.routeId) {
      where.tuyenXeId = query.routeId;
    }

    if (query.vehicleId) {
      where.xeId = query.vehicleId;
    }

    if (query.departureDate) {
      where.ngayKhoiHanh = new Date(`${query.departureDate}T00:00:00.000Z`);
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { maChuyenXe: { contains: term } },
        { tuyenXe: { is: { maTuyenXe: { contains: term } } } },
        { tuyenXe: { is: { diemDi: { contains: term } } } },
        { tuyenXe: { is: { diemDen: { contains: term } } } },
        { xe: { is: { bienSoXe: { contains: term } } } },
      ];
    }

    const direction = query.sortDirection ?? 'asc';
    const sortFieldMap: Record<
      TripSortField,
      Prisma.ChuyenXeOrderByWithRelationInput
    > = {
      code: { maChuyenXe: direction },
      departureDate: { ngayKhoiHanh: direction },
      departureTime: { gioKhoiHanh: direction },
      status: { trangThai: direction },
      createdAt: { createdAt: direction },
      updatedAt: { updatedAt: direction },
    };

    const sortBy = query.sortBy ?? 'departureDate';
    const orderBy: Prisma.ChuyenXeOrderByWithRelationInput[] = [
      sortFieldMap[sortBy],
      { chuyenXeId: 'asc' },
    ];

    const [trips, totalItems] = await Promise.all([
      this.prisma.chuyenXe.findMany({
        where,
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
        },
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.chuyenXe.count({ where }),
    ]);

    return {
      data: trips.map(mapTripItem),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  async findOne(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);
    const trip = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
        diemDonTraChuyenXes: { select: { loaiDiem: true } },
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const total = trip.gheChuyenXes.length;
    const available = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'TRONG',
    ).length;
    const held = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'DANG_GIU',
    ).length;
    const booked = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'DA_DAT',
    ).length;

    const donCount = (trip.diemDonTraChuyenXes ?? []).filter(
      (p) => p.loaiDiem === 'DON',
    ).length;
    const traCount = (trip.diemDonTraChuyenXes ?? []).filter(
      (p) => p.loaiDiem === 'TRA',
    ).length;
    const nghiCount = (trip.diemDonTraChuyenXes ?? []).filter(
      (p) => p.loaiDiem === 'NGHI',
    ).length;
    const thieuDiem = donCount === 0 || traCount === 0;

    return {
      data: {
        ...mapTripItem(trip),
        seatSummary: {
          total,
          available,
          held,
          booked,
        },
        donCount,
        traCount,
        nghiCount,
        thieuDiem,
      },
    };
  }

  async previewCode(date: string, principal: AuthPrincipal) {
    return { data: { code: await businessCode(this.prisma, requireTenantPrincipal(principal), 'CX', date) } };
  }

  async create(dto: CreateTripDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const route = await this.prisma.tuyenXe.findFirst({
      where: { tuyenXeId: dto.routeId, nhaXeId },
    });
    if (!route) {
      throw new NotFoundException({
        error: 'ROUTE_NOT_FOUND',
        message: 'Không tìm thấy tuyến xe trong nhà xe.',
      });
    }

    if (route.trangThai !== 'HOAT_DONG') {
      throw new ConflictException({
        error: 'ROUTE_NOT_ACTIVE',
        message: 'Tuyến xe đang tạm ngưng hoạt động, không thể lập chuyến.',
      });
    }

    const vehicle = await this.prisma.xe.findFirst({
      where: { xeId: dto.vehicleId, nhaXeId },
      include: {
        loaiXe: {
          select: {
            sucChuaXeMayMacDinh: true,
            sucChuaHangCongKenhMacDinh: true,
            sucChuaHangNheMacDinh: true,
          },
        },
      },
    });
    if (!vehicle) {
      throw new NotFoundException({
        error: 'VEHICLE_NOT_FOUND',
        message: 'Không tìm thấy xe trong nhà xe.',
      });
    }

    if (vehicle.trangThai !== 'HOAT_DONG') {
      throw new ConflictException({
        error: 'VEHICLE_NOT_ACTIVE',
        message: 'Xe đang không hoạt động, không thể phân công vào chuyến.',
      });
    }

    const departureDate = new Date(`${dto.departureDate}T00:00:00.000Z`);
    const departureTime = new Date(`1970-01-01T${dto.departureTime}.000Z`);
    const arrivalTime = calculateClockTime(
      departureTime,
      route.thoiGianChayPhut,
    );

    try {
      const trip = await this.prisma.$transaction(
        async (tx) => {
          const code = await businessCode(tx, nhaXeId, 'CX', dto.departureDate, true);
          const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
            SELECT xeId
            FROM Xe
            WHERE xeId = ${dto.vehicleId}
            FOR UPDATE
          `;
          if (lockedVehicles.length === 0) {
            throw new NotFoundException({
              error: 'VEHICLE_NOT_FOUND',
              message: 'Không tìm thấy xe trong nhà xe.',
            });
          }

          const vehicleSeats = await tx.ghe.findMany({
            where: { xeId: dto.vehicleId },
            select: {
              gheId: true,
              tang: true,
              toaDoX: true,
              toaDoY: true,
            },
          });
          if (vehicleSeats.length === 0) {
            throw new ConflictException({
              error: 'VEHICLE_HAS_NO_SEATS',
              message: 'Xe chưa được cấu hình ghế nên chưa thể lập chuyến.',
            });
          }

          const scheduleConflict = await tx.chuyenXe.findFirst({
            where: {
              xeId: dto.vehicleId,
              ngayKhoiHanh: departureDate,
              gioKhoiHanh: departureTime,
              trangThai: { not: 'DA_HUY' },
            },
            select: { chuyenXeId: true },
          });
          if (scheduleConflict) {
            throw new ConflictException({
              error: 'TRIP_VEHICLE_SCHEDULE_CONFLICT',
              message:
                'Xe đã được phân công cho một chuyến xe khác trong cùng khung giờ.',
            });
          }

          const createdTrip = await tx.chuyenXe.create({
            data: {
              maChuyenXe: code,
              ngayKhoiHanh: departureDate,
              gioKhoiHanh: departureTime,
              gioDen: arrivalTime,
              trangThai: 'CHUA_KHOI_HANH',
              nhanGuiHang: dto.acceptsShipments ?? false,
              nhaXeId,
              tuyenXeId: dto.routeId,
              xeId: dto.vehicleId,
              sucChuaXeMay: vehicle.loaiXe.sucChuaXeMayMacDinh,
              sucChuaHangCongKenh: vehicle.loaiXe.sucChuaHangCongKenhMacDinh,
              sucChuaHangNhe: vehicle.loaiXe.sucChuaHangNheMacDinh,
              gheChuyenXes: {
                create: vehicleSeats.map((ghe) => ({
                  gheId: ghe.gheId,
                  trangThai: 'TRONG',
                  tang: ghe.tang,
                  toaDoX: ghe.toaDoX,
                  toaDoY: ghe.toaDoY,
                })),
              },
            },
            include: {
              tuyenXe: true,
              xe: { include: { loaiXe: true } },
              gheChuyenXes: { select: { trangThai: true } },
            },
          });

          if (dto.copyRouteStops !== false && tx.tuyenXeDiemDung) {
            const templateStops = await tx.tuyenXeDiemDung.findMany({
              where: { tuyenXeId: dto.routeId },
              orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
            });

            for (const stop of templateStops) {
              const thoiGianDuKien = calculateClockTime(departureTime, stop.phutLech);
              if (tx.diemDonTraChuyenXe) {
                await tx.diemDonTraChuyenXe.create({
                  data: {
                    chuyenXeId: createdTrip.chuyenXeId,
                    diemDonTraId: stop.diemDonTraId,
                    loaiDiem: stop.loaiDiem,
                    thoiGianDuKien,
                    phutLech: stop.phutLech,
                    thuTu: stop.thuTu,
                    phuPhi: stop.phuPhi,
                    phutCoMatTruoc: stop.phutCoMatTruoc,
                    nhanKhach: stop.nhanKhach,
                    ghiChu: stop.ghiChu,
                  },
                });
              }
            }
          }

          return createdTrip;
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
        },
      );

      const total = trip.gheChuyenXes.length;
      const available = trip.gheChuyenXes.filter(
        (g) => g.trangThai === 'TRONG',
      ).length;
      const held = trip.gheChuyenXes.filter(
        (g) => g.trangThai === 'DANG_GIU',
      ).length;
      const booked = trip.gheChuyenXes.filter(
        (g) => g.trangThai === 'DA_DAT',
      ).length;

      const points = this.prisma.diemDonTraChuyenXe
        ? await this.prisma.diemDonTraChuyenXe.findMany({
            where: { chuyenXeId: trip.chuyenXeId },
            select: { loaiDiem: true },
          })
        : [];
      const donCount = points.filter((p) => p.loaiDiem === 'DON').length;
      const traCount = points.filter((p) => p.loaiDiem === 'TRA').length;
      const nghiCount = points.filter((p) => p.loaiDiem === 'NGHI').length;
      const thieuDiem = donCount === 0 || traCount === 0;

      return {
        data: {
          ...mapTripItem(trip),
          seatSummary: {
            total,
            available,
            held,
            booked,
          },
          donCount,
          traCount,
          nghiCount,
          thieuDiem,
        },
      };
    } catch (err: unknown) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        throw new ConflictException({
          error: 'TRIP_CODE_EXISTS',
          message: 'Mã chuyến xe đã tồn tại.',
        });
      }
      throw err;
    }
  }

  private formatTripWithSummary(trip: {
    chuyenXeId: number;
    maChuyenXe: string;
    ngayKhoiHanh: Date;
    gioKhoiHanh: Date;
    trangThai: string;
    nhanGuiHang: boolean;
    sucChuaXeMay: number;
    sucChuaHangCongKenh: number;
    sucChuaHangNhe: number;
    createdAt: Date;
    updatedAt: Date;
    tuyenXe: {
      tuyenXeId: number;
      maTuyenXe: string;
      diemDi: string;
      diemDen: string;
    };
    xe: {
      xeId: number;
      bienSoXe: string;
      trangThai: string;
      loaiXe: {
        loaiXeId: number;
        tenLoai: string;
      };
    };
    gheChuyenXes: Array<{ trangThai: string }>;
  }) {
    const total = trip.gheChuyenXes.length;
    const available = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'TRONG',
    ).length;
    const held = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'DANG_GIU',
    ).length;
    const booked = trip.gheChuyenXes.filter(
      (g) => g.trangThai === 'DA_DAT',
    ).length;

    return {
      data: {
        ...mapTripItem(trip),
        seatSummary: {
          total,
          available,
          held,
          booked,
        },
      },
    };
  }

  async update(id: number, dto: UpdateTripDto, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const existing = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: { tuyenXe: { select: { thoiGianChayPhut: true } } },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (existing.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
      });
    }

    const departureDate = new Date(`${dto.departureDate}T00:00:00.000Z`);
    const departureTime = new Date(`1970-01-01T${dto.departureTime}.000Z`);
    const arrivalTime = calculateClockTime(
      departureTime,
      existing.tuyenXe.thoiGianChayPhut,
    );

    const trip = await this.prisma.$transaction(
      async (tx) => {
        const lockedVehicles = await tx.$queryRaw<Array<{ xeId: number }>>`
          SELECT xeId
          FROM Xe
          WHERE xeId = ${existing.xeId}
          FOR UPDATE
        `;
        if (lockedVehicles.length === 0) {
          throw new NotFoundException({
            error: 'VEHICLE_NOT_FOUND',
            message: 'Không tìm thấy xe trong nhà xe.',
          });
        }

        const scheduleConflict = await tx.chuyenXe.findFirst({
          where: {
            xeId: existing.xeId,
            ngayKhoiHanh: departureDate,
            gioKhoiHanh: departureTime,
            trangThai: { not: 'DA_HUY' },
            chuyenXeId: { not: id },
          },
          select: { chuyenXeId: true },
        });
        if (scheduleConflict) {
          throw new ConflictException({
            error: 'TRIP_VEHICLE_SCHEDULE_CONFLICT',
            message:
              'Xe đã được phân công cho một chuyến xe khác trong cùng khung giờ.',
          });
        }

        const result = await tx.chuyenXe.updateMany({
          where: {
            chuyenXeId: id,
            nhaXeId,
            trangThai: 'CHUA_KHOI_HANH',
          },
          data: {
            ngayKhoiHanh: departureDate,
            gioKhoiHanh: departureTime,
            gioDen: arrivalTime,
          },
        });

        if (result.count === 0) {
          const reRead = await tx.chuyenXe.findFirst({
            where: { chuyenXeId: id, nhaXeId },
          });
          if (!reRead) {
            throw new NotFoundException({
              error: 'TRIP_NOT_FOUND',
              message: 'Không tìm thấy chuyến xe.',
            });
          }
          throw new ConflictException({
            error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
            message: 'Chỉ có thể cập nhật chuyến xe khi chưa khởi hành.',
          });
        }

        return tx.chuyenXe.findFirstOrThrow({
          where: { chuyenXeId: id, nhaXeId },
          include: {
            tuyenXe: true,
            xe: { include: { loaiXe: true } },
            gheChuyenXes: { select: { trangThai: true } },
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      },
    );

    return this.formatTripWithSummary(trip);
  }

  async updateStatus(
    id: number,
    dto: UpdateTripStatusDto,
    principal: AuthPrincipal,
  ) {
    const nhaXeId = requireTenantPrincipal(principal);

    const existing = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (existing.trangThai === dto.status) {
      return this.formatTripWithSummary(existing);
    }

    const isValidTransition =
      (existing.trangThai === 'CHUA_KHOI_HANH' && dto.status === 'DANG_CHAY') ||
      (existing.trangThai === 'DANG_CHAY' && dto.status === 'HOAN_THANH');

    if (!isValidTransition) {
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể chuyển chuyến xe sang trạng thái yêu cầu.',
      });
    }

    const result = await this.prisma.chuyenXe.updateMany({
      where: {
        chuyenXeId: id,
        nhaXeId,
        trangThai: existing.trangThai,
      },
      data: {
        trangThai: dto.status,
      },
    });

    if (result.count === 0) {
      const reRead = await this.prisma.chuyenXe.findFirst({
        where: { chuyenXeId: id, nhaXeId },
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { select: { trangThai: true } },
        },
      });
      if (!reRead) {
        throw new NotFoundException({
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        });
      }
      if (reRead.trangThai === dto.status) {
        return this.formatTripWithSummary(reRead);
      }
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể chuyển chuyến xe sang trạng thái yêu cầu.',
      });
    }

    const updated = await this.prisma.chuyenXe.findFirstOrThrow({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });

    return this.formatTripWithSummary(updated);
  }

  async cancel(id: number, principal: AuthPrincipal) {
    const nhaXeId = requireTenantPrincipal(principal);

    const existing = await this.prisma.chuyenXe.findFirst({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });
    if (!existing) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (existing.trangThai === 'DA_HUY') {
      return this.formatTripWithSummary(existing);
    }

    if (existing.trangThai !== 'CHUA_KHOI_HANH') {
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      });
    }

    const activeBooking = await this.prisma.gheChuyenXe.findFirst({
      where: {
        chuyenXeId: id,
        OR: [
          { trangThai: { in: ['DANG_GIU', 'DA_DAT'] } },
          { ves: { some: { trangThai: { not: 'HUY' } } } },
        ],
      },
      select: { gheChuyenXeId: true },
    });

    if (activeBooking) {
      throw new ConflictException({
        error: 'TRIP_HAS_ACTIVE_BOOKINGS',
        message: 'Không thể hủy chuyến xe đã có vé hoặc đang có khách giữ chỗ.',
      });
    }

    const activeShipment = await this.prisma.phieuGuiHang.findFirst({
      where: {
        chuyenXeId: id,
        trangThai: { notIn: ['DA_GIAO', 'DA_HUY'] },
      },
      select: { phieuGuiHangId: true },
    });

    if (activeShipment) {
      throw new ConflictException({
        error: 'TRIP_HAS_ACTIVE_SHIPMENTS',
        message: 'Không thể hủy chuyến xe đang có vận đơn được điều phối.',
      });
    }

    const result = await this.prisma.chuyenXe.updateMany({
      where: {
        chuyenXeId: id,
        nhaXeId,
        trangThai: 'CHUA_KHOI_HANH',
      },
      data: {
        trangThai: 'DA_HUY',
      },
    });

    if (result.count === 0) {
      const reRead = await this.prisma.chuyenXe.findFirst({
        where: { chuyenXeId: id, nhaXeId },
        include: {
          tuyenXe: true,
          xe: { include: { loaiXe: true } },
          gheChuyenXes: { select: { trangThai: true } },
        },
      });
      if (!reRead) {
        throw new NotFoundException({
          error: 'TRIP_NOT_FOUND',
          message: 'Không tìm thấy chuyến xe.',
        });
      }
      if (reRead.trangThai === 'DA_HUY') {
        return this.formatTripWithSummary(reRead);
      }
      throw new ConflictException({
        error: 'TRIP_STATUS_TRANSITION_NOT_ALLOWED',
        message: 'Không thể hủy chuyến xe đang chạy hoặc đã hoàn thành.',
      });
    }

    const updated = await this.prisma.chuyenXe.findFirstOrThrow({
      where: { chuyenXeId: id, nhaXeId },
      include: {
        tuyenXe: true,
        xe: { include: { loaiXe: true } },
        gheChuyenXes: { select: { trangThai: true } },
      },
    });

    return this.formatTripWithSummary(updated);
  }

  async getTripAlternatives(
    tripId: number,
    limit: number = 5,
    otherOperatorsOnly: boolean = false,
    maxPrice?: number,
  ) {
    const originalTrip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: Number(tripId) },
      include: {
        tuyenXe: {
          include: {
            nhaXe: true,
          },
        },
        xe: {
          include: {
            nhaXe: true,
            loaiXe: true,
          },
        },
        gheChuyenXes: {
          include: {
            ghe: true,
          },
        },
      },
    });

    if (!originalTrip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: `Chuyến xe #${tripId} không tồn tại.`,
      });
    }

    const businessTimeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );

    // Giá vé niêm yết của chuyến gốc
    const origFare = await this.prisma.bangGia.findFirst({
      where: {
        nhaXeId: originalTrip.nhaXeId,
        tuyenXeId: originalTrip.tuyenXeId,
        loaiXeId: originalTrip.xe.loaiXeId,
        trangThai: 'HOAT_DONG',
        tuNgay: { lte: originalTrip.ngayKhoiHanh },
        OR: [{ denNgay: null }, { denNgay: { gte: originalTrip.ngayKhoiHanh } }],
      },
      orderBy: {
        tuNgay: 'desc',
      },
    });
    const originalPrice = origFare ? Number(origFare.giaNiemYet) : 0;

    const origTime = combineDeparture(
      originalTrip.ngayKhoiHanh,
      originalTrip.gioKhoiHanh,
      businessTimeZone,
    );

    // Tiêu chí 1 & 2: Cùng tuyến hoặc cùng điểm đi & điểm đến (bắt buộc), trạng thái CHUA_KHOI_HANH
    const candidates = await this.prisma.chuyenXe.findMany({
      where: {
        chuyenXeId: { not: originalTrip.chuyenXeId },
        trangThai: 'CHUA_KHOI_HANH',
        OR: [
          { tuyenXeId: originalTrip.tuyenXeId },
          {
            tuyenXe: {
              diemDi: originalTrip.tuyenXe.diemDi,
              diemDen: originalTrip.tuyenXe.diemDen,
            },
          },
        ],
      },
      include: {
        tuyenXe: {
          include: {
            nhaXe: true,
          },
        },
        xe: {
          include: {
            nhaXe: true,
            loaiXe: true,
          },
        },
        gheChuyenXes: {
          include: {
            ghe: true,
          },
        },
        phanHois: true,
      },
    });

    const scoredCandidates = await Promise.all(
      candidates.map(async (trip) => {
        // Tiêu chí nhà xe khác nếu otherOperatorsOnly = true
        if (otherOperatorsOnly && trip.nhaXeId === originalTrip.nhaXeId) {
          return null;
        }

        // Tiêu chí 4: Phải còn vé (bắt buộc)
        const availableSeats = trip.gheChuyenXes.filter(
          (g) => g.trangThai === 'TRONG',
        ).length;
        if (availableSeats <= 0) {
          return null; // Bỏ qua chuyến đã hết chỗ
        }

        const candTime = combineDeparture(
          trip.ngayKhoiHanh,
          trip.gioKhoiHanh,
          businessTimeZone,
        );

        // Loại bỏ chuyến đã qua thời điểm khởi hành (departureAt <= now)
        if (candTime.getTime() <= Date.now()) {
          return null;
        }

        // Tiêu chí 3: Cùng ngày hoặc trong khoảng ± 24 giờ
        const deltaMs = Math.abs(candTime.getTime() - origTime.getTime());
        const deltaMinutes = Math.floor(deltaMs / (60 * 1000));
        const deltaHours = deltaMinutes / 60;

        // Tiêu chí 5: Không đề xuất chuyến quá lệch giờ (vượt quá 24 giờ)
        if (deltaMinutes > 24 * 60) {
          return null;
        }

        // Lấy giá vé của chuyến thay thế từ bảng giá đang hoạt động
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
          return null; // Bỏ qua nếu không có bảng giá hợp lệ
        }
        const price = Number(fare.giaNiemYet);

        // Tiêu chí giá vé <= chuyến gốc (hoặc maxPrice) khi otherOperatorsOnly = true hoặc có maxPrice
        const hasCustomMaxPrice =
          maxPrice !== undefined &&
          maxPrice !== null &&
          !Number.isNaN(Number(maxPrice));
        const effectiveMaxPrice = hasCustomMaxPrice
          ? Number(maxPrice)
          : otherOperatorsOnly
            ? originalPrice
            : undefined;
        if (effectiveMaxPrice !== undefined && price > effectiveMaxPrice) {
          return null;
        }

        // Thuật toán tính điểm ưu tiên (Scoring Engine)
        let score = 1000;

        // 1. Phạt độ lệch giờ (RẤT QUAN TRỌNG): Mỗi 15 phút lệch trừ 1 điểm
        score -= Math.floor(deltaMinutes / 15);
        if (deltaMinutes === 0) {
          score += 200; // Ưu tiên hàng đầu khi cùng giờ khởi hành
        }

        // 2. Ưu tiên giá tương đương hoặc thấp hơn (QUAN TRỌNG)
        const priceDiff = price - originalPrice;
        if (price <= originalPrice) {
          score += 50;
          if (price <= originalPrice * 0.9) {
            score += 30; // Rẻ hơn >= 10%
          }
        } else {
          score -= Math.min(60, Math.floor(priceDiff / 10000));
        }

        // 3. Ưu tiên cùng nhà xe (chỉ khi không bắt buộc nhà xe khác)
        const isSameOperator = trip.nhaXeId === originalTrip.nhaXeId;
        if (!otherOperatorsOnly && isSameOperator) {
          score += 30;
        }

        // 4. Ưu tiên chuyến còn nhiều ghế trống
        score += Math.min(20, availableSeats);

        // Sinh recommendationReason bằng tiếng Việt thân thiện
        const reasons: string[] = [];
        if (isSameOperator && !otherOperatorsOnly) {
          reasons.push('Cùng nhà xe');
        } else if (!isSameOperator) {
          reasons.push(`Nhà xe ${trip.xe.nhaXe.tenNhaXe}`);
        }
        if (deltaHours === 0) {
          reasons.push('Cùng giờ khởi hành');
        } else {
          const isEarlier = candTime.getTime() < origTime.getTime();
          const hStr =
            deltaHours < 1
              ? `${deltaMinutes} phút`
              : Number.isInteger(deltaHours)
                ? `${deltaHours} giờ`
                : `${deltaHours.toFixed(1)} giờ`;
          reasons.push(
            isEarlier ? `Khởi hành sớm hơn ${hStr}` : `Khởi hành sau ${hStr}`,
          );
        }

        if (price < originalPrice) {
          const saved = (originalPrice - price).toLocaleString('vi-VN');
          reasons.push(`Giá tiết kiệm hơn ${saved}đ`);
        } else if (price === originalPrice) {
          reasons.push('Giá bằng chuyến đang xem');
        }

        reasons.push(`còn ${availableSeats} chỗ`);
        const recommendationReason = reasons.join(', ');

        const depTime = trip.gioKhoiHanh
          ? formatClockTime(new Date(trip.gioKhoiHanh))
          : '08:00';

        const arrivalTime = trip.gioDen
          ? formatClockTime(new Date(trip.gioDen))
          : '';

        const durationMinutes = trip.tuyenXe.thoiGianChayPhut;
        let duration = '';
        if (durationMinutes && durationMinutes > 0) {
          const hours = Math.floor(durationMinutes / 60);
          const mins = durationMinutes % 60;
          duration = mins > 0 ? `${hours} giờ ${mins} phút` : `${hours} giờ`;
        }

        const operatorName = trip.xe.nhaXe.tenNhaXe;
        const vehicleTypeName = trip.xe.loaiXe.tenLoai;

        const reviews = trip.phanHois || [];
        const reviewCount = reviews.length;
        const fallbackRating = resolveBusCompanyRating(operatorName, {
          rating: null,
          reviewsCount: null,
        });
        const rating =
          reviewCount > 0
            ? Math.round(
                (reviews.reduce((sum, r) => sum + r.mucDanhGia, 0) /
                  reviewCount) *
                  10,
              ) / 10
            : fallbackRating.rating;
        const finalReviewCount =
          reviewCount > 0 ? reviewCount : fallbackRating.reviewsCount ?? 0;

        return {
          score,
          data: {
            tripId: trip.chuyenXeId,
            id: trip.chuyenXeId.toString(),
            routeId: trip.tuyenXeId.toString(),
            busCompanyId: trip.nhaXeId,
            operatorId: trip.nhaXeId.toString(),
            busCompanyName: operatorName,
            operatorName,
            vehicleTypeName,
            vehicleType: vehicleTypeName,
            fromCityId: cityToCode(trip.tuyenXe.diemDi),
            fromCityName: trip.tuyenXe.diemDi,
            toCityId: cityToCode(trip.tuyenXe.diemDen),
            toCityName: trip.tuyenXe.diemDen,
            departureTime: depTime,
            arrivalTime,
            duration,
            price,
            originalPrice: price,
            discountPrice: price,
            availableSeats,
            totalSeats: trip.gheChuyenXes.length,
            seatLayoutType: vehicleTypeName,
            rating,
            reviewCount: finalReviewCount,
            pickupPoint: `Bến xe ${trip.tuyenXe.diemDi}`,
            pickupAddress: null,
            dropoffPoint: `Bến xe ${trip.tuyenXe.diemDen}`,
            dropoffAddress: null,
            amenities: [],
            recommendationReason,
            matchScore: score,
          },
        };
      }),
    );

    const valid = scoredCandidates.filter(
      (item): item is NonNullable<typeof item> => item !== null,
    );

    // Sắp xếp giảm dần theo điểm số
    valid.sort((a, b) => b.score - a.score);

    const top = valid.slice(0, Math.max(1, limit)).map((item) => item.data);
    return top;
  }
}
