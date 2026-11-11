import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import {
  businessDateStartUtc,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';
import type { CreateBusCompanyDto } from './dto/create-bus-company.dto.js';
import type { UpdateBusCompanyDto } from './dto/update-bus-company.dto.js';
import type { UpdateBusCompanyStatusDto } from './dto/update-bus-company-status.dto.js';
import type { BusCompanySortField } from './dto/bus-company-query.dto.js';
import type { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import {
  DEFAULT_LUGGAGE_RATES,
  resolveEffectiveLuggageRates,
  type UpdateLuggageRatesDto,
} from './dto/luggage-rates.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import {
  assertTenantScope,
  requireTenantPrincipal,
} from '../auth/tenant-scope.js';

interface BusCompanyReadScope {
  platformWide: boolean;
  tenantId: number | null;
}

function resolveReadScope(principal?: AuthPrincipal): BusCompanyReadScope {
  const isSuperAdmin = principal?.roles.includes('SUPER_ADMIN') ?? false;
  const platformWide =
    isSuperAdmin &&
    (principal?.permissions.includes('bus-company:read') ?? false);
  const tenantId = isSuperAdmin ? null : (principal?.nhaXeId ?? null);

  if (principal?.roles.includes('NHA_XE_ADMIN') && tenantId === null) {
    throw new ForbiddenException({
      error: 'TENANT_SCOPE_REQUIRED',
      message: 'Tài khoản nhà xe chưa được gắn phạm vi nhà xe.',
    });
  }

  return { platformWide, tenantId };
}

function addDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

const sortFieldMap = {
  name: 'tenNhaXe',
  code: 'maNhaXe',
  status: 'trangThai',
  createdAt: 'createdAt',
} satisfies Record<
  BusCompanySortField,
  keyof Prisma.NhaXeOrderByWithRelationInput
>;

const BUS_COMPANY_SELECT = {
  nhaXeId: true,
  maNhaXe: true,
  tenNhaXe: true,
  thongTinLienHe: true,
  trangThai: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.NhaXeSelect;

type BusCompanyRecord = Prisma.NhaXeGetPayload<{
  select: typeof BUS_COMPANY_SELECT;
}>;

function mapBusCompany(company: BusCompanyRecord) {
  return {
    busCompanyId: company.nhaXeId,
    code: company.maNhaXe,
    name: company.tenNhaXe,
    contactInfo: company.thongTinLienHe,
    status: company.trangThai,
    createdAt: company.createdAt.toISOString(),
    updatedAt: company.updatedAt.toISOString(),
  };
}

function isBusCompanyCodeUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  ) {
    return false;
  }

  const target = error.meta?.target;
  const isCodeTarget = (value: unknown) =>
    value === 'maNhaXe' || value === 'NhaXe_maNhaXe_key';

  if (
    Array.isArray(target)
      ? target.length === 1 && isCodeTarget(target[0])
      : isCodeTarget(target)
  ) {
    return true;
  }

  const adapterError = error.meta?.driverAdapterError;
  if (
    typeof adapterError !== 'object' ||
    adapterError === null ||
    !('cause' in adapterError)
  ) {
    return false;
  }

  const cause = adapterError.cause;
  if (
    typeof cause !== 'object' ||
    cause === null ||
    !('kind' in cause) ||
    cause.kind !== 'UniqueConstraintViolation' ||
    !('constraint' in cause)
  ) {
    return false;
  }

  const constraint = cause.constraint;
  return (
    typeof constraint === 'object' &&
    constraint !== null &&
    'index' in constraint &&
    constraint.index === 'NhaXe_maNhaXe_key'
  );
}

@Injectable()
export class BusCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(input: CreateBusCompanyDto) {
    try {
      const company = await this.prisma.nhaXe.create({
        data: {
          maNhaXe: input.code,
          tenNhaXe: input.name,
          thongTinLienHe: input.contactInfo ?? null,
          trangThai: input.status,
        },
        select: BUS_COMPANY_SELECT,
      });

      return { data: mapBusCompany(company) };
    } catch (error) {
      if (isBusCompanyCodeUniqueViolation(error)) {
        throw new ConflictException({
          error: 'BUS_COMPANY_CODE_EXISTS',
          message: 'Mã nhà xe đã tồn tại.',
        });
      }

      throw error;
    }
  }

  async update(id: number, input: UpdateBusCompanyDto) {
    try {
      const company = await this.prisma.nhaXe.update({
        where: { nhaXeId: id },
        data: {
          maNhaXe: input.code,
          tenNhaXe: input.name,
          thongTinLienHe: input.contactInfo ?? null,
        },
        select: BUS_COMPANY_SELECT,
      });

      return { data: mapBusCompany(company) };
    } catch (error) {
      if (isBusCompanyCodeUniqueViolation(error)) {
        throw new ConflictException({
          error: 'BUS_COMPANY_CODE_EXISTS',
          message: 'Mã nhà xe đã tồn tại.',
        });
      }

      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          error: 'BUS_COMPANY_NOT_FOUND',
          message: 'Không tìm thấy nhà xe.',
        });
      }

      throw error;
    }
  }

  async updateStatus(id: number, input: UpdateBusCompanyStatusDto) {
    try {
      const company = await this.prisma.nhaXe.update({
        where: { nhaXeId: id },
        data: { trangThai: input.status },
        select: BUS_COMPANY_SELECT,
      });

      return { data: mapBusCompany(company) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException({
          error: 'BUS_COMPANY_NOT_FOUND',
          message: 'Không tìm thấy nhà xe.',
        });
      }

      throw error;
    }
  }

  async findOne(id: number, principal?: AuthPrincipal) {
    const { platformWide, tenantId } = resolveReadScope(principal);
    if (tenantId !== null && tenantId !== id) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }

    const company = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId: id },
      select: BUS_COMPANY_SELECT,
    });

    if (
      !company ||
      (!platformWide && tenantId === null && company.trangThai !== 'HOAT_DONG')
    ) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }

    return { data: mapBusCompany(company) };
  }

  async findAll(query: BusCompanyQueryDto, principal?: AuthPrincipal) {
    const { platformWide, tenantId } = resolveReadScope(principal);
    const search = query.search?.trim();
    const where: Prisma.NhaXeWhereInput = {};

    if (tenantId !== null) {
      where.nhaXeId = tenantId;
    }

    if (search) {
      where.OR = [
        { maNhaXe: { contains: search } },
        { tenNhaXe: { contains: search } },
        { thongTinLienHe: { contains: search } },
      ];
    }
    if (platformWide || tenantId !== null) {
      if (query.status) where.trangThai = query.status;
    } else {
      // The endpoint is also used for public discovery; never let a client
      // widen it to paused companies with a query parameter.
      where.trangThai = 'HOAT_DONG';
    }
    if (query.createdFrom || query.createdTo) {
      const businessTimeZone = resolveBusinessTimeZone(
        this.config.get<string>('BUSINESS_TIME_ZONE'),
      );
      where.createdAt = {
        ...(query.createdFrom
          ? { gte: businessDateStartUtc(query.createdFrom, businessTimeZone) }
          : {}),
        ...(query.createdTo
          ? {
              lt: businessDateStartUtc(
                addDays(query.createdTo, 1),
                businessTimeZone,
              ),
            }
          : {}),
      };
    }

    const orderBy: Prisma.NhaXeOrderByWithRelationInput = {
      [sortFieldMap[query.sortBy]]: query.sortDirection ?? 'asc',
    };
    const skip = (query.page - 1) * query.pageSize;

    const [companies, totalItems] = await Promise.all([
      this.prisma.nhaXe.findMany({
        where,
        orderBy,
        skip,
        take: query.pageSize,
        select: BUS_COMPANY_SELECT,
      }),
      this.prisma.nhaXe.count({ where }),
    ]);

    return {
      data: companies.map(mapBusCompany),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }

  private assertLuggageRateAccess(
    busCompanyId: number,
    principal: AuthPrincipal | undefined,
    requiredPermission: 'luggage-rate:read' | 'luggage-rate:update',
  ): number {
    const trustedNhaXeId = requireTenantPrincipal(principal);
    if (!principal?.permissions?.includes(requiredPermission)) {
      throw new ForbiddenException({
        error: 'PERMISSION_FORBIDDEN',
        message: 'Tài khoản không có quyền thực hiện thao tác này.',
      });
    }
    assertTenantScope(busCompanyId, trustedNhaXeId);
    return trustedNhaXeId;
  }

  private async loadLuggageRatesForTenant(trustedNhaXeId: number) {
    const company = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId: trustedNhaXeId },
      select: {
        nhaXeId: true,
        tenNhaXe: true,
        cauHinhHanhLy: true,
        tuyenXes: {
          select: {
            tuyenXeId: true,
            maTuyenXe: true,
            diemDi: true,
            diemDen: true,
          },
        },
      },
    });

    if (!company) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }

    let parsed: any = null;
    if (company.cauHinhHanhLy) {
      try {
        parsed = JSON.parse(company.cauHinhHanhLy);
      } catch {
        parsed = null;
      }
    }

    const defaultRates = {
      ...DEFAULT_LUGGAGE_RATES,
      ...parsed?.default,
    };

    const routesOverrides = parsed?.routes ?? {};

    return {
      data: {
        busCompanyId: company.nhaXeId,
        busCompanyName: company.tenNhaXe,
        default: defaultRates,
        routes: routesOverrides,
        availableRoutes: company.tuyenXes.map((t) => ({
          routeId: t.tuyenXeId,
          code: t.maTuyenXe,
          origin: t.diemDi,
          destination: t.diemDen,
          hasOverride: Boolean(
            routesOverrides[t.tuyenXeId] && !routesOverrides[t.tuyenXeId].inherit,
          ),
        })),
      },
    };
  }

  async getLuggageRates(busCompanyId: number, principal?: AuthPrincipal) {
    const trustedNhaXeId = this.assertLuggageRateAccess(
      busCompanyId,
      principal,
      'luggage-rate:read',
    );
    return this.loadLuggageRatesForTenant(trustedNhaXeId);
  }

  async updateLuggageRates(
    busCompanyId: number,
    dto: UpdateLuggageRatesDto,
    principal?: AuthPrincipal,
  ) {
    const trustedNhaXeId = this.assertLuggageRateAccess(
      busCompanyId,
      principal,
      'luggage-rate:update',
    );

    const company = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId: trustedNhaXeId },
      select: { nhaXeId: true },
    });

    if (!company) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }

    const payloadString = JSON.stringify({
      default: dto.default,
      routes: dto.routes ?? {},
      updatedAt: new Date().toISOString(),
    });

    await this.prisma.nhaXe.update({
      where: { nhaXeId: trustedNhaXeId },
      data: {
        cauHinhHanhLy: payloadString,
      },
    });

    return this.loadLuggageRatesForTenant(trustedNhaXeId);
  }

  async getTripLuggageRates(tripId: number) {
    const trip = await this.prisma.chuyenXe.findUnique({
      where: { chuyenXeId: tripId },
      select: {
        chuyenXeId: true,
        tuyenXeId: true,
        tuyenXe: {
          select: {
            tuyenXeId: true,
            nhaXeId: true,
            nhaXe: {
              select: {
                nhaXeId: true,
                tenNhaXe: true,
                cauHinhHanhLy: true,
              },
            },
          },
        },
      },
    });

    if (!trip) {
      throw new NotFoundException({
        error: 'TRIP_NOT_FOUND',
        message: 'Không tìm thấy chuyến xe.',
      });
    }

    const company = trip.tuyenXe.nhaXe;
    const effectiveRates = resolveEffectiveLuggageRates(
      company?.cauHinhHanhLy,
      trip.tuyenXeId,
    );

    const sMaxKg = effectiveRates.packageSMaxKg ?? 5;
    const mMaxKg = effectiveRates.packageMMaxKg ?? 10;
    const lMaxKg = effectiveRates.packageLMaxKg ?? 20;
    const xlMaxKg = effectiveRates.packageXLMaxKg ?? 35;

    return {
      data: {
        tripId,
        routeId: trip.tuyenXeId,
        busCompanyId: company.nhaXeId,
        busCompanyName: company.tenNhaXe,
        rates: effectiveRates,
        packages: [
          {
            code: 'S',
            name: 'Gói Kiện Nhỏ (Size S)',
            shortName: `Size S (≤ ${sMaxKg}kg)`,
            weight: sMaxKg,
            length: 40,
            width: 25,
            height: 25,
            baseFee: effectiveRates.packageS,
            ruleText: `Tối đa ${sMaxKg}kg • Không quá 40×25×25cm`,
            examples: 'Balo du lịch, túi quà nhỏ, hộp carton nhỏ',
          },
          {
            code: 'M',
            name: 'Gói Tiêu Chuẩn (Size M)',
            shortName: `Size M (≤ ${mMaxKg}kg)`,
            weight: mMaxKg,
            length: 50,
            width: 40,
            height: 25,
            baseFee: effectiveRates.packageM,
            ruleText: `Tối đa ${mMaxKg}kg • Không quá 50×40×25cm`,
            examples: 'Vali cỡ vừa (20–24 inch), thùng trái cây vừa',
          },
          {
            code: 'L',
            name: 'Gói Kiện Lớn (Size L)',
            shortName: `Size L (≤ ${lMaxKg}kg)`,
            weight: lMaxKg,
            length: 60,
            width: 40,
            height: 40,
            baseFee: effectiveRates.packageL,
            ruleText: `Tối đa ${lMaxKg}kg • Không quá 60×40×40cm`,
            examples: 'Vali đại (28 inch), thùng xốp lớn, kiện hàng nặng',
          },
          {
            code: 'XL',
            name: 'Gói Cồng Kềnh (Size XL)',
            shortName: `Size XL (≤ ${xlMaxKg}kg)`,
            weight: xlMaxKg,
            length: 80,
            width: 50,
            height: 40,
            baseFee: effectiveRates.packageXL,
            ruleText: `Tối đa ${xlMaxKg}kg • Không quá 80×50×40cm`,
            examples: 'Thùng hải sản/trái cây lớn, kiện hàng cồng kềnh',
          },
        ],
        vehicles: {
          motorcycleWave: effectiveRates.motorcycleWave,
          motorcycleScooter: effectiveRates.motorcycleScooter,
          motorcycleBig: effectiveRates.motorcycleBig,
          bicycle: effectiveRates.bicycle,
        },
        surcharges: {
          fragile: effectiveRates.fragileSurcharge,
          valuable: effectiveRates.valuableSurcharge,
        },
        maxFreeWeightKg: effectiveRates.maxFreeWeightKg,
      },
    };
  }
}
