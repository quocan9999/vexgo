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
  @IsIn(BUS_COMPANY_SORT_FIELDS)
  sortBy: BusCompanySortField = 'name';

  @IsOptional()
  @IsIn(BUS_COMPANY_STATUSES)
  status?: BusCompanyStatus;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  createdFrom?: string;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(DATE_ONLY_PATTERN, {
    message: 'Ngày phải có định dạng YYYY-MM-DD.',
  })
  @Validate(CreatedDateRangeConstraint)
  createdTo?: string;
}
