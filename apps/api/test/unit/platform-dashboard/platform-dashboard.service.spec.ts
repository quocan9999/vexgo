import { ConfigService } from '@nestjs/config';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { PlatformDashboardService } from '../../../src/platform-dashboard/platform-dashboard.service.js';

function harness(timeZone?: string) {
  const companyCount = vi
    .fn<(...args: unknown[]) => Promise<number>>()
    .mockResolvedValue(0);
  const employeeCount = vi
    .fn<(...args: unknown[]) => Promise<number>>()
    .mockResolvedValue(0);
  const companies = vi.fn().mockResolvedValue([]);
  const tx = {
    nhaXe: { count: companyCount, findMany: companies },
    nhanVien: { count: employeeCount },
  };
  const transaction = vi.fn(async (work: (client: typeof tx) => unknown) =>
    work(tx),
  );
  const service = new PlatformDashboardService(
    { $transaction: transaction } as unknown as PrismaService,
    new ConfigService(timeZone ? { BUSINESS_TIME_ZONE: timeZone } : {}),
  );
  return { service, transaction, companyCount, employeeCount, companies };
}

afterEach(() => vi.useRealTimers());

describe('platform dashboard aggregate contract', () => {
  it('maps real aggregate results, preserves unknown company statuses and limits list queries', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-24T16:18:00Z'));
    const h = harness();
    // Company calls: total, active, suspended, needing administrator, then six months.
    for (const value of [12, 8, 3, 6, 0, 1, 2, 0, 3, 4])
      h.companyCount.mockResolvedValueOnce(value);
    h.employeeCount.mockResolvedValueOnce(10).mockResolvedValueOnce(7);
    const row = {
      nhaXeId: 17,
      maNhaXe: 'FUTA',
      tenNhaXe: 'Phương Trang',
      trangThai: 'TRANG_THAI_KHAC',
      createdAt: new Date('2026-09-01T00:00:00Z'),
      _count: { nhanViens: 2 },
    };
    h.companies.mockResolvedValueOnce([row]).mockResolvedValueOnce([row]);
    const result = await h.service.getOverview();
    expect(result.companies).toEqual({
      total: 12,
      active: 8,
      suspended: 3,
      other: 1,
      needingAdministrator: 6,
    });
    expect(result.administrators).toEqual({ total: 10, active: 7 });
    expect(result.onboarding.map((item) => item.count)).toEqual([
      0, 1, 2, 0, 3, 4,
    ]);
    expect(result.attentionCompanies).toEqual([
      {
        id: 17,
        code: 'FUTA',
        name: 'Phương Trang',
        status: 'TRANG_THAI_KHAC',
        createdAt: '2026-09-01T00:00:00.000Z',
        activeAdministratorCount: 2,
      },
    ]);
    expect(result.recentCompanies).toEqual(result.attentionCompanies);
    expect(h.companies.mock.calls[0][0]).toMatchObject({
      take: 5,
      orderBy: [{ createdAt: 'asc' }, { nhaXeId: 'asc' }],
    });
    expect(h.companies.mock.calls[1][0]).toMatchObject({
      take: 5,
      orderBy: [{ createdAt: 'desc' }, { nhaXeId: 'desc' }],
    });
    expect(h.transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });

  it('requires a pure tenant administrator role and active account/employment for governance counts', async () => {
    const h = harness();
    await h.service.getOverview();
    const administrator = {
      taiKhoan: {
        is: {
          taiKhoanVaiTros: {
            some: { vaiTro: { is: { tenVaiTro: 'NHA_XE_ADMIN' } } },
            every: {
              vaiTro: {
                is: {
                  tenVaiTro: {
                    in: [
                      'NHA_XE_ADMIN',
                      'NHAN_VIEN_DIEU_HANH',
                      'NHAN_VIEN_BAN_VE',
                      'NHAN_VIEN_CSKH',
                      'NHAN_VIEN_PHU_XE',
                      'NHAN_VIEN_KINH_DOANH',
                    ],
                  },
                },
              },
            },
          },
        },
      },
    };
    const eligible = {
      AND: [
        administrator,
        {
          trangThaiLamViec: 'DANG_LAM_VIEC',
          taiKhoan: { is: { trangThai: 'HOAT_DONG' } },
        },
      ],
    };
    expect(h.employeeCount.mock.calls).toEqual([
      [{ where: administrator }],
      [{ where: eligible }],
    ]);
    const missing = { trangThai: 'HOAT_DONG', nhanViens: { none: eligible } };
    expect(h.companyCount.mock.calls[3]).toEqual([{ where: missing }]);
    expect(h.companies.mock.calls[0][0].where).toEqual(missing);
    for (const [query] of h.companies.mock.calls)
      expect(query.select._count.select.nhanViens.where).toEqual(eligible);
  });

  it.each([
    {
      zone: undefined,
      now: '2026-12-31T17:01:00Z',
      first: '08-2026',
      last: '01-2027',
      start: '2026-07-31T17:00:00.000Z',
      end: '2027-01-31T17:00:00.000Z',
    },
    {
      zone: 'Pacific/Kiritimati',
      now: '2026-12-31T10:01:00Z',
      first: '08-2026',
      last: '01-2027',
      start: '2026-07-31T10:00:00.000Z',
      end: '2027-01-31T10:00:00.000Z',
    },
  ])(
    'uses business calendar months across year boundaries ($zone)',
    async ({ zone, now, first, last, start, end }) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(now));
      const h = harness(zone);
      const result = await h.service.getOverview();
      expect(result.timeZone).toBe(zone ?? 'Asia/Ho_Chi_Minh');
      expect(result.generatedAt).toBe(new Date(now).toISOString());
      expect(result.onboarding.map((period) => period.label)).toEqual([
        first,
        '09-2026',
        '10-2026',
        '11-2026',
        '12-2026',
        last,
      ]);
      expect(result.onboarding.map((period) => period.currentMonth)).toEqual([
        false,
        false,
        false,
        false,
        false,
        true,
      ]);
      const periods = h.companyCount.mock.calls
        .slice(4)
        .map(
          ([query]) =>
            (
              query as {
                where: { createdAt: { gte: Date; lt: Date; lte: Date } };
              }
            ).where.createdAt,
        );
      expect(periods).toHaveLength(6);
      expect(periods[0].gte.toISOString()).toBe(start);
      expect(periods[5].lt.toISOString()).toBe(end);
      periods.forEach((period, index) => {
        expect(period.lte).toEqual(new Date(now));
        if (index > 0) expect(period.gte).toEqual(periods[index - 1].lt);
      });
      expect(result.companies).toEqual({
        total: 0,
        active: 0,
        suspended: 0,
        other: 0,
        needingAdministrator: 0,
      });
      expect(result.attentionCompanies).toEqual([]);
      expect(result.recentCompanies).toEqual([]);
    },
  );

  it('propagates database failure instead of fabricating zero metrics', async () => {
    const h = harness();
    h.companyCount.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(h.service.getOverview()).rejects.toThrow(
      'database unavailable',
    );
  });
});
