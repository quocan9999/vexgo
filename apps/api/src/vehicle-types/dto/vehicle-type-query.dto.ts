import { IsIn } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto.js';

export const VEHICLE_TYPE_SORT_FIELDS = [
  'name',
  'createdAt',
  'updatedAt',
] as const;

export type VehicleTypeSortField = (typeof VEHICLE_TYPE_SORT_FIELDS)[number];

export class VehicleTypeQueryDto extends PaginationQueryDto {
  @IsIn(VEHICLE_TYPE_SORT_FIELDS)
  sortBy: VehicleTypeSortField = 'name';

  sortDirection: 'asc' | 'desc' = 'asc';
}
