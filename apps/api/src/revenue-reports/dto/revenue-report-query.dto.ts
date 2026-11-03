import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  Matches,
  Validate,
  ValidatorConstraint,
  type ValidatorConstraintInterface,
  type ValidationArguments,
} from 'class-validator';

export const REVENUE_REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
export const REVENUE_REPORT_MAX_DAYS = 366;

export type RevenueReportGroupBy = 'day' | 'month' | 'quarter';

function isValidRevenueReportDateOnly(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const year = Number(value.slice(0, 4));
  if (year < 1000) return false;

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

function inclusiveDayCount(fromDate: string, toDate: string): number | null {
  if (
    !isValidRevenueReportDateOnly(fromDate) ||
    !isValidRevenueReportDateOnly(toDate)
  ) {
    return null;
  }
  const from = Date.parse(`${fromDate}T00:00:00.000Z`);
  const to = Date.parse(`${toDate}T00:00:00.000Z`);
  if (to < from) return null;
  return Math.floor((to - from) / 86_400_000) + 1;
}

@ValidatorConstraint({ name: 'isValidRevenueReportRange', async: false })
class IsValidRevenueReportRangeConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    const query = args.object as RevenueReportQueryDto;
    if (query.fromDate === undefined && query.toDate === undefined) return true;
    if (query.fromDate === undefined || query.toDate === undefined)
      return false;

    const count = inclusiveDayCount(query.fromDate, query.toDate);
    return count !== null && count <= REVENUE_REPORT_MAX_DAYS;
  }

  defaultMessage(): string {
    return `fromDate và toDate phải cùng có mặt, hợp lệ, đúng thứ tự và không vượt quá ${REVENUE_REPORT_MAX_DAYS} ngày.`;
  }
}

export class RevenueReportQueryDto {
  @ApiPropertyOptional({
    description: 'Báo cáo từ ngày (định dạng YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Báo cáo đến ngày (định dạng YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Nhóm dữ liệu doanh thu theo: ngày (day), tháng (month) hoặc quý (quarter)',
    enum: ['day', 'month', 'quarter'],
    default: 'day',
    example: 'day',
  })
  @IsIn(['day', 'month', 'quarter'])
  @Validate(IsValidRevenueReportRangeConstraint)
  groupBy: RevenueReportGroupBy = 'day';
}
