import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const VEHICLE_SORT_FIELDS = [
  'licensePlate',
  'status',
  'createdAt',
  'updatedAt',
] as const;

export type VehicleSortField = (typeof VEHICLE_SORT_FIELDS)[number];

// Keep this set aligned with values currently written by the vehicle seed.
export const VEHICLE_STATUSES = ['HOAT_DONG', 'BAO_TRI'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

function transformStrictPositiveId(value: unknown) {
  if (value === undefined || value === null) return value;
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

export class VehicleQueryDto extends PaginationQueryDto {
  @IsIn(VEHICLE_SORT_FIELDS)
  sortBy: VehicleSortField = 'licensePlate';

  sortDirection: 'asc' | 'desc' = 'asc';

  @IsOptional()
  @IsIn(VEHICLE_STATUSES)
  status?: VehicleStatus;

  @Transform(({ value }) => transformStrictPositiveId(value))
  @IsOptional()
  @IsInt({ message: 'Mã nhà xe phải là số nguyên.' })
  @Min(1, { message: 'Mã nhà xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'Mã nhà xe vượt giới hạn.' })
  busCompanyId?: number;

  @Transform(({ value }) => transformStrictPositiveId(value))
  @IsOptional()
  @IsInt({ message: 'Mã loại xe phải là số nguyên.' })
  @Min(1, { message: 'Mã loại xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'Mã loại xe vượt giới hạn.' })
  vehicleTypeId?: number;
}
