import {
  ConflictException,
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
import { PrismaService } from '../prisma/prisma.service.js';

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

  async findOne(id: number) {
    const company = await this.prisma.nhaXe.findUnique({
      where: { nhaXeId: id },
      select: BUS_COMPANY_SELECT,
    });

    if (!company) {
      throw new NotFoundException({
        error: 'BUS_COMPANY_NOT_FOUND',
        message: 'Không tìm thấy nhà xe.',
      });
    }

    return { data: mapBusCompany(company) };
  }

  async findAll(query: BusCompanyQueryDto) {
    const search = query.search?.trim();
    const where: Prisma.NhaXeWhereInput = {};

    if (search) {
      where.OR = [
        { maNhaXe: { contains: search } },
        { tenNhaXe: { contains: search } },
        { thongTinLienHe: { contains: search } },
      ];
    }
    if (query.status) {
      where.trangThai = query.status;
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
}
