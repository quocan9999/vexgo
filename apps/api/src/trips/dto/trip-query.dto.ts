import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const TRIP_STATUSES = [
  'CHUA_KHOI_HANH',
  'DANG_CHAY',
  'HOAN_THANH',
  'DA_HUY',
] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_SORT_FIELDS = [
  'code',
  'departureDate',
  'departureTime',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type TripSortField = (typeof TRIP_SORT_FIELDS)[number];

function optionalInteger(value: unknown): number {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

export class TripQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsIn(TRIP_SORT_FIELDS)
  override sortBy: TripSortField = 'departureDate';

  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatus;

  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId?: number;

  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleId?: number;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  departureDate?: string;
}
