import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    description: 'Trường sắp xếp danh sách chuyến xe',
    enum: TRIP_SORT_FIELDS,
    default: 'departureDate',
    example: 'departureDate',
  })
  @IsOptional()
  @IsIn(TRIP_SORT_FIELDS)
  override sortBy: TripSortField = 'departureDate';

  @ApiPropertyOptional({
    description: 'Lọc theo trạng thái chuyến xe',
    enum: TRIP_STATUSES,
    example: 'CHUA_KHOI_HANH',
  })
  @IsOptional()
  @IsIn(TRIP_STATUSES)
  status?: TripStatus;

  @ApiPropertyOptional({ description: 'Lọc theo ID tuyến xe', example: 1 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  routeId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID xe phục vụ', example: 1 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleId?: number;

  @ApiPropertyOptional({
    description: 'Lọc theo ngày khởi hành (YYYY-MM-DD)',
    example: '2026-11-20',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  departureDate?: string;

  @ApiPropertyOptional({
    description: 'Lọc từ ngày khởi hành (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDepartureDate?: string;

  @ApiPropertyOptional({
    description: 'Lọc đến ngày khởi hành (YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDepartureDate?: string;

  @ApiPropertyOptional({
    description: 'Lọc từ ngày khởi hành alias (YYYY-MM-DD)',
    example: '2026-10-01',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Lọc đến ngày khởi hành alias (YYYY-MM-DD)',
    example: '2026-10-31',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  toDate?: string;
}
