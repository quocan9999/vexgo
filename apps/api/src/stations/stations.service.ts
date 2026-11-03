import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateStationDto } from './dto/create-station.dto.js';
import { UpdateStationDto } from './dto/update-station.dto.js';
import { StationQueryDto } from './dto/station-query.dto.js';
import { UpdateTripPassengerPointsDto } from './dto/trip-passenger-points.dto.js';
import { hasTenantRole } from '../auth/principal-scope.js';
import {
  POINT_CUTOFF_MINUTES,
  STATION_STATUSES,
  type StationStatus,
  STATION_TYPES,
  type StationType,
} from './station.constants.js';
import {
  calculateClockTime,
  combineDeparture,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import { validateStopList } from './stop-list-validator.js';
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
  private readonly businessTimeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService?: ConfigService,
  ) {
    this.businessTimeZone = resolveBusinessTimeZone(
      this.configService?.get('BUSINESS_TIME_ZONE'),
    );
  }

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

  private async validateBenTrungChuyenTarget(
    benTrungChuyenId: number,
    nhaXeId: number,
    currentStationId?: number,
  ) {
    if (currentStationId && benTrungChuyenId === currentStationId) {
      throw new BadRequestException({
        error: 'TRANSFER_STATION_SELF_REFERENCE',
        message: 'Điểm trung chuyển không thể trỏ tới chính nó.',
      });
    }

    const target = await this.prisma.diemDonTra.findUnique({
      where: { diemDonTraId: benTrungChuyenId },
    });

    if (!target) {
      throw new NotFoundException({
        error: 'TRANSFER_STATION_NOT_FOUND',
        message: 'Không tìm thấy bến xe/văn phòng trung chuyển đích.',
      });
    }

    if (target.nhaXeId !== nhaXeId) {
      throw new BadRequestException({
        error: 'TRANSFER_STATION_TENANT_MISMATCH',
        message: 'Bến trung chuyển đích phải thuộc cùng nhà xe.',
      });
    }

    if (target.trangThai !== 'HOAT_DONG') {
      throw new BadRequestException({
        error: 'TRANSFER_STATION_INACTIVE',
        message: 'Bến trung chuyển đích đang ngưng hoạt động.',
      });
    }

    if (target.loaiDiem !== 'BEN_XE' && target.loaiDiem !== 'VAN_PHONG') {
      throw new BadRequestException({
        error: 'TRANSFER_STATION_INVALID_TYPE',
        message: 'Bến trung chuyển đích phải là Bến xe hoặc Văn phòng.',
      });
    }

    return target;
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

    // Validate trung chuyển
    let benTrungChuyenId: number | null = null;
    if (dto.loaiDiem === 'TRUNG_CHUYEN') {
      if (!dto.benTrungChuyenId) {
        throw new BadRequestException({
          error: 'TRANSFER_STATION_REQUIRED',
          message: 'Điểm trung chuyển bắt buộc phải chọn bến xe hoặc văn phòng kết nối.',
        });
      }
      await this.validateBenTrungChuyenTarget(dto.benTrungChuyenId, nhaXeId);
      benTrungChuyenId = dto.benTrungChuyenId;
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
          benTrungChuyenId,
          trangThai: dto.trangThai ?? 'HOAT_DONG',
          nhaXeId,
        },
        include: {
          diaDiemCu: true,
          diaDiemMoi: true,
          benTrungChuyen: {
            select: {
              diemDonTraId: true,
              tenDiem: true,
              maDiem: true,
              diaChi: true,
              loaiDiem: true,
            },
          },
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

    const isPrivileged =
      Boolean(principal) &&
      (principal!.roles?.includes('SUPER_ADMIN') || hasTenantRole(principal!.roles ?? []));

    if (!isPrivileged) {
      where.trangThai = 'HOAT_DONG';
      if (query.nhaXeId) {
        where.nhaXeId = query.nhaXeId;
      }
    } else {
      if (principal!.roles?.includes('SUPER_ADMIN')) {
        if (query.nhaXeId) {
          where.nhaXeId = query.nhaXeId;
        }
      } else {
        where.nhaXeId = principal!.nhaXeId;
      }

      if (query.trangThai) {
        where.trangThai = query.trangThai;
      }
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
          benTrungChuyen: {
            select: {
              diemDonTraId: true,
              tenDiem: true,
              maDiem: true,
              diaChi: true,
              loaiDiem: true,
            },
          },
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
        benTrungChuyen: {
          select: {
            diemDonTraId: true,
            tenDiem: true,
            maDiem: true,
            diaChi: true,
            loaiDiem: true,
          },
        },
        nhaXe: {
          select: { nhaXeId: true, tenNhaXe: true, maNhaXe: true },
        },
      },
    });

    if (!station) {
      throw new NotFoundException({
        error: 'STATION_NOT_FOUND',
        message: 'Không tìm thấy điểm đón/trả.',
      });
    }

    const isPrivileged =
      Boolean(principal) &&
      (principal!.roles?.includes('SUPER_ADMIN') || hasTenantRole(principal!.roles ?? []));

    if (!isPrivileged) {
      if (station.trangThai === 'NGUNG_HOAT_DONG') {
        throw new NotFoundException({
          error: 'STATION_NOT_FOUND',
          message: 'Không tìm thấy điểm đón/trả.',
        });
      }
    } else {
      if (!principal!.roles?.includes('SUPER_ADMIN') && station.nhaXeId !== principal!.nhaXeId) {
        throw new ForbiddenException({
          error: 'FORBIDDEN',
          message: 'Không có quyền truy cập điểm đón/trả của nhà xe khác.',
        });
      }
    }

    return { data: station };
  }

  async update(id: number, dto: UpdateStationDto, principal?: AuthPrincipal) {
    const current = await this.findById(id, principal);
    const nhaXeId = current.data.nhaXeId;

    // Chặn ngưng hoạt động nếu đang có điểm trung chuyển hoạt động trỏ tới
    if (dto.trangThai === 'NGUNG_HOAT_DONG' && current.data.trangThai !== 'NGUNG_HOAT_DONG') {
      const dependents = await this.prisma.diemDonTra.findMany({
        where: { benTrungChuyenId: id, trangThai: 'HOAT_DONG' },
        select: { diemDonTraId: true, tenDiem: true, maDiem: true },
      });
      if (dependents.length > 0) {
        throw new ConflictException({
          error: 'STATION_HAS_DEPENDENT_TRANSFERS',
          message: `Không thể ngưng hoạt động bến đang là đích của ${dependents.length} điểm trung chuyển đang hoạt động.`,
          details: dependents,
        });
      }
    }

    const effectiveLoaiDiem = dto.loaiDiem ?? (current.data.loaiDiem as StationType);

    const data: {
      maDiem?: string;
      tenDiem?: string;
      loaiDiem?: StationType;
      diaChi?: string;
      diaDiemCuId?: number;
      diaDiemMoiId?: number;
      benTrungChuyenId?: number | null;
      viDo?: number | null;
      kinhDo?: number | null;
      soDienThoai?: string | null;
      trangThai?: StationStatus;
    } = {};

    if (dto.maDiem !== undefined) data.maDiem = dto.maDiem;
    if (dto.tenDiem !== undefined) data.tenDiem = dto.tenDiem;
    if (dto.loaiDiem !== undefined) data.loaiDiem = dto.loaiDiem;
    if (dto.diaChi !== undefined) data.diaChi = dto.diaChi;
    if (dto.viDo !== undefined) data.viDo = dto.viDo;
    if (dto.kinhDo !== undefined) data.kinhDo = dto.kinhDo;
    if (dto.soDienThoai !== undefined) data.soDienThoai = dto.soDienThoai;
    if (dto.trangThai !== undefined) data.trangThai = dto.trangThai;

    if (effectiveLoaiDiem === 'TRUNG_CHUYEN') {
      const targetId =
        dto.benTrungChuyenId !== undefined ? dto.benTrungChuyenId : current.data.benTrungChuyenId;
      if (!targetId) {
        throw new BadRequestException({
          error: 'TRANSFER_STATION_REQUIRED',
          message: 'Điểm trung chuyển bắt buộc phải chọn bến xe hoặc văn phòng kết nối.',
        });
      }
      await this.validateBenTrungChuyenTarget(targetId, nhaXeId, id);
      data.benTrungChuyenId = targetId;
    } else if (dto.loaiDiem !== undefined) {
      data.benTrungChuyenId = null;
    } else if (dto.benTrungChuyenId !== undefined) {
      data.benTrungChuyenId = dto.benTrungChuyenId;
    }

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
          benTrungChuyen: {
            select: {
              diemDonTraId: true,
              tenDiem: true,
              maDiem: true,
              diaChi: true,
              loaiDiem: true,
            },
          },
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

    // Chặn xóa/ngưng nếu đang có điểm trung chuyển hoạt động trỏ tới
    const dependents = await this.prisma.diemDonTra.findMany({
      where: { benTrungChuyenId: id, trangThai: 'HOAT_DONG' },
      select: { diemDonTraId: true, tenDiem: true, maDiem: true },
    });
    if (dependents.length > 0) {
      throw new ConflictException({
        error: 'STATION_HAS_DEPENDENT_TRANSFERS',
        message: `Không thể xóa hoặc ngưng bến đang là đích của ${dependents.length} điểm trung chuyển đang hoạt động.`,
        details: dependents,
      });
    }

    // Soft delete: chuyển sang trạng thái NGUNG_HOAT_DONG
    const updated = await this.prisma.diemDonTra.update({
      where: { diemDonTraId: id },
      data: { trangThai: 'NGUNG_HOAT_DONG' },
    });

    return { data: updated };
  }

  async getTripPassengerPointsForAdmin(tripId: number, principal: AuthPrincipal) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (!principal.roles?.includes('SUPER_ADMIN') && trip.nhaXeId !== principal.nhaXeId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Không có quyền xem điểm đón/trả chuyến xe của nhà xe khác.',
      });
    }

    const points = await this.prisma.diemDonTraChuyenXe.findMany({
      where: { chuyenXeId: tripId },
      orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      include: {
        diemDonTra: {
          include: {
            diaDiemCu: true,
            diaDiemMoi: true,
            benTrungChuyen: {
              select: {
                diemDonTraId: true,
                tenDiem: true,
                maDiem: true,
                diaChi: true,
                loaiDiem: true,
              },
            },
          },
        },
        vesDon: {
          where: { trangThai: { not: 'DA_HUY' } },
          select: { veId: true },
        },
        vesTra: {
          where: { trangThai: { not: 'DA_HUY' } },
          select: { veId: true },
        },
      },
    });

    const data = points.map((p) => {
      const ticketCount = (p.vesDon?.length ?? 0) + (p.vesTra?.length ?? 0);
      return {
        diemDonTraChuyenXeId: p.diemDonTraChuyenXeId,
        chuyenXeId: p.chuyenXeId,
        diemDonTraId: p.diemDonTraId,
        loaiDiem: p.loaiDiem,
        thoiGianDuKien: p.thoiGianDuKien,
        phutLech: p.phutLech,
        thuTu: p.thuTu,
        phuPhi: Number(p.phuPhi),
        phutCoMatTruoc: p.phutCoMatTruoc,
        nhanKhach: p.nhanKhach,
        ghiChu: p.ghiChu,
        veCount: ticketCount,
        diemDonTra: p.diemDonTra,
      };
    });

    return { data };
  }

  async getTripPassengerPointsPublic(tripId: number) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
    });

    if (!trip || trip.trangThai !== 'CHUA_KHOI_HANH') {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const points = await this.prisma.diemDonTraChuyenXe.findMany({
      where: {
        chuyenXeId: tripId,
        loaiDiem: { in: ['DON', 'TRA'] }, // Không trả loại NGHI
        diemDonTra: {
          trangThai: 'HOAT_DONG',
        },
      },
      orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
      include: {
        diemDonTra: {
          include: {
            diaDiemCu: true,
            diaDiemMoi: true,
            benTrungChuyen: {
              select: {
                diemDonTraId: true,
                tenDiem: true,
                maDiem: true,
                diaChi: true,
                loaiDiem: true,
              },
            },
          },
        },
      },
    });

    const baseDeparture =
      trip.ngayKhoiHanh && trip.gioKhoiHanh
        ? combineDeparture(trip.ngayKhoiHanh, trip.gioKhoiHanh, this.businessTimeZone)
        : new Date('1970-01-01T00:00:00.000Z');
    const nowTime = Date.now();

    const publicPoints = points.map((p) => {
      const realDateTime = new Date(baseDeparture.getTime() + (p.phutLech ?? 0) * 60 * 1000);
      const cutoffThreshold = new Date(realDateTime.getTime() - POINT_CUTOFF_MINUTES * 60 * 1000);
      const khoaDoQuaGio = nowTime >= cutoffThreshold.getTime();

      return {
        diemDonTraChuyenXeId: p.diemDonTraChuyenXeId,
        chuyenXeId: p.chuyenXeId,
        diemDonTraId: p.diemDonTraId,
        loaiDiem: p.loaiDiem,
        thoiGianDuKien: p.thoiGianDuKien,
        phutLech: p.phutLech,
        gioThucTe: realDateTime.toISOString(),
        thuTu: p.thuTu,
        phuPhi: Number(p.phuPhi),
        phutCoMatTruoc: p.phutCoMatTruoc,
        nhanKhach: p.nhanKhach,
        khoaDoQuaGio,
        ghiChu: p.ghiChu,
        benTrungChuyen: p.diemDonTra.benTrungChuyen
          ? {
              diemDonTraId: p.diemDonTra.benTrungChuyen.diemDonTraId,
              tenDiem: p.diemDonTra.benTrungChuyen.tenDiem,
            }
          : null,
        diemDonTra: {
          diemDonTraId: p.diemDonTra.diemDonTraId,
          maDiem: p.diemDonTra.maDiem,
          tenDiem: p.diemDonTra.tenDiem,
          loaiDiem: p.diemDonTra.loaiDiem,
          diaChi: p.diemDonTra.diaChi,
          viDo: p.diemDonTra.viDo,
          kinhDo: p.diemDonTra.kinhDo,
          diaDiemCu: p.diemDonTra.diaDiemCu
            ? {
                diaDiemId: p.diemDonTra.diaDiemCu.diaDiemId,
                code: p.diemDonTra.diaDiemCu.code,
                tenDiaDiem: p.diemDonTra.diaDiemCu.tenDiaDiem,
                laDiaDanhCu: p.diemDonTra.diaDiemCu.laDiaDanhCu,
                chuThichSapNhap: p.diemDonTra.diaDiemCu.chuThichSapNhap ?? null,
              }
            : null,
          diaDiemMoi: p.diemDonTra.diaDiemMoi
            ? {
                diaDiemId: p.diemDonTra.diaDiemMoi.diaDiemId,
                code: p.diemDonTra.diaDiemMoi.code,
                tenDiaDiem: p.diemDonTra.diaDiemMoi.tenDiaDiem,
                laDiaDanhCu: p.diemDonTra.diaDiemMoi.laDiaDanhCu,
                chuThichSapNhap: p.diemDonTra.diaDiemMoi.chuThichSapNhap ?? null,
              }
            : null,
        },
      };
    });

    return { data: publicPoints };
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
      const pointIds = [...new Set(dto.points.map((p) => p.diemDonTraId))];
      const stations = await this.prisma.diemDonTra.findMany({
        where: { diemDonTraId: { in: pointIds } },
        select: {
          diemDonTraId: true,
          tenDiem: true,
          loaiDiem: true,
          trangThai: true,
          nhaXeId: true,
          benTrungChuyenId: true,
        },
      });

      const stationMap = new Map(stations.map((s) => [s.diemDonTraId, s]));
      const validationErrors = validateStopList(dto.points, stationMap, trip.nhaXeId);
      if (validationErrors.length > 0) {
        const first = validationErrors[0];
        throw new BadRequestException({
          error: first.code,
          message: first.message,
          details: validationErrors,
        });
      }
    }

    // Bảo vệ điểm dừng đã có vé bán
    const existingPoints = await this.prisma.diemDonTraChuyenXe.findMany({
      where: { chuyenXeId: tripId },
      include: {
        diemDonTra: { select: { diemDonTraId: true, tenDiem: true } },
        vesDon: {
          where: { trangThai: { not: 'DA_HUY' } },
          select: { veId: true },
        },
        vesTra: {
          where: { trangThai: { not: 'DA_HUY' } },
          select: { veId: true },
        },
      },
    });

    for (const ep of existingPoints) {
      const ticketCount = ep.vesDon.length + ep.vesTra.length;
      if (ticketCount > 0) {
        const match = dto.points?.find(
          (p) => p.diemDonTraId === ep.diemDonTraId && p.loaiDiem === ep.loaiDiem,
        );
        if (!match) {
          throw new ConflictException({
            error: 'POINT_HAS_TICKETS',
            message: `Không thể xóa điểm dừng '${ep.diemDonTra.tenDiem}' (${ep.loaiDiem}) vì đang có ${ticketCount} vé đã chọn điểm này.`,
            affectedTicketsCount: ticketCount,
            diemDonTraId: ep.diemDonTraId,
          });
        }
        const effectivePhutLech = match.phutLech ?? 0;
        if (effectivePhutLech !== ep.phutLech) {
          throw new ConflictException({
            error: 'POINT_HAS_TICKETS',
            message: `Không thể thay đổi giờ/phút lệch của điểm dừng '${ep.diemDonTra.tenDiem}' (${ep.loaiDiem}) vì đang có ${ticketCount} vé đã chọn điểm này.`,
            affectedTicketsCount: ticketCount,
            diemDonTraId: ep.diemDonTraId,
          });
        }
      }
    }

    try {
      const updatedPoints = await this.prisma.$transaction(async (tx) => {
        const incomingKeys = new Set(
          (dto.points ?? []).map((p) => `${p.diemDonTraId}_${p.loaiDiem}`),
        );

        // 1. Xóa các điểm cũ không còn trong danh sách mới (đã kiểm tra ticketCount === 0 ở trên)
        for (const ep of existingPoints) {
          const key = `${ep.diemDonTraId}_${ep.loaiDiem}`;
          if (!incomingKeys.has(key)) {
            await tx.diemDonTraChuyenXe.delete({
              where: { diemDonTraChuyenXeId: ep.diemDonTraChuyenXeId },
            });
          }
        }

        if (!dto.points || dto.points.length === 0) {
          return [];
        }

        // 2. Cập nhật các điểm giữ lại và tạo mới các điểm chưa có
        const existingByKey = new Map(
          existingPoints.map((ep) => [`${ep.diemDonTraId}_${ep.loaiDiem}`, ep]),
        );

        const createdOrUpdated = [];
        for (const p of dto.points) {
          const key = `${p.diemDonTraId}_${p.loaiDiem}`;
          const existingRecord = existingByKey.get(key);
          const phutLech = p.phutLech ?? 0;
          const thoiGianDuKien = calculateClockTime(trip.gioKhoiHanh, phutLech);

          if (existingRecord) {
            const updated = await tx.diemDonTraChuyenXe.update({
              where: { diemDonTraChuyenXeId: existingRecord.diemDonTraChuyenXeId },
              data: {
                thoiGianDuKien,
                phutLech,
                thuTu: p.thuTu,
                phuPhi: p.phuPhi ?? 0,
                phutCoMatTruoc: p.phutCoMatTruoc ?? 15,
                nhanKhach: p.nhanKhach ?? true,
                ghiChu: p.ghiChu ?? null,
              },
              include: {
                diemDonTra: {
                  include: {
                    diaDiemCu: true,
                    diaDiemMoi: true,
                    benTrungChuyen: {
                      select: {
                        diemDonTraId: true,
                        tenDiem: true,
                        maDiem: true,
                        diaChi: true,
                        loaiDiem: true,
                      },
                    },
                  },
                },
              },
            });
            createdOrUpdated.push(updated);
          } else {
            const created = await tx.diemDonTraChuyenXe.create({
              data: {
                chuyenXeId: tripId,
                diemDonTraId: p.diemDonTraId,
                loaiDiem: p.loaiDiem,
                thoiGianDuKien,
                phutLech,
                thuTu: p.thuTu,
                phuPhi: p.phuPhi ?? 0,
                phutCoMatTruoc: p.phutCoMatTruoc ?? 15,
                nhanKhach: p.nhanKhach ?? true,
                ghiChu: p.ghiChu ?? null,
              },
              include: {
                diemDonTra: {
                  include: {
                    diaDiemCu: true,
                    diaDiemMoi: true,
                    benTrungChuyen: {
                      select: {
                        diemDonTraId: true,
                        tenDiem: true,
                        maDiem: true,
                        diaChi: true,
                        loaiDiem: true,
                      },
                    },
                  },
                },
              },
            });
            createdOrUpdated.push(created);
          }
        }
        return createdOrUpdated;
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

  async applyRouteTemplateToTrip(tripId: number, principal: AuthPrincipal) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    if (!principal.roles?.includes('SUPER_ADMIN') && trip.nhaXeId !== principal.nhaXeId) {
      throw new ForbiddenException({
        error: 'FORBIDDEN',
        message: 'Không có quyền cập nhật chuyến xe của nhà xe khác.',
      });
    }

    const templateStops = await this.prisma.tuyenXeDiemDung.findMany({
      where: { tuyenXeId: trip.tuyenXeId },
      orderBy: [{ phutLech: 'asc' }, { thuTu: 'asc' }],
    });

    if (templateStops.length === 0) {
      throw new ConflictException({
        error: 'ROUTE_TEMPLATE_EMPTY',
        message: 'Tuyến xe chưa có khuôn lộ trình để áp dụng.',
      });
    }

    const points = templateStops.map((s) => ({
      diemDonTraId: s.diemDonTraId,
      loaiDiem: s.loaiDiem as 'DON' | 'TRA' | 'NGHI',
      phutLech: s.phutLech,
      thuTu: s.thuTu,
      phuPhi: Number(s.phuPhi),
      phutCoMatTruoc: s.phutCoMatTruoc,
      nhanKhach: s.nhanKhach,
      ghiChu: s.ghiChu ?? undefined,
    }));

    return this.updateTripPassengerPoints(tripId, { points }, principal);
  }
}
