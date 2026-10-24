import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { TENANT_PRINCIPAL_ROLES } from '../auth/principal-scope.js';
import {
  businessDateStartUtc,
  getBusinessDate,
  resolveBusinessTimeZone,
} from '../common/time/business-date.js';

const administratorWhere = {
  taiKhoan: {
    is: {
      taiKhoanVaiTros: {
        some: { vaiTro: { is: { tenVaiTro: 'NHA_XE_ADMIN' } } },
        every: {
          vaiTro: { is: { tenVaiTro: { in: [...TENANT_PRINCIPAL_ROLES] } } },
        },
      },
    },
  },
} satisfies Prisma.NhanVienWhereInput;

const activeAdministratorWhere = {
  AND: [
    administratorWhere,
    {
      trangThaiLamViec: 'DANG_LAM_VIEC',
      taiKhoan: { is: { trangThai: 'HOAT_DONG' } },
    },
  ],
} satisfies Prisma.NhanVienWhereInput;

const needingAdministratorWhere = {
  trangThai: 'HOAT_DONG',
  nhanViens: { none: activeAdministratorWhere },
} satisfies Prisma.NhaXeWhereInput;

const companySelect = {
  nhaXeId: true,
  maNhaXe: true,
  tenNhaXe: true,
  trangThai: true,
  createdAt: true,
  _count: { select: { nhanViens: { where: activeAdministratorWhere } } },
} satisfies Prisma.NhaXeSelect;

type CompanyRecord = Prisma.NhaXeGetPayload<{ select: typeof companySelect }>;

function companySummary(company: CompanyRecord) {
  return {
    id: company.nhaXeId,
    code: company.maNhaXe,
    name: company.tenNhaXe,
    status: company.trangThai,
    createdAt: company.createdAt.toISOString(),
    activeAdministratorCount: company._count.nhanViens,
  };
}

@Injectable()
export class PlatformDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getOverview() {
    const now = new Date();
    const timeZone = resolveBusinessTimeZone(
      this.config.get<string>('BUSINESS_TIME_ZONE'),
    );
    const [year, month] = getBusinessDate(timeZone, now).split('-').map(Number);
    const months = Array.from({ length: 6 }, (_, index) => {
      const first = new Date(Date.UTC(year, month - 6 + index, 1));
      const next = new Date(Date.UTC(year, month - 5 + index, 1));
      return {
        label: `${String(first.getUTCMonth() + 1).padStart(2, '0')}-${first.getUTCFullYear()}`,
        start: businessDateStartUtc(first.toISOString().slice(0, 10), timeZone),
        end: businessDateStartUtc(next.toISOString().slice(0, 10), timeZone),
      };
    });

    return this.prisma.$transaction(
      async (tx) => {
        const [
          total,
          active,
          suspended,
          administratorTotal,
          administratorActive,
          needingAdministrator,
          attention,
          recent,
          ...monthCounts
        ] = await Promise.all([
          tx.nhaXe.count(),
          tx.nhaXe.count({ where: { trangThai: 'HOAT_DONG' } }),
          tx.nhaXe.count({ where: { trangThai: 'TAM_NGUNG' } }),
          tx.nhanVien.count({ where: administratorWhere }),
          tx.nhanVien.count({ where: activeAdministratorWhere }),
          tx.nhaXe.count({ where: needingAdministratorWhere }),
          tx.nhaXe.findMany({
            where: needingAdministratorWhere,
            select: companySelect,
            orderBy: [{ createdAt: 'asc' }, { nhaXeId: 'asc' }],
            take: 5,
          }),
          tx.nhaXe.findMany({
            select: companySelect,
            orderBy: [{ createdAt: 'desc' }, { nhaXeId: 'desc' }],
            take: 5,
          }),
          ...months.map((period) =>
            tx.nhaXe.count({
              where: {
                createdAt: { gte: period.start, lt: period.end, lte: now },
              },
            }),
          ),
        ] as const);

        return {
          generatedAt: now.toISOString(),
          timeZone,
          companies: {
            total,
            active,
            suspended,
            other: total - active - suspended,
            needingAdministrator,
          },
          administrators: {
            total: administratorTotal,
            active: administratorActive,
          },
          onboarding: months.map((period, index) => ({
            label: period.label,
            count: monthCounts[index],
            currentMonth: index === months.length - 1,
          })),
          attentionCompanies: attention.map(companySummary),
          recentCompanies: recent.map(companySummary),
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
