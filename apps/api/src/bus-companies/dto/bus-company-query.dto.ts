import {
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
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
  @IsString()
  @MaxLength(30)
  status?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  @Validate(CreatedDateRangeConstraint)
  createdTo?: string;
}
