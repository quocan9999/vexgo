import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { UpdateStationDto } from './dto/update-station.dto.js';
import { StationQueryDto } from './dto/station-query.dto.js';
import { UpdateTripPassengerPointsDto } from './dto/trip-passenger-points.dto.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';

function parseTimeString(timeStr?: string | null): Date | null {
  if (!timeStr || !timeStr.trim()) return null;
  const trimmed = timeStr.trim();
  if (/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(trimmed)) {
    const normalized = trimmed.length === 5 ? `${trimmed}:00` : trimmed;
    const d = new Date(`1970-01-01T${normalized}.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) {
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    const ss = String(d.getUTCSeconds()).padStart(2, '0');
    return new Date(`1970-01-01T${hh}:${mm}:${ss}.000Z`);
  }
  return null;
}

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  private resolveTenantNhaXeId(principal?: AuthPrincipal, requestedNhaXeId?: number): number {
    if (!principal) {
      if (requestedNhaXeId) return requestedNhaXeId;
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Yêu cầu quyền truy cập nhà xe.',
      });
    }

    if (principal.roles?.includes('SUPER_ADMIN')) {
      const tenantId = requestedNhaXeId ?? principal.nhaXeId;
      if (!tenantId) {
        throw new BadRequestException({
          error: 'NHA_XE_REQUIRED',
          message: 'Yêu cầu chọn nhà xe (nhaXeId) khi thực hiện thao tác với tư cách SUPER_ADMIN.',
        });
      }
      return tenantId;
    }

    if (!principal.nhaXeId) {
      throw new ForbiddenException({
        error: 'TENANT_NOT_ASSIGNED',
        message: 'Tài khoản chưa được gán nhà xe thao tác.',
      });
    }

    return principal.nhaXeId;
  }

  async resolveDiaDiemMoiId(diaDiemCuId: number): Promise<number> {
    const oldLoc = await this.prisma.danhMucDiaDiem.findUnique({
      where: { diaDiemId: diaDiemCuId },
    });

    if (!oldLoc) {
      throw new BadRequestException({
        error: 'LOCATION_NOT_FOUND',
        message: 'Không tìm thấy địa danh cũ tương ứng.',
      });
    }

    if (!oldLoc.laDiaDanhCu || oldLoc.capDiaDiem !== 'TINH_THANH') {
      throw new BadRequestException({
        error: 'INVALID_LEGACY_LOCATION',
        message: 'Địa danh được chọn phải là tỉnh/thành phố trước sáp nhập (laDiaDanhCu = true và capDiaDiem = TINH_THANH).',
      });
    }

    const mapping = await this.prisma.bangSapNhapDiaDiem.findFirst({
      where: { diaDiemCuId },
    });

    if (!mapping) {
      throw new BadRequestException({
        error: 'LOCATION_MAPPING_NOT_FOUND',
        message: `Địa danh cũ '${oldLoc.tenDiaDiem}' chưa có thông tin tỉnh sáp nhập tương ứng.`,
      });
    }

    return mapping.diaDiemMoiId;
  }

  async create(dto: CreateStationDto, principal?: AuthPrincipal) {
    const nhaXeId = this.resolveTenantNhaXeId(principal, dto.nhaXeId);

    // Tự động suy ra diaDiemMoiId từ BangSapNhapDiaDiem dựa vào diaDiemCuId
    const diaDiemMoiId = await this.resolveDiaDiemMoiId(dto.diaDiemCuId);

    // Kiểm tra trùng maDiem trong cùng nhaXe
    const existing = await this.prisma.diemDonTra.findUnique({
      where: {
        nhaXeId_maDiem: {
          nhaXeId,
          maDiem: dto.maDiem,
        },
      },
    });

    if (existing) {
      throw new ConflictException({
        error: 'STATION_CODE_EXISTS',
        message: `Mã điểm đón trả '${dto.maDiem}' đã tồn tại trong nhà xe này.`,
      });
    }

    try {
      const station = await this.prisma.diemDonTra.create({
        data: {
          maDiem: dto.maDiem,
          tenDiem: dto.tenDiem,
          loaiDiem: dto.loaiDiem,
          diaChi: dto.diaChi,
          diaDiemCuId: dto.diaDiemCuId,
          diaDiemMoiId,
          viDo: dto.viDo,
          kinhDo: dto.kinhDo,
          soDienThoai: dto.soDienThoai,
          trangThai: dto.trangThai ?? 'HOAT_DONG',
          nhaXeId,
        },
        include: {
          diaDiemCu: true,
          diaDiemMoi: true,
          nhaXe: {
            select: { nhaXeId: true, tenNhaXe: true, maNhaXe: true },
          },
        },
      });

      return { data: station };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({
          error: 'STATION_CODE_EXISTS',
          message: `Mã điểm đón trả '${dto.maDiem}' đã tồn tại trong nhà xe này.`,
        });
      }
      throw error;
    }
  }

  async list(query: StationQueryDto, principal?: AuthPrincipal) {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.max(1, Math.min(100, query.pageSize ?? 20));
    const skip = (page - 1) * pageSize;

    const where: any = {};

    if (principal && !principal.roles?.includes('SUPER_ADMIN')) {
      where.nhaXeId = principal.nhaXeId;
    } else if (query.nhaXeId) {
      where.nhaXeId = query.nhaXeId;
    }

    if (query.loaiDiem) {
      where.loaiDiem = query.loaiDiem;
    }

    if (query.diaDiemCuId) {
      where.diaDiemCuId = query.diaDiemCuId;
    }

    if (query.diaDiemMoiId) {
      where.diaDiemMoiId = query.diaDiemMoiId;
    }

    if (query.search?.trim()) {
      const s = query.search.trim();
      where.OR = [
        { tenDiem: { contains: s } },
        { maDiem: { contains: s } },
        { diaChi: { contains: s } },
      ];
    }

    const [totalItems, items] = await Promise.all([
      this.prisma.diemDonTra.count({ where }),
      this.prisma.diemDonTra.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: {
          [query.sortBy || 'createdAt']: query.sortDirection || 'desc',
        },
        include: {
          diaDiemCu: true,
          diaDiemMoi: true,
          nhaXe: {
            select: { nhaXeId: true, tenNhaXe: true, maNhaXe: true },
          },
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return {
      data: items,
      meta: {
        page,
        pageSize,
        totalItems,
        totalPages,
      },
    };
  }

  async findById(id: number, principal?: AuthPrincipal) {
    const station = await this.prisma.diemDonTra.findUnique({
      where: { diemDonTraId: id },
      include: {
        diaDiemCu: true,
        diaDiemMoi: true,
        nhaXe: {
          select: { nhaXeId: true, tenNhaXe: true, maNhaXe: true },
        },
      },
    });

    if (!station) {
      throw new NotFoundException({
        error: 'STATION_NOT_FOUND',
        message: 'Không tìm thấy điểm đón trả.',
      });
    }

    if (principal && !principal.roles?.includes('SUPER_ADMIN') && station.nhaXeId !== principal.nhaXeId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Không có quyền truy cập điểm đón trả này.',
      });
    }

    return { data: station };
  }

  async update(id: number, dto: UpdateStationDto, principal?: AuthPrincipal) {
    await this.findById(id, principal);

    const data: {
      maDiem?: string;
      tenDiem?: string;
      loaiDiem?: 'BEN_XE' | 'VAN_PHONG' | 'DIEM_DON_TRA';
      diaChi?: string;
      diaDiemCuId?: number;
      diaDiemMoiId?: number;
      viDo?: number | null;
      kinhDo?: number | null;
      soDienThoai?: string | null;
      trangThai?: string;
    } = {};

    if (dto.maDiem !== undefined) data.maDiem = dto.maDiem;
    if (dto.tenDiem !== undefined) data.tenDiem = dto.tenDiem;
    if (dto.loaiDiem !== undefined) data.loaiDiem = dto.loaiDiem;
    if (dto.diaChi !== undefined) data.diaChi = dto.diaChi;
    if (dto.viDo !== undefined) data.viDo = dto.viDo;
    if (dto.kinhDo !== undefined) data.kinhDo = dto.kinhDo;
    if (dto.soDienThoai !== undefined) data.soDienThoai = dto.soDienThoai;
    if (dto.trangThai !== undefined) data.trangThai = dto.trangThai;

    // Khi sửa diaDiemCuId của bến đã có thì cập nhật lại diaDiemMoiId cho khớp
    if (dto.diaDiemCuId !== undefined && dto.diaDiemCuId !== null) {
      data.diaDiemCuId = dto.diaDiemCuId;
      data.diaDiemMoiId = await this.resolveDiaDiemMoiId(dto.diaDiemCuId);
    }

    try {
      const updated = await this.prisma.diemDonTra.update({
        where: { diemDonTraId: id },
        data,
        include: {
          diaDiemCu: true,
          diaDiemMoi: true,
          nhaXe: {
            select: { nhaXeId: true, tenNhaXe: true, maNhaXe: true },
          },
        },
      });

      return { data: updated };
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException({
          error: 'STATION_CODE_EXISTS',
          message: `Mã điểm đón trả '${dto.maDiem ?? id}' đã tồn tại trong nhà xe này.`,
        });
      }
      throw error;
    }
  }

  async delete(id: number, principal?: AuthPrincipal) {
    await this.findById(id, principal);

    // Soft delete: chuyển sang trạng thái NGUNG_HOAT_DONG
    const updated = await this.prisma.diemDonTra.update({
      where: { diemDonTraId: id },
      data: { trangThai: 'NGUNG_HOAT_DONG' },
    });

    return { data: updated };
  }

  async getTripPassengerPoints(tripId: number) {
    const points = await this.prisma.diemDonTraChuyenXe.findMany({
      where: { chuyenXeId: tripId },
      orderBy: [{ loaiDiem: 'asc' }, { thuTu: 'asc' }],
      include: {
        diemDonTra: {
          include: {
            diaDiemCu: true,
            diaDiemMoi: true,
          },
        },
      },
    });

    return { data: points };
  }

  async updateTripPassengerPoints(
    tripId: number,
    dto: UpdateTripPassengerPointsDto,
    principal?: AuthPrincipal,
  ) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (principal && !principal.roles?.includes('SUPER_ADMIN') && trip.nhaXeId !== principal.nhaXeId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Không có quyền cập nhật chuyến xe của nhà xe khác.',
      });
    }

    if (dto.points && dto.points.length > 0) {
      const seen = new Set<string>();
      for (const p of dto.points) {
        const key = `${p.diemDonTraId}_${p.loaiDiem}`;
        if (seen.has(key)) {
          throw new ConflictException({
            error: 'DUPLICATE_TRIP_POINT',
            message: `Điểm đón/trả #${p.diemDonTraId} đã tồn tại trong danh sách ${p.loaiDiem === 'DON' ? 'điểm đón' : 'điểm trả'} của chuyến này.`,
          });
        }
        seen.add(key);
      }

      // Kiểm tra tất cả điểm đón trả: tồn tại, HOAT_DONG, và nhaXeId trùng với trip.nhaXeId
      const pointIds = [...new Set(dto.points.map((p) => p.diemDonTraId))];
      const stations = await this.prisma.diemDonTra.findMany({
        where: { diemDonTraId: { in: pointIds } },
        select: { diemDonTraId: true, trangThai: true, nhaXeId: true },
      });

      const stationMap = new Map(stations.map((s) => [s.diemDonTraId, s]));

      for (const pointId of pointIds) {
        const st = stationMap.get(pointId);
        if (!st) {
          throw new BadRequestException({
            error: 'STATION_NOT_FOUND',
            message: `Không tìm thấy điểm đón/trả #${pointId}.`,
            details: [{ field: 'diemDonTraId', id: pointId }],
          });
        }

        if (st.trangThai !== 'HOAT_DONG') {
          throw new BadRequestException({
            error: 'STATION_INACTIVE',
            message: `Điểm đón/trả #${pointId} đang ngưng hoạt động hoặc không khả dụng.`,
            details: [{ field: 'diemDonTraId', id: pointId }],
          });
        }

        if (st.nhaXeId !== trip.nhaXeId) {
          throw new BadRequestException({
            error: 'STATION_TENANT_MISMATCH',
            message: `Điểm đón/trả #${pointId} không thuộc nhà xe của chuyến xe này.`,
            details: [{ field: 'diemDonTraId', id: pointId }],
          });
        }
      }
    }

    try {
      const updatedPoints = await this.prisma.$transaction(async (tx) => {
        await tx.diemDonTraChuyenXe.deleteMany({
          where: { chuyenXeId: tripId },
        });

        if (!dto.points || dto.points.length === 0) {
          return [];
        }

        const created = [];
        for (const p of dto.points) {
          const item = await tx.diemDonTraChuyenXe.create({
            data: {
              chuyenXeId: tripId,
              diemDonTraId: p.diemDonTraId,
              loaiDiem: p.loaiDiem,
              thoiGianDuKien: parseTimeString(p.thoiGianDuKien),
              thuTu: p.thuTu,
              phuPhi: p.phuPhi ?? 0,
            },
            include: {
              diemDonTra: {
                include: {
                  diaDiemCu: true,
                  diaDiemMoi: true,
                },
              },
            },
          });
          created.push(item);
        }
        return created;
      });

      return { data: updatedPoints };
    } catch (error: any) {
      if (
        error instanceof ConflictException ||
        error instanceof BadRequestException ||
        error instanceof NotFoundException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      if (error?.code === 'P2003') {
        throw new BadRequestException({
          error: 'STATION_NOT_FOUND',
          message: 'Điểm đón/trả không tồn tại trong hệ thống.',
        });
      }
      if (error?.code === 'P2002') {
        throw new ConflictException({
          error: 'DUPLICATE_TRIP_POINT',
          message: 'Điểm đón/trả bị trùng lặp cho cùng một loại điểm trên chuyến xe này.',
        });
      }
      throw error;
    }
  }
}
