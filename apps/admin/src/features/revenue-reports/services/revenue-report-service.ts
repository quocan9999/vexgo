import { adminApiFetch } from '@/lib/admin-api-client';
import { getApiBaseUrl } from '@/lib/api-url';
import type {
  RevenueReportBreakdownItem,
  RevenueReportGroupBy,
  RevenueReportMoney,
  RevenueReportQuery,
  RevenueReportResponse,
  RevenueReportSeriesItem,
  RevenueReportServiceKind,
  RevenueReportTotals,
} from '../types/revenue-report';

const SERVICE_KINDS: readonly RevenueReportServiceKind[] = [
  'ticket',
  'standaloneShipment',
  'accompaniedShipment',
];

export class RevenueReportApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly accessDenied = false,
    readonly retryable = true,
  ) {
    super(message);
    this.name = 'RevenueReportApiError';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMoney(value: unknown, allowNegative: boolean): value is string {
  return (
    typeof value === 'string' &&
    (allowNegative ? /^-?\d+$/.test(value) : /^\d+$/.test(value))
  );
}

function isSafeCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isGroupBy(value: unknown): value is RevenueReportGroupBy {
  return value === 'day' || value === 'month' || value === 'quarter';
}

function isPeriod(value: unknown, groupBy: RevenueReportGroupBy): value is string {
  if (typeof value !== 'string') return false;
  if (groupBy === 'day') return isDateOnly(value);
  if (groupBy === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  return /^\d{4}-Q[1-4]$/.test(value);
}

function isRevenueMoney(value: unknown): value is RevenueReportMoney {
  return (
    isRecord(value) &&
    isMoney(value.grossReceipts, false) &&
    isMoney(value.refundAmount, false) &&
    isMoney(value.netRevenue, true) &&
    isMoney(value.netTicketRevenue, true) &&
    isMoney(value.netShipmentRevenue, true)
  );
}

function isTotals(value: unknown): value is RevenueReportTotals {
  if (!isRecord(value)) return false;
  if (!isRevenueMoney(value)) return false;
  const record = value as Record<string, unknown>;
  return (
    isSafeCount(record.successfulPayments) &&
    isSafeCount(record.soldTicketCount) &&
    isSafeCount(record.issuedShipmentCount)
  );
}

function isBreakdownItem(value: unknown): value is RevenueReportBreakdownItem {
  return (
    isRecord(value) &&
    SERVICE_KINDS.some((kind) => value.kind === kind) &&
    typeof value.label === 'string' &&
    isMoney(value.grossReceipts, false) &&
    isMoney(value.refundAmount, false) &&
    isMoney(value.netRevenue, true)
  );
}

function isSeriesItem(
  value: unknown,
  groupBy: RevenueReportGroupBy,
): value is RevenueReportSeriesItem {
  if (!isRecord(value)) return false;
  if (!isTotals(value)) return false;
  return isPeriod((value as Record<string, unknown>).period, groupBy);
}

function isRevenueReportResponse(value: unknown): value is RevenueReportResponse {
  if (!isRecord(value) || !isRecord(value.data) || !isRecord(value.meta)) {
    return false;
  }

  const { data, meta } = value;
  const groupBy = meta.groupBy;
  if (
    data.currency !== 'VND' ||
    !isRecord(data.reconciliation) ||
    !isSafeCount(data.reconciliation.refundCount) ||
    !isMoney(data.reconciliation.refundAmount, false) ||
    !isTotals(data.totals) ||
    !Array.isArray(data.serviceBreakdown) ||
    data.serviceBreakdown.length !== SERVICE_KINDS.length ||
    !data.serviceBreakdown.every(isBreakdownItem) ||
    !Array.isArray(data.series) ||
    data.series.length === 0 ||
    !isGroupBy(groupBy) ||
    typeof meta.timezone !== 'string' ||
    meta.timezone !== 'Asia/Ho_Chi_Minh' ||
    !isDateOnly(meta.fromDate) ||
    !isDateOnly(meta.toDate) ||
    meta.toDate < meta.fromDate
  ) {
    return false;
  }

  const kinds = data.serviceBreakdown.map((item) =>
    isBreakdownItem(item) ? item.kind : null,
  );
  return (
    new Set(kinds).size === SERVICE_KINDS.length &&
    data.series.every((item) => isSeriesItem(item, groupBy))
  );
}

function apiUrl(query: RevenueReportQuery): string {
  const params = new URLSearchParams({ groupBy: query.groupBy });
  if (query.fromDate || query.toDate) {
    if (!query.fromDate || !query.toDate) {
      throw new RevenueReportApiError(
        'Cần chọn đủ ngày bắt đầu và ngày kết thúc.',
        undefined,
        false,
        false,
      );
    }
    params.set('fromDate', query.fromDate);
    params.set('toDate', query.toDate);
  }
  return `${getApiBaseUrl()}/api/v1/revenue-reports?${params.toString()}`;
}

export async function getRevenueReport(
  query: RevenueReportQuery,
  signal?: AbortSignal,
): Promise<RevenueReportResponse> {
  if (process.env.NEXT_PUBLIC_ADMIN_DATA_SOURCE?.toLowerCase() !== 'api') {
    throw new RevenueReportApiError(
      'Báo cáo doanh thu chỉ khả dụng khi Admin dùng nguồn dữ liệu API.',
      undefined,
      false,
      false,
    );
  }

  const response = await adminApiFetch(apiUrl(query), {
    cache: 'no-store',
    signal,
  });
  const body: unknown = await response.json().catch(() => null);

  if (response.status === 401 || response.status === 403) {
    throw new RevenueReportApiError(
      'Bạn không có quyền truy cập báo cáo doanh thu. Hãy đăng nhập lại hoặc liên hệ quản trị viên.',
      response.status,
      true,
      false,
    );
  }
  if (!response.ok) {
    throw new RevenueReportApiError(
      'Không thể tải báo cáo doanh thu. Vui lòng thử lại.',
      response.status,
    );
  }
  if (!isRevenueReportResponse(body)) {
    throw new RevenueReportApiError(
      'API trả về dữ liệu báo cáo doanh thu không hợp lệ.',
      undefined,
      false,
      false,
    );
  }

  return body;
}
