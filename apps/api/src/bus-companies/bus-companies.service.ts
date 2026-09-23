import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import type { BusCompanySortField } from './dto/bus-company-query.dto.js';
import type { BusCompanyQueryDto } from './dto/bus-company-query.dto.js';
import { PrismaService } from '../prisma/prisma.service.js';

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
  constructor(private readonly prisma: PrismaService) {}

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
    if (query.status === 'ACTIVE') {
      where.trangThai = { in: ['ACTIVE', 'HOAT_DONG'] };
    } else if (query.status) {
      where.trangThai = query.status;
    }
    if (query.createdFrom || query.createdTo) {
      where.createdAt = {
        ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
        ...(query.createdTo ? { lte: new Date(query.createdTo) } : {}),
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
