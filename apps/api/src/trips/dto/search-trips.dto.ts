import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const TRIP_SORT_FIELDS = [
  'departureTime',
  'price',
  'availableSeats',
] as const;
export type TripSortField = (typeof TRIP_SORT_FIELDS)[number];
export const TRIP_TIME_RANGES = [
  'all',
  'early-morning',
  'morning',
  'afternoon',
  'evening',
] as const;
export type TripTimeRange = (typeof TRIP_TIME_RANGES)[number];

function optionalInteger(value: unknown): number {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

export class SearchTripsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Tên tỉnh/thành hoặc địa điểm xuất phát', example: 'TP. Hồ Chí Minh' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'Tên tỉnh/thành hoặc địa điểm đến', example: 'Đà Lạt' })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({ description: 'ID tỉnh/thành xuất phát', example: 1 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt({ message: 'fromLocationId phải là số nguyên dương.' })
  @Min(1)
  fromLocationId?: number;

  @ApiPropertyOptional({ description: 'ID tỉnh/thành đến', example: 2 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt({ message: 'toLocationId phải là số nguyên dương.' })
  @Min(1)
  toLocationId?: number;

  @ApiPropertyOptional({ description: 'ID quận/huyện/khu vực xuất phát', example: 10 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt({ message: 'fromAreaId phải là số nguyên dương.' })
  @Min(1)
  fromAreaId?: number;

  @ApiPropertyOptional({ description: 'ID quận/huyện/khu vực đến', example: 20 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt({ message: 'toAreaId phải là số nguyên dương.' })
  @Min(1)
  toAreaId?: number;

  @ApiPropertyOptional({ description: 'ID bến xe xuất phát', example: 5 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt({ message: 'fromStationId phải là số nguyên dương.' })
  @Min(1)
  fromStationId?: number;

  @ApiPropertyOptional({ description: 'ID bến xe đến', example: 6 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt({ message: 'toStationId phải là số nguyên dương.' })
  @Min(1)
  toStationId?: number;

  @ApiPropertyOptional({ description: 'Tên loại xe (Giường nằm, Limousine...)', example: 'Limousine' })
  @IsOptional()
  @IsString()
  vehicleType?: string;

  @ApiPropertyOptional({ description: 'Tên hoặc từ khóa nhà xe khai thác', example: 'Phương Trang' })
  @IsOptional()
  @IsString()
  operator?: string;

  @ApiPropertyOptional({
    description: 'Khoảng thời gian khởi hành trong ngày',
    enum: TRIP_TIME_RANGES,
    example: 'morning',
  })
  @IsOptional()
  @IsIn(TRIP_TIME_RANGES)
  timeRange?: TripTimeRange;

  @ApiPropertyOptional({
    description: 'Ngày khởi hành (định dạng YYYY-MM-DD)',
    example: '2026-11-20',
  })
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  departureDate?: string;

  @ApiPropertyOptional({ description: 'Lọc theo ID nhà xe', example: 1 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  busCompanyId?: number;

  @ApiPropertyOptional({ description: 'Lọc theo ID loại xe', example: 1 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  vehicleTypeId?: number;

  @ApiPropertyOptional({ description: 'Mức giá vé tối thiểu (VNĐ)', example: 150000 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  minPrice?: number;

  @ApiPropertyOptional({ description: 'Mức giá vé tối đa (VNĐ)', example: 500000 })
  @IsOptional()
  @Transform(({ value }) => optionalInteger(value))
  @IsInt()
  @Min(0)
  @Max(Number.MAX_SAFE_INTEGER)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp kết quả',
    enum: TRIP_SORT_FIELDS,
    default: 'departureTime',
    example: 'departureTime',
  })
  @IsIn(TRIP_SORT_FIELDS)
  override sortBy: TripSortField = 'departureTime';
}
