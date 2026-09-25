import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const VEHICLE_STATUSES = ['HOAT_DONG', 'BAO_TRI'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_SORT_FIELDS = [
  'licensePlate',
  'status',
  'createdAt',
  'updatedAt',
] as const;
export type VehicleSortField = (typeof VEHICLE_SORT_FIELDS)[number];

function strictInteger(value: unknown) {
  return typeof value === 'string' && /^\d+$/.test(value)
    ? Number(value)
    : Number.NaN;
}

export class VehicleQueryDto extends PaginationQueryDto {
  @IsIn(VEHICLE_SORT_FIELDS)
  sortBy: VehicleSortField = 'licensePlate';

  @IsOptional()
  @IsIn(VEHICLE_STATUSES)
  status?: VehicleStatus;

  @IsOptional()
  @Transform(({ value }) => strictInteger(value))
  @IsInt({ message: 'ID nhà xe phải là số nguyên.' })
  @Min(1, { message: 'ID nhà xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID nhà xe vượt giới hạn.' })
  busCompanyId?: number;

  @IsOptional()
  @Transform(({ value }) => strictInteger(value))
  @IsInt({ message: 'ID loại xe phải là số nguyên.' })
  @Min(1, { message: 'ID loại xe phải lớn hơn 0.' })
  @Max(2_147_483_647, { message: 'ID loại xe vượt giới hạn.' })
  vehicleTypeId?: number;
}
