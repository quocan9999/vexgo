import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { requireTenantPrincipal } from '../auth/tenant-scope.js';
import type { AuthPrincipal } from '../auth/tokens/auth-principal.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  REVENUE_REPORT_MAX_DAYS,
  REVENUE_REPORT_TIMEZONE,
  type RevenueReportGroupBy,
  type RevenueReportQueryDto,
} from './dto/revenue-report-query.dto.js';

const ZERO_VALUE_TICKET_REASON = 'Đơn 0đ – miễn thanh toán';

const SALE_EVENT_SELECT = {
  thanhToanId: true,
  donGiaoDichId: true,
  soTien: true,
  thoiDiemHoanTat: true,
  donGiaoDich: {
    select: {
      tongTien: true,
      phieuDatVe: {
        select: { ves: { select: { veId: true, giaThucTe: true } } },
      },
      phieuGuiHang: { select: { tongPhi: true } },
    },
  },
} satisfies Prisma.ThanhToanSelect;

const REFUND_EVENT_SELECT = {
  thanhToanId: true,
  donGiaoDichId: true,
  veId: true,
  soTien: true,
  thoiDiemHoanTat: true,
  ve: {
    select: {
      veId: true,
      phieuDatVe: { select: { donGiaoDichId: true } },
    },
  },
  donGiaoDich: {
    select: {
      phieuDatVe: { select: { donGiaoDichId: true } },
      phieuGuiHang: { select: { donGiaoDichId: true } },
      // The original sale can be outside the requested reporting period.
      thanhToans: {
        where: { loaiGiaoDich: 'THANH_TOAN', trangThai: 'THANH_CONG' },
        select: { laQuyetToanHopLe: true, thoiDiemHoanTat: true },
      },
    },
  },
} satisfies Prisma.ThanhToanSelect;

const ZERO_TICKET_EVENT_SELECT = {
  lichSuTrangThaiVeId: true,
  veId: true,
  thoiDiem: true,
} satisfies Prisma.LichSuTrangThaiVeSelect;

type SaleEvent = Prisma.ThanhToanGetPayload<{
  select: typeof SALE_EVENT_SELECT;
}>;
type RefundEvent = Prisma.ThanhToanGetPayload<{
  select: typeof REFUND_EVENT_SELECT;
}>;
type ZeroTicketEvent = Prisma.LichSuTrangThaiVeGetPayload<{
  select: typeof ZERO_TICKET_EVENT_SELECT;
}>;

type ServiceKind = 'ticket' | 'standaloneShipment' | 'accompaniedShipment';

interface DateRange {
  fromDate: string;
  toDate: string;
  startAt: Date;
  endAt: Date;
}

interface MutableAmounts {
  grossReceipts: Prisma.Decimal;
  refundAmount: Prisma.Decimal;
  netTicketRevenue: Prisma.Decimal;
  netShipmentRevenue: Prisma.Decimal;
  successfulPayments: number;
  soldTicketCount: number;
  issuedShipmentCount: number;
}

interface MutableBreakdown {
  grossReceipts: Prisma.Decimal;
  refundAmount: Prisma.Decimal;
}

export interface RevenueReportMoney {
  grossReceipts: string;
  refundAmount: string;
  netRevenue: string;
  netTicketRevenue: string;
  netShipmentRevenue: string;
}

export interface RevenueReportSeriesItem extends RevenueReportMoney {
  period: string;
  successfulPayments: number;
  soldTicketCount: number;
  issuedShipmentCount: number;
}

function invalidSourceData(): never {
  throw new InternalServerErrorException({
    error: 'REVENUE_SOURCE_DATA_INVALID',
    message: 'Dữ liệu nguồn doanh thu không nhất quán.',
  });
}

function badDateRange(): never {
  throw new BadRequestException({
    error: 'VALIDATION_ERROR',
    message: 'Khoảng ngày báo cáo không hợp lệ.',
  });
}

function isDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1000) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function dateAtBusinessMidnight(value: string): Date {
  return new Date(`${value}T00:00:00.000+07:00`);
}

function addCalendarDays(value: string, days: number): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function inclusiveDays(fromDate: string, toDate: string): number {
  return (
    Math.floor(
      (Date.parse(`${toDate}T00:00:00.000Z`) -
        Date.parse(`${fromDate}T00:00:00.000Z`)) /
        86_400_000,
    ) + 1
  );
}

function businessDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REVENUE_REPORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = new Map(parts.map(({ type, value }) => [type, value]));
  const year = values.get('year');
  const month = values.get('month');
  const day = values.get('day');
  if (!year || !month || !day) invalidSourceData();
  return `${year.padStart(4, '0')}-${month}-${day}`;
}

function resolveDateRange(query: RevenueReportQueryDto, now: Date): DateRange {
  const today = businessDate(now);
  let fromDate: string;
  let toDate: string;

  if (query.fromDate === undefined && query.toDate === undefined) {
    fromDate = `${today.slice(0, 7)}-01`;
    toDate = today;
  } else if (query.fromDate === undefined || query.toDate === undefined) {
    return badDateRange();
  } else {
    fromDate = query.fromDate;
    toDate = query.toDate;
  }

  if (
    !isDateOnly(fromDate) ||
    !isDateOnly(toDate) ||
    toDate < fromDate ||
    inclusiveDays(fromDate, toDate) > REVENUE_REPORT_MAX_DAYS
  ) {
    return badDateRange();
  }

  const dayAfterToDate = addCalendarDays(toDate, 1);
  if (!isDateOnly(dayAfterToDate)) return badDateRange();

  return {
    fromDate,
    toDate,
    startAt: dateAtBusinessMidnight(fromDate),
    endAt: dateAtBusinessMidnight(dayAfterToDate),
  };
}

function periodForDate(date: string, groupBy: RevenueReportGroupBy): string {
  if (groupBy === 'day') return date;
  const month = date.slice(5, 7);
  if (groupBy === 'month') return date.slice(0, 7);
  return `${date.slice(0, 4)}-Q${Math.floor((Number(month) - 1) / 3) + 1}`;
}

function periodForInstant(date: Date, groupBy: RevenueReportGroupBy): string {
  return periodForDate(businessDate(date), groupBy);
}

function createAmounts(): MutableAmounts {
  return {
    grossReceipts: new Prisma.Decimal(0),
    refundAmount: new Prisma.Decimal(0),
    netTicketRevenue: new Prisma.Decimal(0),
    netShipmentRevenue: new Prisma.Decimal(0),
    successfulPayments: 0,
    soldTicketCount: 0,
    issuedShipmentCount: 0,
  };
}

function createBreakdown(): Record<ServiceKind, MutableBreakdown> {
  return {
    ticket: {
      grossReceipts: new Prisma.Decimal(0),
      refundAmount: new Prisma.Decimal(0),
    },
    standaloneShipment: {
      grossReceipts: new Prisma.Decimal(0),
      refundAmount: new Prisma.Decimal(0),
    },
    accompaniedShipment: {
      grossReceipts: new Prisma.Decimal(0),
      refundAmount: new Prisma.Decimal(0),
    },
  };
}

function addCount(current: number, addition: number): number {
  const result = current + addition;
  if (!Number.isSafeInteger(result) || result < 0) invalidSourceData();
  return result;
}

function assertWholeVnd(amount: Prisma.Decimal): void {
  if (!amount.isFinite() || amount.decimalPlaces() > 0) invalidSourceData();
}

function serializeVnd(amount: Prisma.Decimal): string {
  assertWholeVnd(amount);
  return amount.toFixed(0);
}

function sumTicketPrices(event: SaleEvent): Prisma.Decimal {
  const tickets = event.donGiaoDich.phieuDatVe?.ves;
  if (tickets && tickets.length === 0) invalidSourceData();
  return (tickets ?? []).reduce((sum, ticket) => {
    assertWholeVnd(ticket.giaThucTe);
    return sum.plus(ticket.giaThucTe);
  }, new Prisma.Decimal(0));
}

function saleSplit(event: SaleEvent): {
  shipmentKind: ServiceKind;
  ticketAmount: Prisma.Decimal;
  shipmentAmount: Prisma.Decimal;
} {
  const booking = event.donGiaoDich.phieuDatVe;
  const shipment = event.donGiaoDich.phieuGuiHang;
  if (!booking && !shipment) return invalidSourceData();

  const ticketAmount = sumTicketPrices(event);
  const shipmentAmount = shipment?.tongPhi ?? new Prisma.Decimal(0);
  assertWholeVnd(shipmentAmount);

  const splitTotal = ticketAmount.plus(shipmentAmount);
  assertWholeVnd(event.donGiaoDich.tongTien);
  assertWholeVnd(event.soTien);
  if (
    !splitTotal.eq(event.donGiaoDich.tongTien) ||
    !splitTotal.eq(event.soTien) ||
    event.soTien.lte(0)
  ) {
    return invalidSourceData();
  }

  const shipmentKind: ServiceKind = booking
    ? 'accompaniedShipment'
    : 'standaloneShipment';
  return { shipmentKind, ticketAmount, shipmentAmount };
}

function saleDate(event: SaleEvent): Date {
  if (!event.thoiDiemHoanTat) return invalidSourceData();
  return event.thoiDiemHoanTat;
}

function refundKind(event: RefundEvent): ServiceKind {
  if (
    event.veId === null ||
    !event.ve ||
    event.ve.veId !== event.veId ||
    event.ve.phieuDatVe.donGiaoDichId !== event.donGiaoDichId ||
    event.donGiaoDich.phieuDatVe?.donGiaoDichId !== event.donGiaoDichId
  ) {
    return invalidSourceData();
  }
  return 'ticket';
}

function refundDate(event: RefundEvent): Date {
  if (!event.thoiDiemHoanTat) return invalidSourceData();
  assertWholeVnd(event.soTien);
  if (event.soTien.lte(0)) return invalidSourceData();
  return event.thoiDiemHoanTat;
}

function createPeriodLabels(
  fromDate: string,
  toDate: string,
  groupBy: RevenueReportGroupBy,
): string[] {
  const labels = new Set<string>();
  let cursor = fromDate;
  while (cursor <= toDate) {
    labels.add(periodForDate(cursor, groupBy));
    cursor = addCalendarDays(cursor, 1);
  }
  return [...labels];
}

function serializeAmounts(amounts: MutableAmounts) {
  const netRevenue = amounts.netTicketRevenue.plus(amounts.netShipmentRevenue);
  if (!amounts.grossReceipts.minus(amounts.refundAmount).eq(netRevenue)) {
    return invalidSourceData();
  }
  return {
    grossReceipts: serializeVnd(amounts.grossReceipts),
    refundAmount: serializeVnd(amounts.refundAmount),
    netRevenue: serializeVnd(netRevenue),
    netTicketRevenue: serializeVnd(amounts.netTicketRevenue),
    netShipmentRevenue: serializeVnd(amounts.netShipmentRevenue),
    successfulPayments: amounts.successfulPayments,
    soldTicketCount: amounts.soldTicketCount,
    issuedShipmentCount: amounts.issuedShipmentCount,
  };
}

@Injectable()
export class RevenueReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    query: RevenueReportQueryDto,
    principal: AuthPrincipal | undefined,
    now = new Date(),
  ) {
    const nhaXeId = requireTenantPrincipal(principal);
    const range = resolveDateRange(query, now);
    const groupBy = query.groupBy ?? 'day';

    const [sales, refunds, zeroTicketEvents] = await Promise.all([
      this.prisma.thanhToan.findMany({
        where: {
          loaiGiaoDich: 'THANH_TOAN',
          trangThai: 'THANH_CONG',
          laQuyetToanHopLe: true,
          thoiDiemHoanTat: { gte: range.startAt, lt: range.endAt },
          donGiaoDich: { nhaXeId },
        },
        select: SALE_EVENT_SELECT,
      }),
      this.prisma.thanhToan.findMany({
        where: {
          loaiGiaoDich: 'HOAN_TIEN',
          trangThai: 'THANH_CONG',
          thoiDiemHoanTat: { gte: range.startAt, lt: range.endAt },
          donGiaoDich: { nhaXeId },
        },
        select: REFUND_EVENT_SELECT,
      }),
      this.prisma.lichSuTrangThaiVe.findMany({
        where: {
          trangThaiCu: 'DA_DAT',
          trangThaiMoi: 'DA_THANH_TOAN',
          thoiDiem: { gte: range.startAt, lt: range.endAt },
          nguonThayDoi: 'SYSTEM',
          taiKhoanId: null,
          lyDo: ZERO_VALUE_TICKET_REASON,
          laOverride: false,
          ve: {
            phieuDatVe: {
              donGiaoDich: {
                nhaXeId,
                tongTien: new Prisma.Decimal(0),
                thanhToans: { none: {} },
              },
            },
          },
        },
        select: ZERO_TICKET_EVENT_SELECT,
      }),
    ]);

    const labels = createPeriodLabels(range.fromDate, range.toDate, groupBy);
    const series = new Map(labels.map((label) => [label, createAmounts()]));
    const totals = createAmounts();
    const breakdown = createBreakdown();
    const seenSaleOrderIds = new Set<number>();
    const seenZeroTicketIds = new Set<number>();
    let reconciliationRefundCount = 0;
    let reconciliationRefundAmount = new Prisma.Decimal(0);

    for (const event of sales as SaleEvent[]) {
      if (seenSaleOrderIds.has(event.donGiaoDichId)) invalidSourceData();
      seenSaleOrderIds.add(event.donGiaoDichId);

      const date = saleDate(event);
      const period = periodForInstant(date, groupBy);
      const row = series.get(period);
      if (!row) invalidSourceData();
      const split = saleSplit(event);
      const gross = event.soTien;

      totals.grossReceipts = totals.grossReceipts.plus(gross);
      totals.netTicketRevenue = totals.netTicketRevenue.plus(
        split.ticketAmount,
      );
      totals.netShipmentRevenue = totals.netShipmentRevenue.plus(
        split.shipmentAmount,
      );
      totals.successfulPayments = addCount(totals.successfulPayments, 1);
      totals.soldTicketCount = addCount(
        totals.soldTicketCount,
        event.donGiaoDich.phieuDatVe?.ves.length ?? 0,
      );
      totals.issuedShipmentCount = addCount(
        totals.issuedShipmentCount,
        event.donGiaoDich.phieuGuiHang ? 1 : 0,
      );
      row.grossReceipts = row.grossReceipts.plus(gross);
      row.netTicketRevenue = row.netTicketRevenue.plus(split.ticketAmount);
      row.netShipmentRevenue = row.netShipmentRevenue.plus(
        split.shipmentAmount,
      );
      row.successfulPayments = addCount(row.successfulPayments, 1);
      row.soldTicketCount = addCount(
        row.soldTicketCount,
        event.donGiaoDich.phieuDatVe?.ves.length ?? 0,
      );
      row.issuedShipmentCount = addCount(
        row.issuedShipmentCount,
        event.donGiaoDich.phieuGuiHang ? 1 : 0,
      );
      breakdown.ticket.grossReceipts = breakdown.ticket.grossReceipts.plus(
        split.ticketAmount,
      );
      breakdown[split.shipmentKind].grossReceipts = breakdown[
        split.shipmentKind
      ].grossReceipts.plus(split.shipmentAmount);
    }

    for (const event of refunds as RefundEvent[]) {
      const date = refundDate(event);
      const kind = refundKind(event);
      const eligibleSales = event.donGiaoDich.thanhToans.filter(
        (sale) => sale.laQuyetToanHopLe && sale.thoiDiemHoanTat !== null,
      );
      if (eligibleSales.length > 1) invalidSourceData();
      if (eligibleSales.length === 0) {
        // Legacy/unverified sales were never recognized by F12. Disclose their
        // refunds separately rather than subtracting unrecognized receipts.
        reconciliationRefundCount = addCount(reconciliationRefundCount, 1);
        reconciliationRefundAmount = reconciliationRefundAmount.plus(event.soTien);
        continue;
      }
      if (eligibleSales[0].thoiDiemHoanTat!.getTime() > date.getTime()) invalidSourceData();
      const period = periodForInstant(date, groupBy);
      const row = series.get(period);
      if (!row) invalidSourceData();

      totals.refundAmount = totals.refundAmount.plus(event.soTien);
      totals.netTicketRevenue = totals.netTicketRevenue.minus(event.soTien);
      row.refundAmount = row.refundAmount.plus(event.soTien);
      row.netTicketRevenue = row.netTicketRevenue.minus(event.soTien);
      breakdown[kind].refundAmount = breakdown[kind].refundAmount.plus(
        event.soTien,
      );
    }

    for (const event of zeroTicketEvents as ZeroTicketEvent[]) {
      if (seenZeroTicketIds.has(event.veId)) invalidSourceData();
      seenZeroTicketIds.add(event.veId);
      const period = periodForInstant(event.thoiDiem, groupBy);
      const row = series.get(period);
      if (!row) invalidSourceData();
      totals.soldTicketCount = addCount(totals.soldTicketCount, 1);
      row.soldTicketCount = addCount(row.soldTicketCount, 1);
    }

    const serializedBreakdown = (Object.keys(breakdown) as ServiceKind[]).map(
      (kind) => {
        const amounts = breakdown[kind];
        const netRevenue = amounts.grossReceipts.minus(amounts.refundAmount);
        return {
          kind,
          label:
            kind === 'ticket'
              ? 'Vé'
              : kind === 'standaloneShipment'
                ? 'Gửi hàng độc lập'
                : 'Gửi hàng kèm vé',
          grossReceipts: serializeVnd(amounts.grossReceipts),
          refundAmount: serializeVnd(amounts.refundAmount),
          netRevenue: serializeVnd(netRevenue),
        };
      },
    );

    const breakdownGross = Object.values(breakdown).reduce(
      (sum, line) => sum.plus(line.grossReceipts),
      new Prisma.Decimal(0),
    );
    const breakdownRefunds = Object.values(breakdown).reduce(
      (sum, line) => sum.plus(line.refundAmount),
      new Prisma.Decimal(0),
    );
    const breakdownTicketNet = breakdown.ticket.grossReceipts.minus(
      breakdown.ticket.refundAmount,
    );
    const breakdownShipmentNet = breakdown.standaloneShipment.grossReceipts
      .plus(breakdown.accompaniedShipment.grossReceipts)
      .minus(breakdown.standaloneShipment.refundAmount)
      .minus(breakdown.accompaniedShipment.refundAmount);
    if (
      !breakdownGross.eq(totals.grossReceipts) ||
      !breakdownRefunds.eq(totals.refundAmount) ||
      !breakdownTicketNet.eq(totals.netTicketRevenue) ||
      !breakdownShipmentNet.eq(totals.netShipmentRevenue)
    ) {
      invalidSourceData();
    }

    return {
      data: {
        currency: 'VND' as const,
        totals: serializeAmounts(totals),
        reconciliation: {
          refundCount: reconciliationRefundCount,
          refundAmount: serializeVnd(reconciliationRefundAmount),
        },
        serviceBreakdown: serializedBreakdown,
        series: [...series.entries()].map(([period, amounts]) => ({
          period,
          ...serializeAmounts(amounts),
        })) satisfies RevenueReportSeriesItem[],
      },
      meta: {
        fromDate: range.fromDate,
        toDate: range.toDate,
        groupBy,
        timezone: REVENUE_REPORT_TIMEZONE,
      },
    };
  }
}
