import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import type { BusCompanySortField } from './dto/bus-company-query.dto.js';
import type { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

const DEFAULT_BUSINESS_TIME_ZONE = 'Asia/Ho_Chi_Minh';

function addDays(dateOnly: string, days: number) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function businessDateStartUtc(dateOnly: string, timeZone: string) {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const targetUtc = Date.UTC(year, month - 1, day);
  const formatter = new Intl.DateTimeFormat('en-GB-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  let candidateUtc = targetUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = formatter.formatToParts(new Date(candidateUtc));
    const partValue = (type: Intl.DateTimeFormatPartTypes) => {
      const value = parts.find((part) => part.type === type)?.value;
      if (!value) throw new Error(`Missing ${type} while resolving business date.`);
      return Number(value);
    };
    const representedAsUtc = Date.UTC(
      partValue('year'),
      partValue('month') - 1,
      partValue('day'),
      partValue('hour'),
      partValue('minute'),
      partValue('second'),
    );
    const nextCandidateUtc = targetUtc - (representedAsUtc - candidateUtc);
    if (nextCandidateUtc === candidateUtc) break;
    candidateUtc = nextCandidateUtc;
  }

  return new Date(candidateUtc);
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

@Injectable()
export class BusCompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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
      const businessTimeZone =
        this.config.get<string>('BUSINESS_TIME_ZONE') ??
        DEFAULT_BUSINESS_TIME_ZONE;
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
        select: {
          nhaXeId: true,
          maNhaXe: true,
          tenNhaXe: true,
          thongTinLienHe: true,
          chinhSachDoiHuy: true,
          trangThai: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.nhaXe.count({ where }),
    ]);

    return {
      data: companies.map((company) => ({
        busCompanyId: company.nhaXeId,
        code: company.maNhaXe,
        name: company.tenNhaXe,
        contactInfo: company.thongTinLienHe,
        cancellationPolicy: company.chinhSachDoiHuy,
        status: company.trangThai,
        createdAt: company.createdAt.toISOString(),
        updatedAt: company.updatedAt.toISOString(),
      })),
      meta: {
        page: query.page,
        pageSize: query.pageSize,
        totalItems,
        totalPages: Math.ceil(totalItems / query.pageSize),
      },
    };
  }
}
