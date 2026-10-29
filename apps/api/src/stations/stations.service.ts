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
      return requestedNhaXeId ?? principal.nhaXeId ?? 1;
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
    const mapping = await this.prisma.bangSapNhapDiaDiem.findFirst({
      where: { diaDiemCuId },
    });

    if (!mapping) {
      // Fallback: Nếu không tìm thấy trong mapping, kiểm tra xem diaDiemCuId có tồn tại trong DanhMucDiaDiem không
      const oldLoc = await this.prisma.danhMucDiaDiem.findUnique({
        where: { diaDiemId: diaDiemCuId },
      });
      if (!oldLoc) {
        throw new BadRequestException({
          error: 'LOCATION_NOT_FOUND',
          message: 'Không tìm thấy địa danh cũ tương ứng.',
        });
      }
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
    const existing = await this.findById(id, principal);
    const station = existing.data;

    const data: any = {
      ...dto,
    };

    // Nếu đổi diaDiemCuId -> Tự động suy ra diaDiemMoiId từ BangSapNhapDiaDiem
    if (dto.diaDiemCuId && dto.diaDiemCuId !== station.diaDiemCuId) {
      data.diaDiemMoiId = await this.resolveDiaDiemMoiId(dto.diaDiemCuId);
    }

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
            thoiGianDuKien: p.thoiGianDuKien ? new Date(p.thoiGianDuKien) : null,
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
  }
}
