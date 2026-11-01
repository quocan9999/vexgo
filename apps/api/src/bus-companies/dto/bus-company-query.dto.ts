import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsOptional,
  Matches,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const BUS_COMPANY_SORT_FIELDS = [
  'name',
  'code',
  'status',
  'createdAt',
] as const;

export type BusCompanySortField = (typeof BUS_COMPANY_SORT_FIELDS)[number];
export const BUS_COMPANY_STATUSES = ['HOAT_DONG', 'TAM_NGUNG'] as const;
export type BusCompanyStatus = (typeof BUS_COMPANY_STATUSES)[number];
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

@ValidatorConstraint({ name: 'createdDateRange', async: false })
class CreatedDateRangeConstraint implements ValidatorConstraintInterface {
  validate(createdTo: string, args: ValidationArguments) {
    const { createdFrom } = args.object as { createdFrom?: string };
    return !createdFrom || Date.parse(createdFrom) <= Date.parse(createdTo);
  }

  defaultMessage() {
    return 'Ngày kết thúc phải bằng hoặc sau ngày bắt đầu.';
  }
}

export class BusCompanyQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách nhà xe',
    enum: BUS_COMPANY_SORT_FIELDS,
    default: 'name',
    example: 'name',
  })
  @IsIn(BUS_COMPANY_SORT_FIELDS)
  sortBy: BusCompanySortField = 'name';

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái nhà xe (HOAT_DONG hoặc TAM_NGUNG)',
    enum: BUS_COMPANY_STATUSES,
    example: 'HOAT_DONG',
  })
  @IsOptional()
  @IsIn(BUS_COMPANY_STATUSES)
  status?: BusCompanyStatus;

  @ApiPropertyOptional({
    description: 'Lọc nhà xe tạo từ ngày (YYYY-MM-DD)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  createdFrom?: string;

  @ApiPropertyOptional({
    description: 'Lọc nhà xe tạo đến ngày (YYYY-MM-DD)',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  @Validate(CreatedDateRangeConstraint)
  createdTo?: string;
}
