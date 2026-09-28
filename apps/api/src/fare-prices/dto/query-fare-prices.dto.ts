import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';
import {
  FARE_PRICE_EFFECTIVE_STATES,
  FARE_PRICE_STATUSES,
} from '../fare-price.domain.js';

export const FARE_PRICE_SORT_FIELDS = [
  'listedPrice',
  'validFrom',
  'validTo',
  'status',
] as const;

export type FarePriceSortField = (typeof FARE_PRICE_SORT_FIELDS)[number];

export class QueryFarePricesDto extends PaginationQueryDto {
  @IsIn(FARE_PRICE_SORT_FIELDS)
  sortBy: FarePriceSortField = 'validFrom';

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId?: number;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : Number.NaN,
  )
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId?: number;

  @IsOptional()
  @IsIn(FARE_PRICE_STATUSES)
  status?: (typeof FARE_PRICE_STATUSES)[number];

  @IsOptional()
  @IsIn(FARE_PRICE_EFFECTIVE_STATES)
  effectiveState?: (typeof FARE_PRICE_EFFECTIVE_STATES)[number];
}
