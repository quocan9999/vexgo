import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const ROUTE_STATUSES = ['HOAT_DONG', 'TAM_NGUNG'] as const;
export const ROUTE_SORT_FIELDS = [
  'code', 'origin', 'destination', 'status', 'createdAt', 'updatedAt',
] as const;
export type RouteSortField = (typeof ROUTE_SORT_FIELDS)[number];

export class RouteQueryDto extends PaginationQueryDto {
  @IsIn(ROUTE_SORT_FIELDS)
  sortBy: RouteSortField = 'code';

  @IsOptional()
  @IsIn(ROUTE_STATUSES)
  status?: (typeof ROUTE_STATUSES)[number];

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId?: number;
}
