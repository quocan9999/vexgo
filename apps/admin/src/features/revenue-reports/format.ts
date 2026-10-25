import { formatVnd } from '@/features/booking-management/services/booking-management-format';
import type {
  RevenueReportGroupBy,
  RevenueReportMeta,
} from './types/revenue-report';

const vietnameseInteger = new Intl.NumberFormat('vi-VN', {
  maximumFractionDigits: 0,
});

export function formatRevenueVnd(value: string): string {
  if (!/^-?\d+$/.test(value)) return '—';
  if (value.startsWith('-') && value !== '-0') {
    return `−${formatVnd(value.slice(1))}`;
  }
  return formatVnd(value === '-0' ? '0' : value);
}

export function formatCompactRevenueVnd(value: bigint): string {
  const sign = value < BigInt(0) ? '−' : '';
  const absolute = value < BigInt(0) ? -value : value;
  const units = [
    { divisor: BigInt(1_000_000_000_000), label: 'nghìn tỷ' },
    { divisor: BigInt(1_000_000_000), label: 'tỷ' },
    { divisor: BigInt(1_000_000), label: 'triệu' },
    { divisor: BigInt(1_000), label: 'nghìn' },
  ];

  for (const unit of units) {
    if (absolute >= unit.divisor) {
      const whole = absolute / unit.divisor;
      const tenth = ((absolute % unit.divisor) * BigInt(10)) / unit.divisor;
      const amount = `${vietnameseInteger.format(whole)}${tenth > BigInt(0) ? `,${tenth}` : ''}`;
      return `${sign}${amount} ${unit.label} ₫`;
    }
  }

  return formatRevenueVnd(value.toString());
}

export function formatDateOnly(value: string): string {
  const [year, month, day] = value.split('-');
  return year && month && day ? `${day}-${month}-${year}` : value;
}

export function formatPeriod(
  value: string,
  groupBy: RevenueReportGroupBy,
): string {
  if (groupBy === 'day') return formatDateOnly(value);
  if (groupBy === 'month') {
    const [year, month] = value.split('-');
    return year && month ? `${month}/${year}` : value;
  }
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  return match ? `Quý ${match[2]}/${match[1]}` : value;
}

export function formatReportRange(meta: RevenueReportMeta): string {
  return `${formatDateOnly(meta.fromDate)} – ${formatDateOnly(meta.toDate)}`;
}

export function groupByLabel(groupBy: RevenueReportGroupBy): string {
  if (groupBy === 'month') return 'tháng';
  if (groupBy === 'quarter') return 'quý';
  return 'ngày';
}
