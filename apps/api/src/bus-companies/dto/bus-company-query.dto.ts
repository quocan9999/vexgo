import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const BUS_COMPANY_SORT_FIELDS = [
  'name',
  'code',
  'status',
  'createdAt',
] as const;

export type BusCompanySortField = (typeof BUS_COMPANY_SORT_FIELDS)[number];

export class BusCompanyQueryDto extends PaginationQueryDto {
  @IsIn(BUS_COMPANY_SORT_FIELDS)
  sortBy: BusCompanySortField = 'name';

  @IsOptional()
  @IsString()
  @MaxLength(30)
  status?: string;
}
