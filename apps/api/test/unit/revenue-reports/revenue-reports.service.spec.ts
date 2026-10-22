import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '../../../src/generated/prisma/client.js';
import type { AuthPrincipal } from '../../../src/auth/tokens/auth-principal.js';
import type { PrismaService } from '../../../src/prisma/prisma.service.js';
import { RevenueReportQueryDto } from '../../../src/revenue-reports/dto/revenue-report-query.dto.js';
import { RevenueReportsService } from '../../../src/revenue-reports/revenue-reports.service.js';

const tenantAdmin: AuthPrincipal = {
  taiKhoanId: 10,
  sessionId: 'session-10',
  roles: ['NHA_XE_ADMIN'],
  permissions: ['revenue:read'],
  nhanVienId: 20,
  nhaXeId: 17,
};

function decimal(value: number | string): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

function sale(
  id: number,
  date: string,
  options: {
    ticketPrices?: Array<number | string>;
    shipmentFee?: number | string;
    total: number | string;
  },
) {
  const booking = options.ticketPrices
    ? {
        ves: options.ticketPrices.map((price, index) => ({
          veId: id * 10 + index,
          giaThucTe: decimal(price),
        })),
      }
    : null;
  const shipment =
    options.shipmentFee === undefined
      ? null
      : { tongPhi: decimal(options.shipmentFee) };

  return {
    thanhToanId: id,
    donGiaoDichId: id,
    soTien: decimal(options.total),
    thoiDiemHoanTat: new Date(date),
    donGiaoDich: {
      tongTien: decimal(options.total),
      phieuDatVe: booking,
      phieuGuiHang: shipment,
    },
  };
}

function refund(
  id: number,
  date: string,
  amount: number | string,
  options: { orderId: number; ticketOrderId?: number; accompanied?: boolean },
) {
  const ticketOrderId = options.ticketOrderId ?? options.orderId;
  return {
    thanhToanId: id,
    donGiaoDichId: options.orderId,
    veId: id + 1000,
    soTien: decimal(amount),
    thoiDiemHoanTat: new Date(date),
    ve: {
      veId: id + 1000,
      phieuDatVe: { donGiaoDichId: ticketOrderId },
    },
    donGiaoDich: {
      phieuDatVe: { donGiaoDichId: options.orderId },
      phieuGuiHang: options.accompanied
        ? { donGiaoDichId: options.orderId }
        : null,
    },
  };
}

function zeroTicket(id: number, date: string) {
  return {
    lichSuTrangThaiVeId: id + 5000,
    veId: id,
    thoiDiem: new Date(date),
  };
}

function makeHarness(options?: {
  sales?: unknown[];
  refunds?: unknown[];
  zeroTicketEvents?: unknown[];
}) {
  const paymentFindMany = vi.fn(async (args: unknown) => {
    const where = (args as { where: { loaiGiaoDich: string } }).where;
    return where.loaiGiaoDich === 'THANH_TOAN'
      ? (options?.sales ?? [])
      : (options?.refunds ?? []);
  });
  const zeroTicketFindMany = vi.fn(
    async (_args: unknown) => options?.zeroTicketEvents ?? [],
  );
  const prisma = {
    thanhToan: { findMany: paymentFindMany },
    lichSuTrangThaiVe: { findMany: zeroTicketFindMany },
  } as unknown as PrismaService;

  return {
    service: new RevenueReportsService(prisma),
    paymentFindMany,
    zeroTicketFindMany,
  };
}

const fixedNow = new Date('2026-10-22T05:00:00.000Z');

function query(fromDate: string, toDate: string, groupBy = 'day') {
  return plainToInstance(RevenueReportQueryDto, { fromDate, toDate, groupBy });
}

describe('RevenueReportsService', () => {
  it('keeps exact ticket/shipment splits, refund timing, and zero-value ticket counts', async () => {
    const { service } = makeHarness({
      sales: [
        sale(1, '2026-09-30T17:00:00.000Z', {
          ticketPrices: ['703'],
          total: '703',
        }),
        sale(2, '2026-09-30T17:01:00.000Z', {
          ticketPrices: ['101', '202'],
          shipmentFee: '900',
          total: '1203',
        }),
        sale(3, '2026-10-01T17:00:00.000Z', {
          shipmentFee: '501',
          total: '501',
        }),
      ],
      refunds: [
        refund(21, '2026-10-01T17:00:00.000Z', '101', {
          orderId: 2,
          accompanied: true,
        }),
      ],
      zeroTicketEvents: [zeroTicket(900, '2026-10-01T17:00:00.000Z')],
    });

    const report = await service.getReport(
      query('2026-10-01', '2026-10-02'),
      tenantAdmin,
      fixedNow,
    );

    expect(report.data.totals).toEqual({
      grossReceipts: '2407',
      refundAmount: '101',
      netRevenue: '2306',
      netTicketRevenue: '905',
      netShipmentRevenue: '1401',
      successfulPayments: 3,
      soldTicketCount: 4,
      issuedShipmentCount: 2,
    });
    expect(report.data.serviceBreakdown).toEqual([
      {
        kind: 'ticket',
        label: 'Vé',
        grossReceipts: '703',
        refundAmount: '0',
        netRevenue: '703',
      },
      {
        kind: 'standaloneShipment',
        label: 'Gửi hàng độc lập',
        grossReceipts: '501',
        refundAmount: '0',
        netRevenue: '501',
      },
      {
        kind: 'accompaniedShipment',
        label: 'Gửi hàng kèm vé',
        grossReceipts: '1203',
        refundAmount: '101',
        netRevenue: '1102',
      },
    ]);
    expect(report.data.series).toEqual([
      {
        period: '2026-10-01',
        grossReceipts: '1906',
        refundAmount: '0',
        netRevenue: '1906',
        netTicketRevenue: '1006',
        netShipmentRevenue: '900',
        successfulPayments: 2,
        soldTicketCount: 3,
        issuedShipmentCount: 1,
      },
      {
        period: '2026-10-02',
        grossReceipts: '501',
        refundAmount: '101',
        netRevenue: '400',
        netTicketRevenue: '-101',
        netShipmentRevenue: '501',
        successfulPayments: 1,
        soldTicketCount: 1,
        issuedShipmentCount: 1,
      },
    ]);
    expect(report.meta).toEqual({
      fromDate: '2026-10-01',
      toDate: '2026-10-02',
      groupBy: 'day',
      timezone: 'Asia/Ho_Chi_Minh',
    });
  });

  it('uses only principal tenant scope for every source query, including attempted query overrides', async () => {
    const { service, paymentFindMany, zeroTicketFindMany } = makeHarness();
    await service.getReport(
      Object.assign(query('2026-10-01', '2026-10-01'), {
        nhaXeId: 999,
        busCompanyId: 888,
      }) as RevenueReportQueryDto,
      tenantAdmin,
      fixedNow,
    );

    const paymentScopes = paymentFindMany.mock.calls.map(
      ([args]) =>
        (args as { where: { donGiaoDich: { nhaXeId: number } } }).where
          .donGiaoDich.nhaXeId,
    );
    const zeroTicketScope = (
      zeroTicketFindMany.mock.calls[0]?.[0] as {
        where: {
          ve: {
            phieuDatVe: { donGiaoDich: { nhaXeId: number } };
          };
        };
      }
    ).where.ve.phieuDatVe.donGiaoDich.nhaXeId;

    expect(paymentScopes).toEqual([17, 17]);
    expect(zeroTicketScope).toBe(17);
    expect(paymentFindMany.mock.calls[0]?.[0]).toMatchObject({
      where: {
        loaiGiaoDich: 'THANH_TOAN',
        trangThai: 'THANH_CONG',
        laQuyetToanHopLe: true,
        donGiaoDich: { nhaXeId: 17 },
      },
    });
    expect(paymentFindMany.mock.calls[1]?.[0]).toMatchObject({
      where: {
        loaiGiaoDich: 'HOAN_TIEN',
        trangThai: 'THANH_CONG',
        donGiaoDich: { nhaXeId: 17 },
      },
    });
    const zeroQuery = zeroTicketFindMany.mock.calls[0]?.[0] as {
      where: {
        trangThaiCu: string;
        trangThaiMoi: string;
        nguonThayDoi: string;
        taiKhoanId: null;
        lyDo: string;
        laOverride: boolean;
        thoiDiem: { gte: Date; lt: Date };
        ve: {
          phieuDatVe: {
            donGiaoDich: {
              nhaXeId: number;
              tongTien: Prisma.Decimal;
              thanhToans: { none: Record<string, never> };
            };
          };
        };
      };
    };
    expect(zeroQuery.where).toMatchObject({
      trangThaiCu: 'DA_DAT',
      trangThaiMoi: 'DA_THANH_TOAN',
      nguonThayDoi: 'SYSTEM',
      taiKhoanId: null,
      lyDo: 'Đơn 0đ – miễn thanh toán',
      laOverride: false,
      ve: {
        phieuDatVe: {
          donGiaoDich: {
            nhaXeId: 17,
            thanhToans: { none: {} },
          },
        },
      },
    });
    expect(zeroQuery.where.ve.phieuDatVe.donGiaoDich.tongTien.eq(0)).toBe(true);
    expect(zeroQuery.where.thoiDiem).toEqual({
      gte: new Date('2026-09-30T17:00:00.000Z'),
      lt: new Date('2026-10-01T17:00:00.000Z'),
    });
  });

  it('fails closed when settlement split and payment snapshot disagree', async () => {
    const { service } = makeHarness({
      sales: [
        sale(1, '2026-10-01T05:00:00.000Z', {
          ticketPrices: ['100'],
          total: '101',
        }),
      ],
    });

    await expect(
      service.getReport(
        query('2026-10-01', '2026-10-01'),
        tenantAdmin,
        fixedNow,
      ),
    ).rejects.toMatchObject({
      response: { error: 'REVENUE_SOURCE_DATA_INVALID' },
    });
  });

  it('fails closed on multiple eligible settlements for the same order', async () => {
    const sameOrderSales = [1, 2].map((id) => ({
      ...sale(id, `2026-10-01T0${id + 4}:00:00.000Z`, {
        ticketPrices: ['100'],
        total: '100',
      }),
      donGiaoDichId: 500,
    }));
    const duplicateHarness = makeHarness({ sales: sameOrderSales });

    await expect(
      duplicateHarness.service.getReport(
        query('2026-10-01', '2026-10-01'),
        tenantAdmin,
        fixedNow,
      ),
    ).rejects.toMatchObject({
      response: { error: 'REVENUE_SOURCE_DATA_INVALID' },
    });
  });

  it('fails closed when a refund ticket belongs to a different order', async () => {
    const { service } = makeHarness({
      refunds: [
        refund(21, '2026-10-01T05:00:00.000Z', '1', {
          orderId: 200,
          ticketOrderId: 201,
        }),
      ],
    });

    await expect(
      service.getReport(
        query('2026-10-01', '2026-10-01'),
        tenantAdmin,
        fixedNow,
      ),
    ).rejects.toMatchObject({
      response: { error: 'REVENUE_SOURCE_DATA_INVALID' },
    });
  });

  it('buckets exact whole-VND values at Vietnam month, year, and quarter boundaries', async () => {
    const events = [
      sale(90, '2026-12-31T16:59:00.000Z', {
        ticketPrices: ['1'],
        total: '1',
      }),
      sale(91, '2026-12-31T17:00:00.000Z', {
        shipmentFee: '2',
        total: '2',
      }),
    ];
    const monthly = await makeHarness({ sales: events }).service.getReport(
      query('2026-12-31', '2027-01-01', 'month'),
      tenantAdmin,
      fixedNow,
    );
    const quarterly = await makeHarness({ sales: events }).service.getReport(
      query('2026-12-31', '2027-01-01', 'quarter'),
      tenantAdmin,
      fixedNow,
    );

    expect(monthly.data.series.map(({ period }) => period)).toEqual([
      '2026-12',
      '2027-01',
    ]);
    expect(monthly.data.totals.netRevenue).toBe('3');
    expect(monthly.data.totals.netTicketRevenue).toBe('1');
    expect(monthly.data.totals.netShipmentRevenue).toBe('2');
    expect(quarterly.data.series.map(({ period }) => period)).toEqual([
      '2026-Q4',
      '2027-Q1',
    ]);
    expect(
      quarterly.data.series.map(({ grossReceipts }) => grossReceipts),
    ).toEqual(['1', '2']);
  });

  it('defaults an empty query to the current business month and returns empty buckets', async () => {
    const { service } = makeHarness();
    const report = await service.getReport(
      plainToInstance(RevenueReportQueryDto, {}),
      tenantAdmin,
      fixedNow,
    );

    expect(report.meta).toEqual({
      fromDate: '2026-10-01',
      toDate: '2026-10-22',
      groupBy: 'day',
      timezone: 'Asia/Ho_Chi_Minh',
    });
    expect(report.data.series).toHaveLength(22);
    expect(report.data.totals.grossReceipts).toBe('0');
    expect(report.data.serviceBreakdown).toHaveLength(3);
  });
});

const invalidQueries: Array<{
  label: string;
  value: Record<string, unknown>;
}> = [
  {
    label: 'invalid calendar date',
    value: { fromDate: '2026-02-30', toDate: '2026-03-01' },
  },
  {
    label: 'reversed range',
    value: { fromDate: '2026-10-02', toDate: '2026-10-01' },
  },
  { label: 'one-sided range', value: { fromDate: '2026-10-01' } },
  {
    label: 'range exceeding 366 days',
    value: { fromDate: '2025-10-01', toDate: '2026-10-02' },
  },
  {
    label: 'unsupported grouping',
    value: { fromDate: '2026-10-01', toDate: '2026-10-02', groupBy: 'week' },
  },
  {
    label: 'tenant id in request',
    value: { fromDate: '2026-10-01', toDate: '2026-10-02', nhaXeId: 17 },
  },
];

describe('RevenueReportQueryDto', () => {
  it.each(invalidQueries)('rejects $label', ({ value }) => {
    const dto = plainToInstance(RevenueReportQueryDto, value);
    expect(
      validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }).length,
    ).toBeGreaterThan(0);
  });

  it('accepts valid date-only bounds and quarter grouping', () => {
    const dto = query('2026-10-01', '2026-10-02', 'quarter');
    expect(validateSync(dto)).toHaveLength(0);
  });
});
