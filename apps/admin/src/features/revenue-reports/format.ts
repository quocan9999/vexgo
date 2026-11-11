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

export function formatCompactRevenueVnd(value: bigint, locale?: string): string {
  const sign = value < BigInt(0) ? '−' : '';
  const absolute = value < BigInt(0) ? -value : value;
  const isEn = locale === 'en';
  const units = isEn
    ? [
        { divisor: BigInt(1_000_000_000_000), label: 'T' },
        { divisor: BigInt(1_000_000_000), label: 'B' },
        { divisor: BigInt(1_000_000), label: 'M' },
        { divisor: BigInt(1_000), label: 'K' },
      ]
    : [
        { divisor: BigInt(1_000_000_000_000), label: ' ngh\u00ECn t\u1EF7' },
        { divisor: BigInt(1_000_000_000), label: ' t\u1EF7' },
        { divisor: BigInt(1_000_000), label: ' tri\u1EC7u' },
        { divisor: BigInt(1_000), label: ' ngh\u00ECn' },
      ];

  for (const unit of units) {
    if (absolute >= unit.divisor) {
      const whole = absolute / unit.divisor;
      const tenth = ((absolute % unit.divisor) * BigInt(10)) / unit.divisor;
      const amount = `${vietnameseInteger.format(whole)}${tenth > BigInt(0) ? (isEn ? `.${tenth}` : `,${tenth}`) : ''}`;
      return `${sign}${amount}${isEn ? '' : ' '}${unit.label} ₫`;
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
  locale?: string,
): string {
  if (groupBy === 'day') return formatDateOnly(value);
  if (groupBy === 'month') {
    const [year, month] = value.split('-');
    return year && month ? `${month}/${year}` : value;
  }
  const match = /^(\d{4})-Q([1-4])$/.exec(value);
  if (!match) return value;
  return locale === 'en' ? `Q${match[2]}/${match[1]}` : `Qu\u00FD ${match[2]}/${match[1]}`;
}

export function formatReportRange(meta: RevenueReportMeta): string {
  return `${formatDateOnly(meta.fromDate)} – ${formatDateOnly(meta.toDate)}`;
}

export function groupByLabel(groupBy: RevenueReportGroupBy, locale?: string): string {
  if (groupBy === 'month') return locale === 'en' ? 'month' : 'th\u00E1ng';
  if (groupBy === 'quarter') return locale === 'en' ? 'quarter' : 'qu\u00FD';
  return locale === 'en' ? 'day' : 'ng\u00E0y';
}
